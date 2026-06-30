package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var stores = []string{
	"courses",
	"attempts",
	"surveys",
	"learningRecords",
	"redemptions",
	"users",
	"salesRecords",
	"mallItems",
}

var storeSet = func() map[string]bool {
	next := map[string]bool{}
	for _, store := range stores {
		next[store] = true
	}
	return next
}()

var dataMu sync.Mutex

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "4173"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/stores/", handleStore)
	mux.HandleFunc("/", handleStatic)

	addr := ":" + port
	log.Printf("SKYWORTH app server http://0.0.0.0%s/", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func dataDir() string {
	if dir := os.Getenv("DATA_DIR"); dir != "" {
		return dir
	}
	return "data"
}

func dataFile() string {
	return filepath.Join(dataDir(), "platform-data.json")
}

func emptyData() map[string][]map[string]any {
	data := map[string][]map[string]any{}
	for _, store := range stores {
		data[store] = []map[string]any{}
	}
	return data
}

func readData() map[string][]map[string]any {
	dataMu.Lock()
	defer dataMu.Unlock()
	return readDataUnlocked()
}

func readDataUnlocked() map[string][]map[string]any {
	file := dataFile()
	raw, err := os.ReadFile(file)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.Printf("could not read data file: %v", err)
		}
		return emptyData()
	}

	data := emptyData()
	if len(raw) == 0 {
		return data
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		log.Printf("could not parse data file: %v", err)
		return emptyData()
	}
	for _, store := range stores {
		if data[store] == nil {
			data[store] = []map[string]any{}
		}
	}
	return data
}

func writeDataUnlocked(data map[string][]map[string]any) error {
	if err := os.MkdirAll(dataDir(), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	tmp := dataFile() + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, dataFile())
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"stores":    stores,
		"persisted": true,
	})
}

func handleStore(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/stores/"), "/")
	if len(parts) == 0 || parts[0] == "" || !storeSet[parts[0]] {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Unknown store."})
		return
	}

	store := parts[0]
	id := ""
	if len(parts) > 1 {
		id = parts[1]
	}

	dataMu.Lock()
	defer dataMu.Unlock()
	data := readDataUnlocked()

	switch r.Method {
	case http.MethodGet:
		if id == "" {
			writeJSON(w, http.StatusOK, data[store])
			return
		}
		for _, item := range data[store] {
			if fmt.Sprint(item["id"]) == id {
				writeJSON(w, http.StatusOK, item)
				return
			}
		}
		writeJSON(w, http.StatusOK, nil)
	case http.MethodPost, http.MethodPut:
		if id != "" {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed."})
			return
		}
		item, err := readJSONItem(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		itemID := fmt.Sprint(item["id"])
		replaced := false
		for index, existing := range data[store] {
			if fmt.Sprint(existing["id"]) == itemID {
				data[store][index] = item
				replaced = true
				break
			}
		}
		if !replaced {
			data[store] = append(data[store], item)
		}
		if err := writeDataUnlocked(data); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, item)
	case http.MethodDelete:
		if id == "" {
			data[store] = []map[string]any{}
		} else {
			next := []map[string]any{}
			for _, item := range data[store] {
				if fmt.Sprint(item["id"]) != id {
					next = append(next, item)
				}
			}
			data[store] = next
		}
		if err := writeDataUnlocked(data); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed."})
	}
}

func readJSONItem(r *http.Request) (map[string]any, error) {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 500<<20))
	if err != nil {
		return nil, err
	}
	item := map[string]any{}
	if err := json.Unmarshal(body, &item); err != nil {
		return nil, errors.New("Invalid JSON body.")
	}
	if fmt.Sprint(item["id"]) == "" || fmt.Sprint(item["id"]) == "<nil>" {
		return nil, errors.New("Item requires an id.")
	}
	return item, nil
}

func handleStatic(w http.ResponseWriter, r *http.Request) {
	requestPath := r.URL.Path
	if requestPath == "/" {
		requestPath = "/index.html"
	}
	cleanPath := filepath.Clean(strings.TrimPrefix(requestPath, "/"))
	if cleanPath == "." || strings.HasPrefix(cleanPath, "..") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	fullPath, err := filepath.Abs(cleanPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	root, err := os.Getwd()
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	root, _ = filepath.Abs(root)
	if fullPath != root && !strings.HasPrefix(fullPath, root+string(os.PathSeparator)) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if _, err := os.Stat(fullPath); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, fullPath)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("could not write json response: %v", err)
	}
}
