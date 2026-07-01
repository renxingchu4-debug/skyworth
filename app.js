const DB_NAME = "learning_lottery_platform";
const DB_VERSION = 5;
const stores = ["courses", "attempts", "surveys", "learningRecords", "redemptions", "users", "salesRecords", "mallItems"];
const LOCAL_DB_KEY = `${DB_NAME}__local_fallback_v1`;
const VIDEO_COMPLETE_POINTS = 20;
const CORRECT_QUIZ_POINTS = 30;
const SPECIALIZATIONS = [
  {
    id: "company",
    title: "1. Knowing SKYWORTH",
    description: "Brand and company basics.",
    cover: "./course-cover-1-knowing-skyworth.png"
  },
  {
    id: "tv-basics",
    title: "2. TV Basics",
    description: "Display and TV fundamentals.",
    cover: "./course-cover-2-tv-basic.png"
  },
  {
    id: "product-training",
    title: "3. Product Training",
    description: "Product features and selling points.",
    cover: "./course-cover-3-product-training.png"
  },
  {
    id: "tv-operations",
    title: "4. TV Operation Steps",
    description: "Setup and demo steps.",
    cover: "./course-cover-4-tv-operation-steps.png"
  },
  {
    id: "faq",
    title: "5. Frequently Asked Questions",
    description: "Common retail questions.",
    cover: "./course-cover-5-faq.png"
  }
];
const prizes = [
  { name: "50K", stock: 2, color: "#F59E0B", label: "50,000 Points" },
  { name: "200K", stock: 2, color: "#EF4444", label: "QLED TV" },
  { name: "Missed", stock: 25, color: "#94A3B8", label: "Missed" },
  { name: "Hand Fan", stock: 7, color: "#F97316", label: "Hand Fan" },
  { name: "Elec. Tooth Brush", stock: 2, color: "#3B82F6", label: "Electric Toothbrush" },
  { name: "Elec. Shaver", stock: 1, color: "#14B8A6", label: "Electric Shaver" },
  { name: "BT Earbuds", stock: 1, color: "#8B5CF6", label: "Bluetooth Earbuds" },
  { name: "Green Bag", stock: 1, color: "#22C55E", label: "Green Bag" },
  { name: "20K", stock: 24, color: "#06B6D4", label: "20,000 Points" }
];
const mallItems = [
  { id: "fan", name: "SKYWORTH Hand Fan", cost: 80, icon: "HF", description: "Portable fan for in-store work and outdoor demos." },
  { id: "bag", name: "Green Shopping Bag", cost: 100, icon: "GB", description: "Reusable SKYWORTH campaign tote bag." },
  { id: "earbuds", name: "BT Earbuds", cost: 180, icon: "BE", description: "Wireless earbuds for daily use." },
  { id: "brush", name: "Electric Tooth Brush", cost: 220, icon: "TB", description: "Compact electric toothbrush reward." },
  { id: "shaver", name: "Electric Shaver", cost: 260, icon: "ES", description: "Rechargeable shaver for top learners." },
  { id: "points20k", name: "20K Points", cost: 20000, icon: "20K", description: "Redeem 20,000 reward points." },
  { id: "points50k", name: "50K Points", cost: 50000, icon: "50K", description: "Redeem 50,000 reward points." },
  { id: "points100k", name: "100K Points", cost: 100000, icon: "100K", description: "Redeem 100,000 reward points." },
  { id: "points200k", name: "200K Points", cost: 200000, icon: "200K", description: "Redeem 200,000 reward points." }
];

// Province -> Stores mapping. Edit this object with your real data.
const PROVINCE_STORE_MAP = {
  "CENTRAL PROVINCE": ["KABWE", "KAPIRI 2", "MKUSHI", "MUMBWA", "SERENJE"],
  "COPPERBELT PROVINCE": ["CHILILABOMBWE", "CHINGOLA 2", "KASUMBALESA", "KITWE", "LUANSHYA", "MUFULIRA", "NDOLA A", "SOLWEZI"],
  "EASTERN PROVINCE": ["CHIPATA DT", "KAPATA", "KATETE", "LUNDAZI", "NYIMBA", "PETAUKE", "SINDA"],
  "LUSAKA PROVINCE": ["CAIRO RD", "CHACHACHA", "CHONGWE", "KAFUE", "LSK DWNTWN", "MANDAHILL", "RADIAN 3", "RETAIL PRK"],
  "NORTHERN PROVINCE": ["KASAMA", "LUWINGU", "MANSA1", "MPIKA"],
  "SOUTHERN PROVINCE": ["CHOMA 1", "CHOMA 2", "KALOMO", "MAZABUKA", "MONZE", "ZAMBEZI"],
  "WESTERN PROVINCE": ["KAOMA", "MONGU"]
};

// Admin credentials. Change these to your own account and password.
const ADMIN_ACCOUNT = "Cathy Chu";
const ADMIN_PASSWORD = "CRX123";

let db;
let currentSurveyId = null;
let spinning = false;
let wheelAngle = 0;
let _cachedSurveys = null; // cache for faster spin/side-button response
let adminAuthenticated = false;
let isDrawActive = false;
let currentProfile = null;
let activeSpecializationId = SPECIALIZATIONS[0].id;
let activeCourseId = "";
let dbReady = false;
let isLearningDetailOpen = false;
let questionDrafts = [];
const COURSE_DRAFT_KEY = "skyworth_course_draft";
let editingCourseId = "";
let editingMallItemId = "";
let useLocalStore = !("indexedDB" in window);
let introComplete = false;
const isDemoDrawRequest = new URLSearchParams(window.location.search).get("demo") === "draw";
let useServerStore = false;
let supabaseConnected = false; // true when server is using Supabase
const memoryStorage = new Map();

function safeStorageGet(key) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  } catch (error) {
    // Some file:// contexts block localStorage entirely, so fall back to memory.
  }
  return memoryStorage.get(key) || "";
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return;
  } catch (error) {
    // Ignore and use in-memory fallback.
  }
  memoryStorage.set(key, value);
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore and use in-memory fallback.
  }
  memoryStorage.delete(key);
}

const $ = (selector) => document.querySelector(selector);
const els = {
  introOverlay: $("#introOverlay"),
  registrationGate: $("#registrationGate"),
  appShell: $("#appShell"),
  registrationForm: $("#registrationForm"),
  registerButton: $("#registerButton"),
  registrationStatus: $("#registrationStatus"),
  registerName: $("#registerName"),
  registerProvince: $("#registerProvince"),
  registerStore: $("#registerStore"),
  switchUserButton: $("#switchUserButton"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  courseForm: $("#courseForm"),
  courseList: $("#courseList"),
  courseCatalogView: $("#courseCatalogView"),
  courseCatalogList: $("#courseCatalogList"),
  courseContentView: $("#courseContentView"),
  courseContentTitle: $("#courseContentTitle"),
  courseCount: $("#courseCount"),
  courseEditorTitle: $("#courseEditorTitle"),
  editingCourseId: $("#editingCourseId"),
  saveCourseButton: $("#saveCourseButton"),
  cancelEditButton: $("#cancelEditButton"),
  courseManagerList: $("#courseManagerList"),
  courseSaveStatus: $("#courseSaveStatus"),
  mallItemForm: $("#mallItemForm"),
  mallEditorTitle: $("#mallEditorTitle"),
  editingMallItemId: $("#editingMallItemId"),
  mallItemName: $("#mallItemName"),
  mallItemPhoto: $("#mallItemPhoto"),
  mallItemCost: $("#mallItemCost"),
  saveMallItemButton: $("#saveMallItemButton"),
  cancelMallEditButton: $("#cancelMallEditButton"),
  mallItemSaveStatus: $("#mallItemSaveStatus"),
  mallManagerList: $("#mallManagerList"),
  courseSpecialization: $("#courseSpecialization"),
  addQuestionButton: $("#addQuestionButton"),
  questionBuilder: $("#questionBuilder"),
  specializationOverview: $("#specializationOverview"),
  specializationDetail: $("#specializationDetail"),
  specializationGrid: $("#specializationGrid"),
  specializationTitle: $("#specializationTitle"),
  specializationDescription: $("#specializationDescription"),
  specializationCount: $("#specializationCount"),
  backToTracksButton: $("#backToTracksButton"),
  backToCatalogButton: $("#backToCatalogButton"),
  surveyForm: $("#surveyForm"),
  spinButton: $("#spinButton"),
  wheel: $("#wheelCanvas"),
  salesForm: $("#salesForm"),
  salesImage: $("#salesImage"),
  salesCameraImage: $("#salesCameraImage"),
  salesModel: $("#salesModel"),
  salesBarcode: $("#salesBarcode"),
  uploadAlbumButton: $("#uploadAlbumButton"),
  openCameraButton: $("#openCameraButton"),
  salesScanStatus: $("#salesScanStatus"),
  salesSaveStatus: $("#salesSaveStatus"),
  salesIdentityName: $("#salesIdentityName"),
  salesIdentityMeta: $("#salesIdentityMeta"),
  salesWeeklyCount: $("#salesWeeklyCount"),
  salesRanking: $("#salesRanking"),
  salesRecentTable: $("#salesRecentTable"),
  adminGate: $("#adminGate"),
  adminContent: $("#adminContent"),
  adminLoginForm: $("#adminLoginForm"),
  adminAccount: $("#adminAccount"),
  adminPassword: $("#adminPassword"),
  adminLoginStatus: $("#adminLoginStatus"),
  exportButton: $("#exportButton"),
  exportLearningBtn: $("#exportLearningBtn"),
  exportDrawBtn: $("#exportDrawBtn"),
  exportRedemptionBtn: $("#exportRedemptionBtn"),
  exportSalesBtn: $("#exportSalesBtn"),
  backupButton: $("#backupButton"),
  restoreButton: $("#restoreButton"),
  restoreInput: $("#restoreInput"),
  clearButton: $("#clearButton"),
  storageStats: $("#storageStats"),
  dbBarFill: $("#dbBarFill"),
  dbBarLabel: $("#dbBarLabel"),
  imgBarFill: $("#imgBarFill"),
  imgBarLabel: $("#imgBarLabel"),
  perTableActions: $("#perTableActions"),
  refreshStatsBtn: $("#refreshStatsBtn"),
  topPlayers: $("#topPlayers"),
  weeklyWinners: $("#weeklyWinners"),
  activeLearnerPoints: $("#activeLearnerPoints"),
  learnerVideoProgress: $("#learnerVideoProgress"),
  learnerQuizAccuracy: $("#learnerQuizAccuracy"),
  learnerCompletedVideos: $("#learnerCompletedVideos"),
  mallGrid: $("#mallGrid"),
  mallLearnerName: $("#mallLearnerName"),
  mallPoints: $("#mallPoints"),
  currentUserName: $("#currentUserName"),
  currentUserMeta: $("#currentUserMeta"),
  learningIdentityName: $("#learningIdentityName"),
  learningIdentityMeta: $("#learningIdentityMeta"),
  surveyIdentityName: $("#surveyIdentityName"),
  surveyIdentityMeta: $("#surveyIdentityMeta"),
  learnIdentityName: $("#learnIdentityName"),
  learnIdentityMeta: $("#learnIdentityMeta"),
  learnProfileInitial: $("#learnProfileInitial"),
  surveyProfileInitial: $("#surveyProfileInitial"),
  mallIdentityName: $("#mallIdentityName"),
  mallIdentityMeta: $("#mallIdentityMeta"),
  mallProfileInitial: $("#mallProfileInitial"),
  mallPointsDisplay: $("#mallPointsDisplay"),
  statUsers: $("#statUsers"),
  statSalesRecords: $("#statSalesRecords"),
  userTable: $("#userTable"),
  learningTable: $("#learningTable"),
  redemptionTable: $("#redemptionTable"),
  salesRecordTable: $("#salesRecordTable")
};

function openDb() {
  if (!("indexedDB" in window)) {
    useLocalStore = true;
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      stores.forEach((store) => {
        if (!nextDb.objectStoreNames.contains(store)) {
          nextDb.createObjectStore(store, { keyPath: "id" });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("IndexedDB unavailable, falling back to browser storage.", request.error);
      useLocalStore = true;
      resolve(null);
    };
  });
}

async function openServerStore() {
  if (window.location.protocol === "file:") return false;
  try {
    const response = await fetch("./api/health", { cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json();
    useServerStore = Boolean(payload?.persisted);
    supabaseConnected = Boolean(payload?.supabaseConnected);
    return useServerStore;
  } catch (error) {
    useServerStore = false;
    supabaseConnected = false;
    return false;
  }
}

async function serverRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    let message = `Server request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch (error) {
      // Keep the generic message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

function tx(store, mode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

function createEmptyLocalDb() {
  return stores.reduce((acc, store) => {
    acc[store] = [];
    return acc;
  }, {});
}

function readLocalDb() {
  try {
    const raw = safeStorageGet(LOCAL_DB_KEY);
    const parsed = raw ? JSON.parse(raw) : createEmptyLocalDb();
    stores.forEach((store) => {
      if (!Array.isArray(parsed[store])) parsed[store] = [];
    });
    return parsed;
  } catch (error) {
    console.warn("Local fallback storage could not be read. Resetting it.", error);
    return createEmptyLocalDb();
  }
}

function writeLocalDb(data) {
  safeStorageSet(LOCAL_DB_KEY, JSON.stringify(data));
}

function serializeForLocal(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(serializeForLocal);
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      __blobPlaceholder: true,
      name: value.name || "",
      type: value.type || "application/octet-stream",
      size: value.size || 0
    };
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeForLocal(item)]));
  }
  return value;
}

function getAll(store) {
  if (useServerStore) {
    return serverRequest(`./api/stores/${encodeURIComponent(store)}`);
  }
  if (useLocalStore) {
    const data = readLocalDb();
    return Promise.resolve([...(data[store] || [])]);
  }
  return new Promise((resolve, reject) => {
    const request = tx(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getById(store, id) {
  if (useServerStore) {
    return serverRequest(`./api/stores/${encodeURIComponent(store)}/${encodeURIComponent(id)}`);
  }
  if (useLocalStore) {
    const data = readLocalDb();
    return Promise.resolve((data[store] || []).find((item) => item.id === id) || null);
  }
  return new Promise((resolve, reject) => {
    const request = tx(store).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function put(store, value) {
  if (useServerStore) {
    return serverRequest(`./api/stores/${encodeURIComponent(store)}`, {
      method: "POST",
      body: JSON.stringify(serializeForLocal(value))
    });
  }
  if (useLocalStore) {
    const data = readLocalDb();
    const nextValue = serializeForLocal(value);
    const items = [...(data[store] || [])];
    const index = items.findIndex((item) => item.id === nextValue.id);
    if (index >= 0) items[index] = nextValue;
    else items.push(nextValue);
    data[store] = items;
    writeLocalDb(data);
    return Promise.resolve(nextValue);
  }
  return new Promise((resolve, reject) => {
    const request = tx(store, "readwrite").put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function remove(store, id) {
  if (useServerStore) {
    return serverRequest(`./api/stores/${encodeURIComponent(store)}/${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => undefined);
  }
  if (useLocalStore) {
    const data = readLocalDb();
    data[store] = (data[store] || []).filter((item) => item.id !== id);
    writeLocalDb(data);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const request = tx(store, "readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clearStore(store) {
  if (useServerStore) {
    return serverRequest(`./api/stores/${encodeURIComponent(store)}`, { method: "DELETE" }).then(() => undefined);
  }
  if (useLocalStore) {
    const data = readLocalDb();
    data[store] = [];
    writeLocalDb(data);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const request = tx(store, "readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromIndexedDb(store) {
  if (!db || !("indexedDB" in window)) return [];
  return new Promise((resolve, reject) => {
    const request = tx(store).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function migrateIndexedDbToServerIfNeeded() {
  if (!useServerStore || !db) return;
  try {
    const serverCounts = await Promise.all(stores.map(async (storeName) => (await getAll(storeName)).length));
    const serverHasData = serverCounts.some((count) => count > 0);
    if (serverHasData) return;

    const localStoreItems = await Promise.all(stores.map((storeName) => getAllFromIndexedDb(storeName)));
    const localHasData = localStoreItems.some((items) => items.length > 0);
    if (!localHasData) return;

    for (let index = 0; index < stores.length; index += 1) {
      const storeName = stores[index];
      for (const item of localStoreItems[index]) {
        await put(storeName, reviveBackupValue(await serializeBackupValue(item)));
      }
    }
    console.info("Existing browser data was migrated to server storage.");
  } catch (error) {
    console.warn("Could not migrate browser data to server storage.", error);
  }
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const input = String(dataUrl || "");
  const commaIndex = input.indexOf(",");
  if (commaIndex < 0) return null;
  const header = input.slice(0, commaIndex);
  const body = input.slice(commaIndex + 1);
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// MAX_UPLOAD_BYTES: max decoded image size 500KB (~667KB in base64, well below DB write limits)
const MAX_UPLOAD_BYTES = 500 * 1024;

async function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = Math.min(img.width, maxWidth);
      const h = Math.round(img.height * (w / img.width));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob && blob.size < file.size) resolve(blob);
        else resolve(file);
      }, file.type || "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// Loop compress until image is under target size, or quality reaches minimum
async function compressToTarget(file, targetBytes, maxWidth) {
  let blob = file;
  let quality = 0.8;
  // First: resize to target width
  try { blob = await compressImage(blob, maxWidth, quality); } catch (_) {}
  // If still too large, progressively lower quality
  while (blob.size > targetBytes && quality > 0.15) {
    quality = Math.max(0.15, quality - 0.15);
    try { blob = await compressImage(blob, maxWidth, quality); } catch (_) { break; }
  }
  return blob;
}

async function uploadToStorage(base64Data, fileName) {
  try {
    const resp = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Data, fileName })
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || "Upload failed");
    return result.url;
  } catch (e) {
    console.warn("Upload to storage failed, falling back to base64:", e.message);
    return null;
  }
}

async function fileToStoredFile(file) {
  if (!file) return null;
  // Image files: upload + compress; non-image files (e.g. PDF): upload as-is
  if (file.type && file.type.startsWith("image/")) {
    return await imageToStoredFile(file);
  }
  // Non-image files (e.g. PDF): convert to base64, upload without compression
  try {
    const dataUrl = await blobToDataUrl(file);
    const uploadedUrl = await uploadToStorage(dataUrl, file.name);
    if (uploadedUrl) {
      return { name: file.name, type: file.type || "application/octet-stream", size: file.size, url: uploadedUrl };
    }
    return { name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl };
  } catch (e) {
    console.warn("Non-image file upload failed:", e.message);
    return null;
  }
}

async function imageToStoredFile(file) {
  // Client-side size check: reject files over 10MB
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image is too large. Please select an image under 10 MB.");
  }
  let processedFile = file;
  // Compress images larger than 300KB
  if (file.size > 300 * 1024) {
    try {
      processedFile = await compressToTarget(file, MAX_UPLOAD_BYTES, 1600);
    } catch (e) { /* fall back to original */ }
  }
  // Final safeguard: if still over limit, compress harder
  if (processedFile.size > MAX_UPLOAD_BYTES) {
    try {
      processedFile = await compressToTarget(processedFile, MAX_UPLOAD_BYTES, 1024);
    } catch (e) { /* keep current */ }
  }
  const dataUrl = await blobToDataUrl(processedFile);
  // Try uploading to Supabase Storage
  const uploadedUrl = await uploadToStorage(dataUrl, file.name);
  if (uploadedUrl) {
    return {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: processedFile.size,
      url: uploadedUrl
    };
  }
  // Fallback: store as dataUrl only (no duplicate in url field)
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: processedFile.size,
    dataUrl
  };
}

function fileUrl(storedFile) {
  if (!storedFile) return "";
  if (storedFile.url) return storedFile.url;
  if (storedFile.dataUrl) return storedFile.dataUrl;
  return storedFile.blob ? URL.createObjectURL(storedFile.blob) : "";
}

function restoreStoredFile(storedFile) {
  if (!storedFile) return null;
  // New format with url
  if (storedFile.url) {
    return {
      name: storedFile.name || "file",
      type: storedFile.type || "image/jpeg",
      size: storedFile.size || 0,
      url: storedFile.url
    };
  }
  // Legacy format with dataUrl/blob
  const blob = storedFile.blob || (storedFile.dataUrl ? dataUrlToBlob(storedFile.dataUrl) : null);
  if (!blob) return null;
  return {
    name: storedFile.name || "file",
    type: storedFile.type || blob.type || "application/octet-stream",
    size: storedFile.size || blob.size || 0,
    blob,
    dataUrl: storedFile.dataUrl || ""
  };
}

function restoreFileFields(item, fields = []) {
  if (!item) return item;
  const next = { ...item };
  fields.forEach((field) => {
    if (next[field]) {
      next[field] = restoreStoredFile(next[field]);
    }
  });
  return next;
}

async function serializeBackupValue(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return Promise.all(value.map(serializeBackupValue));
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      __storedBlob: true,
      name: value.name || "",
      type: value.type || "application/octet-stream",
      size: value.size || 0,
      dataUrl: await blobToDataUrl(value)
    };
  }
  if (typeof value === "object") {
    // New format: image with url from Supabase Storage
    if (value.url && value.name && !value.blob && !value.dataUrl) {
      return { name: value.name, type: value.type || "image/jpeg", size: value.size || 0, url: value.url };
    }
    if (value.blob instanceof Blob || value.dataUrl) {
      const dataUrl = value.dataUrl || await blobToDataUrl(value.blob);
      return {
        ...value,
        blob: null,
        dataUrl,
        type: value.type || dataUrl.match(/^data:([^;]+);base64,/)?.[1] || "application/octet-stream",
        size: value.size || value.blob?.size || 0
      };
    }
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await serializeBackupValue(item)]));
    return Object.fromEntries(entries);
  }
  return value;
}

function reviveBackupValue(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(reviveBackupValue);
  if (typeof value === "object") {
    // New format: image with url from Supabase Storage
    if (value.url && value.name && !value.blob && !value.dataUrl && !value.__storedBlob) {
      return { name: value.name, type: value.type || "image/jpeg", size: value.size || 0, url: value.url };
    }
    if (value.__storedBlob && value.dataUrl) {
      return {
        name: value.name || "file",
        type: value.type || "application/octet-stream",
        size: value.size || 0,
        dataUrl: value.dataUrl,
        blob: dataUrlToBlob(value.dataUrl)
      };
    }
    if (value.dataUrl && Object.prototype.hasOwnProperty.call(value, "blob")) {
      return {
        ...value,
        blob: dataUrlToBlob(value.dataUrl)
      };
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveBackupValue(item)]));
  }
  return value;
}

function showView(viewId) {
  if (viewId === "admin" && !adminAuthenticated) {
    if (els.adminGate) els.adminGate.style.display = "grid";
    if (els.adminContent) els.adminContent.style.display = "none";
  } else if (viewId === "admin" && adminAuthenticated) {
    if (els.adminGate) els.adminGate.style.display = "none";
    if (els.adminContent) els.adminContent.style.display = "";
  }
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === viewId));

  // Sync light navbar link highlights
  syncLightNavActive(viewId);

  if (viewId === "learn") renderCourses();
  if (viewId === "mall") renderMall();
  if (viewId === "survey") {
    // Pre-fetch surveys cache for faster spin/side-button response
    getAll("surveys").then(s => { _cachedSurveys = s; }).catch(() => {});
    renderPrizeWheel();
    updateWheelState();
    renderAdmin(); // This will update the lottery insights too
  }
  if (viewId === "sales") renderSalesRecords();
  if (viewId === "admin" && adminAuthenticated) renderAdmin();
}

function optionValue(label) {
  return document.querySelector(`#answer${label}`).value.trim();
}

function textValue(value) {
  return String(value || "").trim();
}

function normalizeAccountPart(value) {
  return textValue(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function makeAccountKey(name, province, store) {
  return [name, province, store]
    .map((part) => normalizeAccountPart(part).replace(/\s+/g, "-"))
    .join("__");
}

function makeUserId(name, province, store) {
  return makeAccountKey(name, province, store);
}

function normalizeProfile(profile) {
  const name = textValue(profile?.name);
  const province = textValue(profile?.province);
  const store = textValue(profile?.store);
  if (!name || !province || !store) return null;
  const accountKey = profile?.accountKey || makeAccountKey(name, province, store);
  return {
    id: profile?.id || makeUserId(name, province, store),
    accountKey,
    name,
    province,
    store,
    createdAt: profile?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function getStoredCurrentUserId() {
  return safeStorageGet("skyworth_current_user_id");
}

function setStoredCurrentUserId(id) {
  if (id) safeStorageSet("skyworth_current_user_id", id);
  else safeStorageRemove("skyworth_current_user_id");
}

function requireProfile() {
  if (currentProfile) return currentProfile;
  alert("Please register first.");
  return null;
}

function recordId(userId, courseId) {
  return `${userId}__${courseId}`;
}

function getSpecializationMeta(id) {
  return SPECIALIZATIONS.find((item) => item.id === id) || SPECIALIZATIONS[0];
}

function hasMaterial(course) {
  return Boolean(course.material);
}

function hasQuiz(course) {
  return getQuestionsForCourse(course).length > 0;
}

function questionId() {
  return `question_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createQuestionDraft(type = "single") {
  return {
    id: questionId(),
    type,
    prompt: "",
    options: type === "fill" || type === "audio" ? [] : ["", ""],
    correctAnswers: [],
    sampleAnswer: "",
    audioPromptLabel: ""
  };
}

function normalizeQuestions(questions = []) {
  return questions
    .map((question) => ({
      id: question.id || questionId(),
      type: question.type || "single",
      prompt: textValue(question.prompt),
      options: Array.isArray(question.options) ? question.options.map((item) => textValue(item)).filter(Boolean) : [],
      correctAnswers: Array.isArray(question.correctAnswers) ? question.correctAnswers.map((item) => textValue(item)).filter(Boolean) : [],
      sampleAnswer: textValue(question.sampleAnswer),
      audioPromptLabel: textValue(question.audioPromptLabel)
    }))
    .filter((question) => question.prompt);
}

function getQuestionsForCourse(course) {
  if (Array.isArray(course.questions) && course.questions.length) {
    return normalizeQuestions(course.questions);
  }

  if (course.question && course.options?.length && course.correct) {
    return normalizeQuestions([{
      id: questionId(),
      type: "single",
      prompt: course.question,
      options: course.options.map((option) => option.text),
      correctAnswers: [course.correct],
      sampleAnswer: "",
      audioPromptLabel: ""
    }]);
  }

  return [];
}

function toggleLearningDetail(open) {
  isLearningDetailOpen = open;
  if (els.specializationOverview) {
    els.specializationOverview.hidden = open;
    els.specializationOverview.style.display = open ? "none" : "block";
  }
  // New Learning page: toggle categories + continue section vs detail
  const categoriesSection = document.querySelector(".learn-categories-section");
  const continueSection = document.getElementById("learnContinueSection");
  if (categoriesSection) {
    categoriesSection.style.display = open ? "none" : "";
  }
  if (continueSection) {
    continueSection.style.display = open ? "none" : "";
  }
  if (els.specializationDetail) {
    els.specializationDetail.hidden = !open;
    els.specializationDetail.style.display = open ? "block" : "none";
  }
}

function toggleCourseContentView(open) {
  if (els.courseCatalogView) {
    els.courseCatalogView.hidden = open;
    els.courseCatalogView.style.display = open ? "none" : "block";
  }
  if (els.courseContentView) {
    els.courseContentView.hidden = !open;
    els.courseContentView.style.display = open ? "block" : "none";
  }
}

function renderQuestionBuilder() {
  if (!els.questionBuilder) return;
  if (!questionDrafts.length) {
    els.questionBuilder.className = "question-builder empty-question-builder";
    els.questionBuilder.textContent = "No questions yet.";
    return;
  }

  els.questionBuilder.className = "question-builder";
  els.questionBuilder.innerHTML = questionDrafts.map((question, index) => {
    const optionFields = question.type === "single" || question.type === "multiple" || question.type === "sorting"
      ? question.options.map((option, optionIndex) => `
          <label class="question-option-row">
            <span>Option ${optionIndex + 1}</span>
            <input type="text" data-action="option-text" data-question-id="${question.id}" data-option-index="${optionIndex}" value="${escapeHtml(option)}" />
          </label>
        `).join("")
      : "";

    const answerFields = question.type === "fill"
      ? `
        <label>
          <span>Accepted Answer</span>
          <input type="text" data-action="sample-answer" data-question-id="${question.id}" value="${escapeHtml(question.sampleAnswer)}" placeholder="Enter the expected answer" />
        </label>
      `
      : "";

    const audioFields = question.type === "audio"
      ? `
        <label>
          <span>Audio Prompt Notes</span>
          <input type="text" data-action="audio-prompt-label" data-question-id="${question.id}" value="${escapeHtml(question.audioPromptLabel)}" placeholder="Optional guidance for the learner" />
        </label>
        <p class="question-audio-name">No reference file is required. Learners will record by holding the microphone button.</p>
      `
      : "";

    const correctAnswerArea = question.type === "single" || question.type === "multiple"
      ? `
        <div class="question-correct-grid">
          <span>Correct Answer${question.type === "multiple" ? "s" : ""}</span>
          ${question.options.map((option, optionIndex) => `
            <label class="correct-choice">
              <input
                type="${question.type === "multiple" ? "checkbox" : "radio"}"
                name="correct-${question.id}"
                data-action="correct-answer"
                data-question-id="${question.id}"
                data-option-index="${optionIndex}"
                ${question.correctAnswers.includes(String(optionIndex)) ? "checked" : ""}
              />
              <span>Option ${optionIndex + 1}</span>
            </label>
          `).join("")}
        </div>
      `
      : "";

    const sortingAnswerArea = question.type === "sorting"
      ? `
        <div class="question-correct-grid">
          <span>Correct Order</span>
          <small>Arrange the options from top to bottom using the move buttons below.</small>
          <div class="sorting-admin-list">
            ${question.options.map((option, optionIndex) => `
              <div class="sorting-admin-item">
                <strong>${optionIndex + 1}.</strong>
                <span>${escapeHtml(option || `Option ${optionIndex + 1}`)}</span>
                <div class="sorting-admin-actions">
                  <button class="secondary-btn small-btn" type="button" data-action="move-option-up" data-question-id="${question.id}" data-option-index="${optionIndex}" ${optionIndex === 0 ? "disabled" : ""}>Up</button>
                  <button class="secondary-btn small-btn" type="button" data-action="move-option-down" data-question-id="${question.id}" data-option-index="${optionIndex}" ${optionIndex === question.options.length - 1 ? "disabled" : ""}>Down</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `
      : "";

    return `
      <article class="question-card-builder" data-question-id="${question.id}">
        <div class="panel-title compact-title">
          <h4>Question ${index + 1}</h4>
          <button class="danger-btn small-btn" type="button" data-action="remove-question" data-question-id="${question.id}">Remove</button>
        </div>
        <label>
          <span>Question Type</span>
          <select data-action="question-type" data-question-id="${question.id}">
            <option value="single" ${question.type === "single" ? "selected" : ""}>Single Choice</option>
            <option value="multiple" ${question.type === "multiple" ? "selected" : ""}>Multiple Choice</option>
            <option value="fill" ${question.type === "fill" ? "selected" : ""}>Fill in the Blank</option>
            <option value="sorting" ${question.type === "sorting" ? "selected" : ""}>Sorting</option>
            <option value="audio" ${question.type === "audio" ? "selected" : ""}>Audio Upload</option>
          </select>
        </label>
        <label>
          <span>Prompt</span>
          <textarea rows="3" data-action="prompt" data-question-id="${question.id}" placeholder="Enter the question prompt">${escapeHtml(question.prompt)}</textarea>
        </label>
        ${optionFields ? `<div class="question-option-grid">${optionFields}</div><button class="secondary-btn small-btn" type="button" data-action="add-option" data-question-id="${question.id}">Add Option</button>` : ""}
        ${correctAnswerArea}
        ${sortingAnswerArea}
        ${answerFields}
        ${audioFields}
      </article>
    `;
  }).join("");
}

function resetQuestionDrafts() {
  questionDrafts = [];
  renderQuestionBuilder();
  persistCourseDraft();
}

function updateQuestionDraft(questionIdValue, updater) {
  questionDrafts = questionDrafts.map((question) => {
    if (question.id !== questionIdValue) return question;
    return updater(question);
  });
  renderQuestionBuilder();
  persistCourseDraft();
}

function addQuestionDraft(type = "single") {
  questionDrafts = [...questionDrafts, createQuestionDraft(type)];
  renderQuestionBuilder();
  persistCourseDraft();
}

function parseQuestionDrafts() {
  return normalizeQuestions(questionDrafts).map((question) => {
    if (question.type === "single" || question.type === "multiple") {
      if (!question.options.length) {
        throw new Error(`Question "${question.prompt || "Untitled"}" needs at least one option.`);
      }
      if (!question.correctAnswers.length) {
        throw new Error(`Question "${question.prompt || "Untitled"}" needs a correct answer.`);
      }
    }

    if (question.type === "sorting" && question.options.length < 2) {
      throw new Error(`Question "${question.prompt || "Untitled"}" needs at least two options for sorting.`);
    }

    if (question.type === "fill" && !question.sampleAnswer) {
      throw new Error(`Question "${question.prompt || "Untitled"}" needs an accepted answer.`);
    }

    if (question.type === "sorting") {
      question.correctAnswers = question.options.map((_, index) => String(index));
    }

    return question;
  });
}

function getRecord(id) {
  return new Promise((resolve, reject) => {
    const request = tx("learningRecords").get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getLearningRecord(userProfile, course) {
  const profile = normalizeProfile(userProfile);
  if (!profile) {
    throw new Error("Cannot load learning records without a registered profile.");
  }
  const id = recordId(profile.id, course.id);
  return (await getRecord(id)) || {
    id,
    userId: profile.id,
    userName: profile.name,
    province: profile.province,
    store: profile.store,
    courseId: course.id,
    courseTitle: course.title,
    specializationId: course.specializationId || SPECIALIZATIONS[0].id,
    videoProgress: 0,
    videoCompleted: false,
    videoPointsAwarded: false,
    materialViewed: false,
    quizCompleted: false,
    quizAttempts: 0,
    quizCorrect: 0,
    pointsEarned: 0,
    updatedAt: new Date().toISOString()
  };
}

async function saveLearningRecord(record) {
  record.updatedAt = new Date().toISOString();
  await put("learningRecords", record);
  await refreshLearnerSummary();
  await renderAdmin();
}

async function getLearnerSummary(userProfile = currentProfile) {
  const profile = normalizeProfile(userProfile);
  if (!profile) {
    return {
      learner: "Not registered",
      province: "",
      store: "",
      available: 0,
      earned: 0,
      spent: 0,
      videoProgress: 0,
      accuracy: 0,
      completedVideos: 0
    };
  }
  const [records, redemptions] = await Promise.all([
    getAll("learningRecords"),
    getAll("redemptions")
  ]);
  const ownRecords = records.filter((item) => item.userId === profile.id);
  const earned = ownRecords.reduce((sum, item) => sum + (item.pointsEarned || 0), 0);
  const spent = redemptions
    .filter((item) => item.userId === profile.id)
    .reduce((sum, item) => sum + (item.cost || 0), 0);
  const videoProgress = ownRecords.length
    ? Math.round(ownRecords.reduce((sum, item) => sum + (item.videoProgress || 0), 0) / ownRecords.length)
    : 0;
  const attempts = ownRecords.reduce((sum, item) => sum + (item.quizAttempts || 0), 0);
  const correct = ownRecords.reduce((sum, item) => sum + (item.quizCorrect || 0), 0);
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
  const completedVideos = ownRecords.filter((item) => item.videoCompleted).length;
  return {
    learner: profile.name,
    province: profile.province,
    store: profile.store,
    userId: profile.id,
    available: Math.max(earned - spent, 0),
    earned,
    spent,
    videoProgress,
    accuracy,
    completedVideos
  };
}

async function refreshLearnerSummary() {
  const summary = await getLearnerSummary();
  const learnerName = summary.learner;
  const learnerMeta = summary.province && summary.store
    ? `${summary.province} Province • ${summary.store}`
    : "";
  const learnerInitial = learnerName ? learnerName.charAt(0).toUpperCase() : 'U';

  if (els.activeLearnerPoints) els.activeLearnerPoints.textContent = summary.available;
  if (els.learnerVideoProgress) els.learnerVideoProgress.textContent = `${summary.videoProgress}%`;
  if (els.learnerQuizAccuracy) els.learnerQuizAccuracy.textContent = `${summary.accuracy}%`;
  if (els.learnerCompletedVideos) els.learnerCompletedVideos.textContent = summary.completedVideos;
  if (els.mallLearnerName) els.mallLearnerName.textContent = learnerName;
  if (els.mallPoints) els.mallPoints.textContent = summary.available;
  if (els.currentUserName) els.currentUserName.textContent = learnerName;
  if (els.currentUserMeta) {
    els.currentUserMeta.textContent = summary.province && summary.store
      ? `${summary.province} Province • ${summary.store}`
      : "Register to unlock.";
  }
  if (els.learningIdentityName) els.learningIdentityName.textContent = learnerName;
  if (els.learningIdentityMeta) {
    els.learningIdentityMeta.textContent = summary.province && summary.store
      ? `${summary.province} Province • ${summary.store}`
      : "Register to start.";
  }
  // Learning profile bar
  if (els.learnIdentityName) els.learnIdentityName.textContent = learnerName;
  if (els.learnIdentityMeta) els.learnIdentityMeta.textContent = learnerMeta || "Register to start learning";
  if (els.learnProfileInitial) els.learnProfileInitial.textContent = learnerInitial;
  // Survey profile bar
  if (els.surveyIdentityName) els.surveyIdentityName.textContent = learnerName;
  if (els.surveyIdentityMeta) {
    els.surveyIdentityMeta.textContent = learnerMeta || "Register to submit";
  }
  if (els.surveyProfileInitial) els.surveyProfileInitial.textContent = learnerInitial;
  // Mall profile bar
  if (els.mallIdentityName) els.mallIdentityName.textContent = learnerName;
  if (els.mallIdentityMeta) els.mallIdentityMeta.textContent = learnerMeta || "Register to redeem rewards";
  if (els.mallProfileInitial) els.mallProfileInitial.textContent = learnerInitial;
  if (els.mallPointsDisplay) els.mallPointsDisplay.textContent = summary.available;
  // Sales profile bar
  if (els.salesIdentityName) els.salesIdentityName.textContent = learnerName;
  if (els.salesIdentityMeta) {
    els.salesIdentityMeta.textContent = learnerMeta || "Register to save records";
  }
  document.querySelectorAll(".student-name strong").forEach((node) => {
    node.textContent = learnerName;
  });
  updateTopbarAvatar();
  updateLearnWelcome();
}

async function saveUserProfile(profileInput) {
  const profile = normalizeProfile(profileInput);
  if (!profile) return null;
  const users = await getAll("users");
  const loaded = users.find((item) => item.id === profile.id || item.accountKey === profile.accountKey) || null;
  const payload = {
    ...loaded,
    ...profile,
    createdAt: loaded?.createdAt || profile.createdAt
  };
  await put("users", payload);
  return payload;
}

async function setCurrentProfile(profileInput) {
  const saved = await saveUserProfile(profileInput);
  if (!saved) return;
  currentProfile = saved;
  setStoredCurrentUserId(saved.accountKey || saved.id);
  showAppShell(true);
  showView("learn");
  await renderCourses();
  await refreshLearnerSummary();
  await renderMall();
  await renderSalesRecords();
}

function setRegistrationBusy(isBusy, label = "Start Learning") {
  if (!els.registerButton) return;
  els.registerButton.disabled = isBusy;
  els.registerButton.textContent = label;
}

function setRegistrationStatus(message, type = "idle") {
  if (!els.registrationStatus) return;
  els.registrationStatus.textContent = message;
  els.registrationStatus.dataset.state = type;
}

function setAdminLoginStatus(message, type = "idle") {
  if (!els.adminLoginStatus) return;
  els.adminLoginStatus.textContent = message;
  els.adminLoginStatus.dataset.state = type;
}

function handleAdminLogin(event) {
  event.preventDefault();
  const account = textValue(els.adminAccount?.value);
  const password = els.adminPassword?.value || "";
  if (!account || !password) {
    setAdminLoginStatus("Enter account and password.", "error");
    return;
  }
  if (account === ADMIN_ACCOUNT && password === ADMIN_PASSWORD) {
    adminAuthenticated = true;
    if (els.adminGate) els.adminGate.style.display = "none";
    if (els.adminContent) els.adminContent.style.display = "";
    els.adminLoginForm.reset();
    setAdminLoginStatus("", "idle");
    renderAdmin();
  } else {
    setAdminLoginStatus("Invalid credentials.", "error");
    if (els.adminPassword) els.adminPassword.value = "";
  }
}

function handleAdminLogout() {
  adminAuthenticated = false;
  if (els.adminGate) els.adminGate.style.display = "grid";
  if (els.adminContent) els.adminContent.style.display = "none";
}

function initProvinceSelect() {
  if (!els.registerProvince) return;
  // Populate province dropdown
  const provinces = Object.keys(PROVINCE_STORE_MAP).sort();
  els.registerProvince.innerHTML = '<option value="">Select your province</option>' +
    provinces.map((p) => `<option value="${p}">${p}</option>`).join("");

  // Province change -> update store dropdown
  els.registerProvince.addEventListener("change", () => {
    const province = els.registerProvince.value;
    els.registerStore.innerHTML = "";
    if (!province) {
      els.registerStore.disabled = true;
      els.registerStore.innerHTML = '<option value="">Select province first</option>';
      return;
    }
    const storeList = PROVINCE_STORE_MAP[province] || [];
    els.registerStore.disabled = false;
    els.registerStore.innerHTML = '<option value="">Select your store</option>' +
      storeList.map((s) => `<option value="${s}">${s}</option>`).join("");
  });
}

function setCourseSaveStatus(message, type = "idle") {
  if (!els.courseSaveStatus) return;
  els.courseSaveStatus.textContent = message;
  els.courseSaveStatus.dataset.state = type;
}

function setSalesScanStatus(message, type = "idle") {
  if (!els.salesScanStatus) return;
  els.salesScanStatus.textContent = message;
  els.salesScanStatus.dataset.state = type;
}

function setSalesSaveStatus(message, type = "idle") {
  if (!els.salesSaveStatus) return;
  els.salesSaveStatus.textContent = message;
  els.salesSaveStatus.dataset.state = type;
}

function setMallItemSaveStatus(message, type = "idle") {
  if (!els.mallItemSaveStatus) return;
  els.mallItemSaveStatus.textContent = message;
  els.mallItemSaveStatus.dataset.state = type;
}

function weekStartTimestamp() {
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function parseModelFromText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  // Match patterns like "Model: LWQ-48J001-E" or "Model:LWQ-48J001-E" or "MODEL LWQ-48J001-E"
  let match = normalized.match(/model\s*[:：]?\s*([a-z0-9]+(?:-[a-z0-9]+)+)/i);
  if (match) return match[1].toUpperCase();
  // Fallback: match standalone model-like patterns near "Model" keyword
  match = normalized.match(/model\s*[:：]?\s*([a-z0-9]{4,})/i);
  return match ? match[1].toUpperCase() : "";
}

function parseBarcodeFromText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  // Match barcode patterns like "DD625703-YLWY060050" - letters+digits with hyphens
  // Also match longer alphanumeric strings that look like serial/barcode numbers
  let match = normalized.match(/\b[a-z]{2,}\d{4,}[a-z0-9]*(-[a-z0-9]+)+\b/i);
  if (match) return match[0].toUpperCase();
  // Fallback: digits followed by letters and numbers with hyphens
  match = normalized.match(/\b\d{5,}[a-z0-9-]*-[a-z0-9-]+\b/i);
  if (match) return match[0].toUpperCase();
  // Fallback: any alphanumeric string with at least one letter and one digit, 6+ chars
  // This ensures we reject pure-numeric barcodes (like EAN/UPC)
  match = normalized.match(/\b(?=.*[a-z])(?=.*\d)[a-z0-9-]{6,}\b/i);
  return match ? match[0].toUpperCase() : "";
}

function isBarcodeAlphanumeric(value) {
  // A valid barcode must contain at least one letter AND at least one digit
  // Pure-numeric barcodes are incorrect (misdetected UPC/EAN from other labels)
  const cleaned = String(value || "").replace(/[\s-]/g, "");
  if (!cleaned) return false;
  const hasLetter = /[a-z]/i.test(cleaned);
  const hasDigit = /\d/.test(cleaned);
  return hasLetter && hasDigit;
}

function filterAlphanumericBarcodes(candidates) {
  // Only keep barcodes that contain both letters and digits
  // Reject pure-numeric results (wrong barcode scanned)
  return candidates.filter(isBarcodeAlphanumeric);
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function moveArrayItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function normalizeModelValue(value) {
  return textValue(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeBarcodeValue(value) {
  return textValue(value).replace(/\s+/g, "").toUpperCase();
}

async function getMallItems() {
  const savedItems = (await getAll("mallItems")).map((item) => restoreFileFields(item, ["image"]));
  // Merge defaults with saved items so new gifts always appear
  const defaults = mallItems.map((item) => ({
    ...item,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const merged = defaults.map((d) => {
    const existing = savedItems.find((s) => s.id === d.id);
    return existing || d;
  });
  // Save any new items that weren't in DB
  for (const item of merged) {
    if (!savedItems.find((s) => s.id === item.id)) {
      await put("mallItems", item);
    }
  }
  return merged.sort((a, b) => (a.updatedAt || a.createdAt || "").localeCompare(b.updatedAt || b.createdAt || ""));
}

function sanitizeDetectedPair(model, barcode) {
  return {
    model: normalizeModelValue(model),
    barcode: normalizeBarcodeValue(barcode)
  };
}

function drawImageToCanvas(imageBitmap) {
  const canvas = document.createElement("canvas");
  const maxWidth = 2200;
  const scale = Math.min(1, maxWidth / imageBitmap.width);
  canvas.width = Math.max(1, Math.round(imageBitmap.width * scale));
  canvas.height = Math.max(1, Math.round(imageBitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function enhanceLabelCanvas(sourceCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const contrasted = value > 168 ? 255 : 0;
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function detectTextWithNativeApi(source) {
  if (typeof window.TextDetector !== "function") return [];
  const detector = new window.TextDetector();
  const blocks = await detector.detect(source);
  return blocks
    .map((item) => textValue(item.rawValue))
    .filter(Boolean);
}

async function detectBarcodeWithNativeApi(source) {
  if (typeof window.BarcodeDetector !== "function") return [];
  const formats = ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "codabar", "itf"];
  const detector = new window.BarcodeDetector({ formats });
  const results = await detector.detect(source);
  return results
    .map((item) => textValue(item.rawValue))
    .filter(Boolean);
}

// Fallback OCR using Tesseract.js when native TextDetector is not available
let tesseractWorker = null;

async function getTesseractWorker() {
  if (tesseractWorker) return tesseractWorker;
  if (typeof Tesseract === "undefined") return null;
  tesseractWorker = await Tesseract.createWorker("eng", 1, {
    logger: () => {} // quiet
  });
  return tesseractWorker;
}

async function detectTextWithTesseract(canvas) {
  try {
    const worker = await getTesseractWorker();
    if (!worker) return [];
    const { data } = await worker.recognize(canvas);
    return (data.text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    console.warn("Tesseract OCR failed", error);
    return [];
  }
}

async function extractSalesDataFromFile(file) {
  if (!file) {
    throw new Error("Upload label image first.");
  }

  const imageBitmap = await createImageBitmap(file);
  try {
    const baseCanvas = drawImageToCanvas(imageBitmap);
    const enhancedCanvas = enhanceLabelCanvas(baseCanvas);

    const textCandidates = [];
    const barcodeCandidates = [];

    // Try native APIs first
    for (const source of [imageBitmap, baseCanvas, enhancedCanvas]) {
      try {
        textCandidates.push(...await detectTextWithNativeApi(source));
      } catch (error) {
        console.warn("Text detection skipped for one source", error);
      }
      try {
        barcodeCandidates.push(...await detectBarcodeWithNativeApi(source));
      } catch (error) {
        console.warn("Barcode detection skipped for one source", error);
      }
    }

    let mergedText = textCandidates.join("\n");

    // Fallback to Tesseract.js if native text detection returned nothing
    if (!mergedText) {
      const tessLines = await detectTextWithTesseract(enhancedCanvas);
      if (tessLines.length) {
        mergedText = tessLines.join("\n");
        // Try base canvas too
        const tessLines2 = await detectTextWithTesseract(baseCanvas);
        if (tessLines2.length) {
          mergedText = [...new Set([...tessLines, ...tessLines2])].join("\n");
        }
      }
    }

    const model = parseModelFromText(mergedText);

    // Filter barcode candidates: reject pure-numeric (misdetected EAN/UPC from other labels)
    const validBarcodeCandidates = filterAlphanumericBarcodes(barcodeCandidates);
    let barcode = parseBarcodeFromText([...validBarcodeCandidates, mergedText].join("\n"));

    // If no valid alphanumeric barcode found but native API found pure-numeric ones,
    // try harder with Tesseract to find the correct alphanumeric barcode
    if (!barcode && barcodeCandidates.length > 0 && validBarcodeCandidates.length === 0) {
      console.log("Pure-numeric barcode detected (likely wrong label). Trying Tesseract for alphanumeric barcode...");
      const tessLines = await detectTextWithTesseract(enhancedCanvas);
      if (tessLines.length) {
        barcode = parseBarcodeFromText(tessLines.join("\n"));
      }
      if (!barcode) {
        const tessLines2 = await detectTextWithTesseract(baseCanvas);
        if (tessLines2.length) {
          barcode = parseBarcodeFromText([...tessLines, ...tessLines2].join("\n"));
        }
      }
    }

    return sanitizeDetectedPair(model, barcode);
  } finally {
    imageBitmap.close();
  }
}

async function scanSalesImage() {
  const file = els.salesImage?.files?.[0] || els.salesCameraImage?.files?.[0];
  if (!file) {
    setSalesScanStatus("Upload or capture first.", "error");
    return;
  }

  try {
    setSalesScanStatus("Detecting...", "progress");
    showSalesSpinners();
    const detected = await withTimeout(
      extractSalesDataFromFile(file),
      20000,
      "Cannot recognize info. Please retake or reupload the image."
    );
    hideSalesSpinners();
    if (els.salesModel) {
      els.salesModel.value = detected.model || "";
    }
    if (els.salesBarcode) {
      els.salesBarcode.value = detected.barcode || "";
    }
    updateSalesSpinnersByValue();

    if (detected.model && detected.barcode) {
      setSalesScanStatus("Detected. Confirm and save.", "success");
    } else if (detected.model && !detected.barcode) {
      setSalesScanStatus("Model detected but no alphanumeric barcode found. Pure-numeric barcodes are not valid. Please scan the correct barcode.", "warning");
    } else {
      setSalesScanStatus("Cannot recognize info. Please retake or reupload.", "warning");
    }
  } catch (error) {
    console.error(error);
    hideSalesSpinners();
    const message = error?.message || "Cannot recognize info. Please retake or reupload.";
    if (els.salesModel) els.salesModel.value = "";
    if (els.salesBarcode) els.salesBarcode.value = "";
    updateSalesSpinnersByValue();
    setSalesScanStatus(message, "error");
  }
}

function showSalesSpinners() {
  const mSpinner = document.getElementById('salesModelSpinner');
  const bSpinner = document.getElementById('salesBarcodeSpinner');
  if (mSpinner) mSpinner.classList.add('is-loading');
  if (bSpinner) bSpinner.classList.add('is-loading');
}

function hideSalesSpinners() {
  const mSpinner = document.getElementById('salesModelSpinner');
  const bSpinner = document.getElementById('salesBarcodeSpinner');
  if (mSpinner) mSpinner.classList.remove('is-loading');
  if (bSpinner) bSpinner.classList.remove('is-loading');
}

function updateSalesSpinnersByValue() {
  const modelVal = els.salesModel?.value?.trim();
  const barcodeVal = els.salesBarcode?.value?.trim();
  const mSpinner = document.getElementById('salesModelSpinner');
  const bSpinner = document.getElementById('salesBarcodeSpinner');
  if (mSpinner) {
    if (modelVal) mSpinner.classList.remove('is-loading');
    else mSpinner.classList.add('is-loading');
  }
  if (bSpinner) {
    if (barcodeVal) bSpinner.classList.remove('is-loading');
    else bSpinner.classList.add('is-loading');
  }
}

async function saveSalesRecord(event) {
  event.preventDefault();
  const profile = requireProfile();
  if (!profile) return;

  const file = els.salesImage?.files?.[0] || els.salesCameraImage?.files?.[0];
  if (!file) {
    setSalesSaveStatus("Upload or capture before saving.", "error");
    return;
  }

  const model = normalizeModelValue(els.salesModel?.value);
  const barcodeNumber = normalizeBarcodeValue(els.salesBarcode?.value);

  if (!model || !barcodeNumber) {
    setSalesSaveStatus("Both Model and Barcode Number are required before saving.", "error");
    return;
  }

  const existingRecords = await getAll("salesRecords");
  const duplicate = existingRecords.find((item) => item.barcodeNumber === barcodeNumber);
  if (duplicate) {
    setSalesSaveStatus("This machine has already been recorded.", "warning");
    return;
  }

  try {
    setSalesSaveStatus("Saving sales record...", "progress");
    await put("salesRecords", {
      id: uid("sale"),
      userId: profile.id,
      userName: profile.name,
      province: profile.province,
      store: profile.store,
      model,
      barcodeNumber,
      image: await fileToStoredFile(file),
      createdAt: new Date().toISOString()
    });
    els.salesForm.reset();
    if (els.salesModel) els.salesModel.value = "";
    if (els.salesBarcode) els.salesBarcode.value = "";
    setSalesScanStatus("", "idle");
    setSalesSaveStatus("Saved.", "success");
    await renderSalesRecords();
    await renderAdmin();
  } catch (error) {
    console.error(error);
    setSalesSaveStatus(`Save failed: ${error.message || "Unknown error"}`, "error");
  }
}

async function renderSalesRecords() {
  if (!els.salesRanking || !els.salesRecentTable) return;
  const records = (await getAll("salesRecords")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const summary = await getLearnerSummary();

  if (els.salesIdentityName) els.salesIdentityName.textContent = summary.learner;
  if (els.salesIdentityMeta) {
    els.salesIdentityMeta.textContent = summary.province && summary.store
      ? `${summary.province} Province • ${summary.store}`
      : "Register to save records";
  }
  // Update profile avatar initial
  const profileInitial = document.getElementById('salesProfileInitial');
  if (profileInitial) {
    profileInitial.textContent = summary.learner ? summary.learner.charAt(0).toUpperCase() : 'U';
  }

  const weeklyStart = weekStartTimestamp();
  const weeklyOwnCount = currentProfile
    ? records.filter((item) => item.userId === currentProfile.id && new Date(item.createdAt).getTime() >= weeklyStart).length
    : 0;
  if (els.salesWeeklyCount) els.salesWeeklyCount.textContent = String(weeklyOwnCount);

  const sameStoreRecords = currentProfile
    ? records.filter((item) => item.store === currentProfile.store && new Date(item.createdAt).getTime() >= weeklyStart)
    : [];

  const rankingMap = sameStoreRecords.reduce((acc, item) => {
    acc[item.userName] = (acc[item.userName] || 0) + 1;
    return acc;
  }, {});

  const rankingRows = Object.entries(rankingMap)
    .map(([name, count]) => [name, String(count)])
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]));

  // Ranking: show empty state or list
  if (rankingRows.length === 0 || !currentProfile) {
    els.salesRanking.innerHTML = `
      <div class="sales-empty-state">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#93a3c0" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="sales-empty-icon">
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M6 3h12v6a6 6 0 0 1-12 0V3z"/><path d="M9 21h6"/><path d="M12 15v6"/>
        </svg>
        <p class="sales-empty-title">No ranking data yet</p>
        <p class="sales-empty-desc">Ranking data will be shown here</p>
      </div>`;
  } else {
    const rankClass = (i) => {
      if (i === 0) return 'gold';
      if (i === 1) return 'silver';
      if (i === 2) return 'bronze';
      return 'normal';
    };
    els.salesRanking.innerHTML = `
      <div class="sales-table-wrap">
        ${rankingRows.map((row, i) => `
          <div class="sales-winner-item">
            <div class="sales-winner-rank ${rankClass(i)}">${i + 1}</div>
            <div class="sales-winner-info">
              <div class="sales-winner-name">${escapeHtml(row[0])}</div>
            </div>
            <div class="sales-winner-count"><strong>${row[1]}</strong> sales</div>
          </div>
        `).join('')}
      </div>`;
  }

  // Recent records: show empty state or table
  const recentRows = records
    .filter((item) => !currentProfile || item.store === currentProfile.store)
    .slice(0, 8)
    .map((item) => [
      formatTime(item.createdAt),
      item.userName,
      item.model,
      item.barcodeNumber
    ]);

  if (recentRows.length === 0 || !currentProfile) {
    els.salesRecentTable.innerHTML = `
      <div class="sales-empty-state">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#93a3c0" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="sales-empty-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
        <p class="sales-empty-title">No valid sales records yet</p>
        <p class="sales-empty-desc">Validated sales records will appear here</p>
      </div>`;
  } else {
    els.salesRecentTable.innerHTML = `
      <div class="sales-table-wrap">
        <table>
          <thead><tr><th>Time</th><th>User Name</th><th>Model</th><th>Barcode Number</th></tr></thead>
          <tbody>${recentRows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
  }
}

function serializeQuestionDrafts() {
  return questionDrafts.map((question) => ({
    ...question,
    audioPrompt: question.audioPrompt
      ? { name: question.audioPrompt.name, type: question.audioPrompt.type, size: question.audioPrompt.size }
      : null
  }));
}

function persistCourseDraft() {
  try {
    const draft = {
      specializationId: els.courseSpecialization?.value || "",
      title: $("#courseTitle")?.value || "",
      questionDrafts: serializeQuestionDrafts()
    };
    safeStorageSet(COURSE_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Could not persist course draft", error);
  }
}

function restoreCourseDraft() {
  try {
    const raw = safeStorageGet(COURSE_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (els.courseSpecialization && draft.specializationId) {
      els.courseSpecialization.value = draft.specializationId;
    }
    if ($("#courseTitle") && draft.title) {
      $("#courseTitle").value = draft.title;
    }
    if (Array.isArray(draft.questionDrafts) && draft.questionDrafts.length) {
      questionDrafts = draft.questionDrafts.map((question) => ({
        ...createQuestionDraft(question.type || "single"),
        ...question,
        id: question.id || questionId(),
        audioPrompt: null
      }));
      renderQuestionBuilder();
    }
  } catch (error) {
    console.warn("Could not restore course draft", error);
  }
}

function clearCourseDraft() {
  safeStorageRemove(COURSE_DRAFT_KEY);
}

function setCourseEditorMode(course = null) {
  editingCourseId = course?.id || "";
  if (els.editingCourseId) els.editingCourseId.value = editingCourseId;
  if (els.courseEditorTitle) {
    els.courseEditorTitle.textContent = editingCourseId ? "Edit Learning Content" : "Upload Learning Content";
  }
  if (els.saveCourseButton) {
    els.saveCourseButton.textContent = editingCourseId ? "Update Course" : "Save Course";
  }
  if (els.cancelEditButton) {
    els.cancelEditButton.hidden = !editingCourseId;
  }
}

function loadCourseIntoEditor(course) {
  setCourseEditorMode(course);
  els.courseSpecialization.value = course.specializationId || SPECIALIZATIONS[0].id;
  $("#courseTitle").value = course.title || "";
  questionDrafts = getQuestionsForCourse(course).map((question) => ({
    ...createQuestionDraft(question.type),
    ...question,
    id: question.id || questionId()
  }));
  renderQuestionBuilder();
  setCourseSaveStatus(`Editing: ${course.title}`, "progress");
  persistCourseDraft();
}

function resetCourseEditor() {
  els.courseForm.reset();
  setCourseEditorMode(null);
  resetQuestionDrafts();
  addQuestionDraft("single");
  clearCourseDraft();
  setCourseSaveStatus("", "idle");
}

function showAppShell(visible) {
  if (els.registrationGate) {
    els.registrationGate.hidden = false;
    els.registrationGate.style.display = visible ? "none" : "grid";
  }
  if (els.appShell) {
    els.appShell.hidden = false;
    els.appShell.style.display = visible ? "block" : "none";
    els.appShell.classList.toggle("is-locked", !visible);
    els.appShell.classList.toggle("is-visible", visible);
  }
}

function hideIntroOverlay() {
  if (!els.introOverlay) return;
  stopIntroParticles();
  els.introOverlay.classList.add("is-hidden");
  if (isDemoDrawRequest) {
    els.introOverlay.hidden = true;
    els.introOverlay.style.display = "none";
    return;
  }
  window.setTimeout(() => {
    els.introOverlay.hidden = true;
  }, 600);
}

function revealAfterIntro() {
  if (introComplete) return;
  introComplete = true;
  document.body.classList.remove("intro-playing");
  hideIntroOverlay();
  if (currentProfile) {
    showAppShell(true);
    return;
  }
  showAppShell(false);
  if (els.registrationGate) {
    // Wait a frame so the registration gate layout is ready for the reveal animation
    window.requestAnimationFrame(() => {
      els.registrationGate.classList.add("is-revealed");
    });
  }
}

function startIntroFlow() {
  document.body.classList.add("intro-playing");
  if (els.registrationGate) {
    els.registrationGate.classList.remove("is-revealed");
  }
  document.querySelectorAll(".intro-primary-button").forEach((button) => {
    button.addEventListener("click", revealAfterIntro);
  });
  initIntroParticles();
}

/* ── Canvas Particle System for Intro Background ── */
let introParticlesAnimationId = null;

function initIntroParticles() {
  const canvas = document.getElementById("introCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let particles = [];
  let w, h;

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    const count = Math.floor((w * h) / 6000);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.1,
        alpha: Math.random() * 0.6 + 0.2,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += 0.01;

      // Wrap around
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      const flicker = Math.sin(p.pulse) * 0.2 + 0.8;
      const alpha = p.alpha * flicker;

      // Draw glow halo
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(76,188,255,${alpha * 0.08})`;
      ctx.fill();

      // Draw particle dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${alpha})`;
      ctx.fill();
    }

    // Draw connecting lines for nearby particles
    ctx.strokeStyle = "rgba(180,210,240,0.07)";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = dx * dx + dy * dy;
        if (dist < 10000) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    introParticlesAnimationId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
}

function stopIntroParticles() {
  if (introParticlesAnimationId) {
    cancelAnimationFrame(introParticlesAnimationId);
    introParticlesAnimationId = null;
  }
  const canvas = document.getElementById("introCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

async function saveCourse(event) {
  event.preventDefault();
  try {
    setCourseSaveStatus("Saving course...", "progress");
    const hasVideoFile = Boolean($("#courseVideo").files[0]);
    const hasMaterialFile = Boolean($("#courseMaterial").files[0]);
    const questions = parseQuestionDrafts();
    if (!hasVideoFile && !hasMaterialFile && !questions.length) {
      setCourseSaveStatus("Upload at least one video, one file, or one question.", "error");
      return;
    }

    const existing = editingCourseId ? await getById("courses", editingCourseId) : null;
    const payload = {
      id: editingCourseId || uid("course"),
      specializationId: els.courseSpecialization.value,
      title: $("#courseTitle").value.trim(),
      video: await fileToStoredFile($("#courseVideo").files[0]),
      material: await fileToStoredFile($("#courseMaterial").files[0]),
      questions,
      question: "",
      options: [],
      correct: "",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      payload.video = payload.video || existing.video || null;
      payload.material = payload.material || existing.material || null;
    }

    await put("courses", payload);
    setCourseSaveStatus(`${editingCourseId ? "Updated" : "Saved"}: ${payload.title}`, "success");
    resetCourseEditor();
    await renderAll();
  } catch (error) {
    console.error(error);
    setCourseSaveStatus(`Save failed: ${error.message || "Unknown error"}`, "error");
  }
}

function renderSpecializationCards(courses, ownRecords) {
  els.specializationGrid.innerHTML = SPECIALIZATIONS.map((specialization) => {
    const scopedCourses = courses.filter((course) => (course.specializationId || SPECIALIZATIONS[0].id) === specialization.id);
    const scopedRecords = ownRecords.filter((record) => (record.specializationId || SPECIALIZATIONS[0].id) === specialization.id);
    const totalVideos = scopedCourses.filter((course) => Boolean(course.video)).length;
    const totalFiles = scopedCourses.filter((course) => hasMaterial(course)).length;
    const totalTests = scopedCourses.filter((course) => hasQuiz(course)).length;
    const completedVideos = scopedRecords.filter((record) => record.videoCompleted).length;
    const viewedFiles = scopedRecords.filter((record) => record.materialViewed).length;
    const completedTests = scopedRecords.filter((record) => record.quizCompleted).length;

    // Calculate real percentages from user's learning data
    const videoPct = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
    const filePct = totalFiles > 0 ? Math.round((viewedFiles / totalFiles) * 100) : 0;
    const testPct = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;

    return `
      <button class="specialization-card" type="button" data-specialization="${specialization.id}">
        <img class="specialization-cover" src="${escapeHtml(specialization.cover)}" alt="${escapeHtml(specialization.title)} cover" loading="lazy" />
        <span class="specialization-step">${escapeHtml(specialization.title)}</span>
        <div class="specialization-progress">
          <div class="learn-progress-track">
            <span class="learn-progress-label">Video</span>
            <div class="learn-progress-bar-wrap"><div class="learn-progress-bar-fill" style="width:${videoPct}%"></div></div>
            <span class="learn-progress-pct">${videoPct}%</span>
          </div>
          <div class="learn-progress-track">
            <span class="learn-progress-label">File</span>
            <div class="learn-progress-bar-wrap"><div class="learn-progress-bar-fill" style="width:${filePct}%"></div></div>
            <span class="learn-progress-pct">${filePct}%</span>
          </div>
          <div class="learn-progress-track">
            <span class="learn-progress-label">Test</span>
            <div class="learn-progress-bar-wrap"><div class="learn-progress-bar-fill" style="width:${testPct}%"></div></div>
            <span class="learn-progress-pct">${testPct}%</span>
          </div>
        </div>
      </button>
    `;
  }).join("");

  els.specializationGrid.querySelectorAll(".specialization-card").forEach((button) => {
    button.addEventListener("click", () => {
      activeSpecializationId = button.dataset.specialization;
      activeCourseId = "";
      toggleLearningDetail(true);
      toggleCourseContentView(false);
      renderCourses();
    });
  });

  // Update carousel arrows visibility
  updateCarouselArrows();
  // Update Continue Learning section
  updateContinueLearning(courses, ownRecords);
}

function buildCourseDirectoryCard(course, learningRecord) {
  const hasCourseMaterial = hasMaterial(course);
  const hasCourseQuiz = getQuestionsForCourse(course).length > 0;
  return `
    <button class="course-directory-card" type="button" data-course-id="${course.id}">
      <div class="course-directory-head">
        <strong>${escapeHtml(course.title)}</strong>
        <span class="status-pill">Open Content</span>
      </div>
      <div class="course-directory-progress">
        <span>Video (${learningRecord.videoCompleted ? 1 : 0}/${course.video ? 1 : 0})</span>
        <span>File (${learningRecord.materialViewed ? 1 : 0}/${hasCourseMaterial ? 1 : 0})</span>
        <span>Test (${learningRecord.quizCompleted ? 1 : 0}/${hasCourseQuiz ? 1 : 0})</span>
      </div>
    </button>
  `;
}

async function renderCourseContent(course) {
  if (!course || !currentProfile) return;
  course = restoreFileFields(course, ["video", "material"]);
  els.courseList.innerHTML = "";
  if (els.courseContentTitle) {
    els.courseContentTitle.textContent = course.title;
  }

  const template = $("#courseTemplate");
  let learningRecord = await getLearningRecord(currentProfile, course);
  const node = template.content.cloneNode(true);
  const media = node.querySelector(".course-media");
  const title = node.querySelector("h3");
  const material = node.querySelector(".material-link");
  const progressText = node.querySelector(".video-progress-text");
  const progressBar = node.querySelector(".video-progress-bar");
  const pointsEarned = node.querySelector(".points-earned");
  const questionStack = node.querySelector(".question-stack");
  const studentName = node.querySelector(".student-name strong");
  const openMaterial = node.querySelector(".open-material");
  const materialStatus = node.querySelector(".material-status");
  const testStatus = node.querySelector(".test-status");
  const hasCourseMaterial = hasMaterial(course);
  const questions = getQuestionsForCourse(course);
  const hasCourseQuiz = questions.length > 0;

  title.textContent = course.title;
  progressText.textContent = `${Math.round(learningRecord.videoProgress || 0)}%`;
  progressBar.value = Math.round(learningRecord.videoProgress || 0);
  pointsEarned.textContent = `${learningRecord.pointsEarned || 0} pts earned`;
  studentName.textContent = currentProfile.name;
  materialStatus.textContent = hasCourseMaterial
    ? learningRecord.materialViewed ? "File viewed" : "File not viewed"
    : "No file";
  testStatus.textContent = hasCourseQuiz
    ? learningRecord.quizCompleted ? "Test completed" : "Test pending"
    : "No test";

  if (course.video) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = fileUrl(course.video);
    let lastSavedProgress = Math.round(learningRecord.videoProgress || 0);
    const saveVideoProgress = async (forceComplete = false) => {
      if (!video.duration || !Number.isFinite(video.duration)) return;
      const progress = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
      if (!forceComplete && progress < lastSavedProgress + 5) return;
      lastSavedProgress = Math.max(lastSavedProgress, progress);
      const activeProfile = requireProfile();
      if (!activeProfile) return;
      learningRecord = await getLearningRecord(activeProfile, course);
      learningRecord.videoProgress = Math.max(learningRecord.videoProgress || 0, lastSavedProgress);
      if ((learningRecord.videoProgress >= 90 || forceComplete) && !learningRecord.videoPointsAwarded) {
        learningRecord.videoCompleted = true;
        learningRecord.videoProgress = 100;
        learningRecord.videoPointsAwarded = true;
        learningRecord.pointsEarned = (learningRecord.pointsEarned || 0) + VIDEO_COMPLETE_POINTS;
      }
      progressText.textContent = `${Math.round(learningRecord.videoProgress || 0)}%`;
      progressBar.value = Math.round(learningRecord.videoProgress || 0);
      pointsEarned.textContent = `${learningRecord.pointsEarned || 0} pts earned`;
      await saveLearningRecord(learningRecord);
    };
    video.addEventListener("timeupdate", () => saveVideoProgress(false));
    video.addEventListener("ended", () => saveVideoProgress(true));
    media.append(video);
  }

  if (course.material) {
    const link = document.createElement("a");
    link.href = fileUrl(course.material);
    link.download = course.material.name;
    link.textContent = `Download: ${course.material.name}`;
    material.append(link);
    openMaterial.disabled = false;
    openMaterial.addEventListener("click", async () => {
      const opened = window.open(link.href, "_blank", "noopener");
      if (!opened) link.click();
      const activeProfile = requireProfile();
      if (!activeProfile) return;
      learningRecord = await getLearningRecord(activeProfile, course);
      if (!learningRecord.materialViewed) {
        learningRecord.materialViewed = true;
        await saveLearningRecord(learningRecord);
      }
      materialStatus.textContent = "File viewed";
    });
  } else {
    material.textContent = "No material";
    openMaterial.disabled = true;
  }

  if (hasCourseQuiz) {
    questionStack.innerHTML = questions.map((question, index) => {
      if (question.type === "single" || question.type === "multiple") {
        return `
          <section class="question-render-card">
            <div class="question-render-head">
              <span class="status-pill">${question.type === "single" ? "Single Choice" : "Multiple Choice"}</span>
              <strong>Question ${index + 1}</strong>
            </div>
            <p class="question">${escapeHtml(question.prompt)}</p>
            <div class="choice-list">
              ${question.options.map((option, optionIndex) => `
                <label class="choice">
                  <input type="${question.type === "multiple" ? "checkbox" : "radio"}" name="${course.id}_${question.id}" value="${optionIndex}" />
                  <span>${escapeHtml(option)}</span>
                </label>
              `).join("")}
            </div>
            <button class="secondary-btn submit-question-answer" type="button" data-question-id="${question.id}">Submit Answer</button>
            <p class="answer-feedback" data-feedback-id="${question.id}"></p>
          </section>
        `;
      }

      if (question.type === "fill") {
        return `
          <section class="question-render-card">
            <div class="question-render-head">
              <span class="status-pill">Fill in the Blank</span>
              <strong>Question ${index + 1}</strong>
            </div>
            <p class="question">${escapeHtml(question.prompt)}</p>
            <input class="fill-answer-input" type="text" data-fill-question="${question.id}" placeholder="Enter your answer" />
            <button class="secondary-btn submit-fill-answer" type="button" data-question-id="${question.id}">Submit Answer</button>
            <p class="answer-feedback" data-feedback-id="${question.id}"></p>
          </section>
        `;
      }

      if (question.type === "sorting") {
        const shuffled = [...question.options]
          .map((option, optionIndex) => ({ option, optionIndex, sortKey: Math.random() }))
          .sort((a, b) => a.sortKey - b.sortKey);
        return `
          <section class="question-render-card">
            <div class="question-render-head">
              <span class="status-pill">Sorting</span>
              <strong>Question ${index + 1}</strong>
            </div>
            <p class="question">${escapeHtml(question.prompt)}</p>
            <div class="sorting-answer-list" data-sorting-question="${question.id}">
              ${shuffled.map((item, orderIndex) => `
                <div class="sorting-answer-item" data-original-index="${item.optionIndex}">
                  <strong class="sorting-order-label">${orderIndex + 1}</strong>
                  <span>${escapeHtml(item.option)}</span>
                  <div class="sorting-answer-actions">
                    <button class="secondary-btn small-btn sorting-move" type="button" data-direction="up" data-question-id="${question.id}" ${orderIndex === 0 ? "disabled" : ""}>Up</button>
                    <button class="secondary-btn small-btn sorting-move" type="button" data-direction="down" data-question-id="${question.id}" ${orderIndex === shuffled.length - 1 ? "disabled" : ""}>Down</button>
                  </div>
                </div>
              `).join("")}
            </div>
            <button class="secondary-btn submit-sorting-answer" type="button" data-question-id="${question.id}">Submit Answer</button>
            <p class="answer-feedback" data-feedback-id="${question.id}"></p>
          </section>
        `;
      }

      const audioTemplate = $("#audioQuestionTemplate");
      const wrap = document.createElement("div");
      wrap.append(audioTemplate.content.cloneNode(true));
      const section = wrap.firstElementChild;
      section.dataset.questionId = question.id;
      section.querySelector(".question-order").textContent = `Question ${index + 1}`;
      section.querySelector(".question").textContent = question.prompt;
      if (question.audioPromptLabel) {
        section.querySelector(".audio-hint").textContent = question.audioPromptLabel;
      }
      return section.outerHTML;
    }).join("");
  } else {
    questionStack.innerHTML = `<div class="choice muted-choice">No test content has been uploaded for this item.</div>`;
  }

  const refreshSortingControls = (container) => {
    const items = Array.from(container.querySelectorAll(".sorting-answer-item"));
    items.forEach((item, itemIndex) => {
      const label = item.querySelector(".sorting-order-label");
      if (label) label.textContent = String(itemIndex + 1);
      const upButton = item.querySelector('[data-direction="up"]');
      const downButton = item.querySelector('[data-direction="down"]');
      if (upButton) upButton.disabled = itemIndex === 0;
      if (downButton) downButton.disabled = itemIndex === items.length - 1;
    });
  };

  questionStack.querySelectorAll(".sorting-answer-list").forEach((container) => {
    refreshSortingControls(container);
  });

  questionStack.querySelectorAll(".sorting-move").forEach((button) => {
    button.addEventListener("click", () => {
      const list = button.closest(".sorting-answer-list");
      const item = button.closest(".sorting-answer-item");
      if (!list || !item) return;
      const items = Array.from(list.querySelectorAll(".sorting-answer-item"));
      const currentIndex = items.indexOf(item);
      const nextIndex = button.dataset.direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= items.length) return;
      const reordered = moveArrayItem(items, currentIndex, nextIndex);
      list.innerHTML = "";
      reordered.forEach((node) => list.append(node));
      refreshSortingControls(list);
    });
  });

  questionStack.querySelectorAll(".submit-question-answer, .submit-fill-answer, .submit-sorting-answer").forEach((button) => {
    button.addEventListener("click", async () => {
      const activeProfile = requireProfile();
      if (!activeProfile) return;
      const question = questions.find((item) => item.id === button.dataset.questionId);
      const feedback = questionStack.querySelector(`[data-feedback-id="${button.dataset.questionId}"]`);
      if (!question || !feedback) return;

      let passed = false;
      let answerText = "";

      if (question.type === "single") {
        const selected = questionStack.querySelector(`input[name="${course.id}_${question.id}"]:checked`);
        if (!selected) {
          feedback.textContent = "Choose one answer.";
          feedback.style.color = "#c75542";
          return;
        }
        answerText = selected.value;
        passed = question.correctAnswers.includes(selected.value);
      } else if (question.type === "multiple") {
        const selected = Array.from(questionStack.querySelectorAll(`input[name="${course.id}_${question.id}"]:checked`)).map((input) => input.value).sort();
        if (!selected.length) {
          feedback.textContent = "Choose at least one answer.";
          feedback.style.color = "#c75542";
          return;
        }
        answerText = selected.join("|");
        passed = selected.join("|") === [...question.correctAnswers].sort().join("|");
      } else if (question.type === "fill") {
        const input = questionStack.querySelector(`[data-fill-question="${question.id}"]`);
        answerText = textValue(input?.value);
        if (!answerText) {
          feedback.textContent = "Enter your answer.";
          feedback.style.color = "#c75542";
          return;
        }
        passed = answerText.toLowerCase() === question.sampleAnswer.toLowerCase();
      } else if (question.type === "sorting") {
        const list = questionStack.querySelector(`[data-sorting-question="${question.id}"]`);
        const ordered = Array.from(list?.querySelectorAll(".sorting-answer-item") || []).map((item) => String(item.dataset.originalIndex));
        if (!ordered.length) {
          feedback.textContent = "Complete the order.";
          feedback.style.color = "#c75542";
          return;
        }
        answerText = ordered.join("|");
        passed = answerText === question.correctAnswers.join("|");
      }

      learningRecord = await getLearningRecord(activeProfile, course);
      learningRecord.quizAttempts = (learningRecord.quizAttempts || 0) + 1;
      learningRecord.quizCompleted = true;
      if (passed) {
        learningRecord.quizCorrect = (learningRecord.quizCorrect || 0) + 1;
        learningRecord.pointsEarned = (learningRecord.pointsEarned || 0) + CORRECT_QUIZ_POINTS;
      }

      await put("attempts", {
        id: uid("attempt"),
        userId: activeProfile.id,
        courseId: course.id,
        courseTitle: course.title,
        studentName: activeProfile.name,
        province: activeProfile.province,
        store: activeProfile.store,
        answer: answerText,
        correct: question.correctAnswers.join("|") || question.sampleAnswer || "Audio uploaded",
        passed,
        createdAt: new Date().toISOString()
      });

      await saveLearningRecord(learningRecord);
      pointsEarned.textContent = `${learningRecord.pointsEarned || 0} pts earned`;
      feedback.textContent = passed
        ? `Accepted. +${CORRECT_QUIZ_POINTS} points awarded.`
        : "Submitted. Check answer.";
      feedback.style.color = passed ? "#165a48" : "#c75542";
      testStatus.textContent = "Test completed";
    });
  });

  const audioResponses = new Map();
  questionStack.querySelectorAll(".question-render-card[data-question-id]").forEach((section) => {
    const question = questions.find((item) => item.id === section.dataset.questionId);
    if (!question || question.type !== "audio") return;
    const micButton = section.querySelector(".mic-button");
    const undoButton = section.querySelector(".undo-audio-button");
    const feedback = section.querySelector(".answer-feedback");
    let mediaRecorder = null;
    let stream = null;
    let chunks = [];

    const stopStream = () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
    };

    const finalizeAudio = async () => {
      if (!chunks.length) return;
      const blob = new Blob(chunks, { type: "audio/webm" });
      chunks = [];
      const storedFile = {
        name: `recording_${Date.now()}.webm`,
        type: blob.type || "audio/webm",
        size: blob.size,
        blob
      };
      audioResponses.set(question.id, storedFile);
      undoButton.disabled = false;
      feedback.textContent = "Audio recorded and saved. You can undo and record again.";
      feedback.style.color = "#165a48";

      const activeProfile = requireProfile();
      if (!activeProfile) return;
      learningRecord = await getLearningRecord(activeProfile, course);
      learningRecord.quizAttempts = (learningRecord.quizAttempts || 0) + 1;
      learningRecord.quizCompleted = true;
      learningRecord.quizCorrect = (learningRecord.quizCorrect || 0) + 1;
      learningRecord.pointsEarned = (learningRecord.pointsEarned || 0) + CORRECT_QUIZ_POINTS;
      await put("attempts", {
        id: uid("attempt"),
        userId: activeProfile.id,
        courseId: course.id,
        courseTitle: course.title,
        studentName: activeProfile.name,
        province: activeProfile.province,
        store: activeProfile.store,
        answer: storedFile.name,
        correct: "Audio recorded",
        passed: true,
        audioResponse: storedFile,
        createdAt: new Date().toISOString()
      });
      await saveLearningRecord(learningRecord);
      pointsEarned.textContent = `${learningRecord.pointsEarned || 0} pts earned`;
      testStatus.textContent = "Test completed";
    };

    const startRecording = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        });
        mediaRecorder.addEventListener("stop", async () => {
          stopStream();
          await finalizeAudio();
        });
        mediaRecorder.start();
        micButton.classList.add("is-recording");
        micButton.textContent = "Recording...";
        feedback.textContent = "Recording... release to save.";
        feedback.style.color = "#005bac";
      } catch (error) {
        console.error(error);
        feedback.textContent = "Microphone access failed. Try again.";
        feedback.style.color = "#c75542";
      }
    };

    const stopRecording = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        stopStream();
      }
      micButton.classList.remove("is-recording");
      micButton.textContent = "Hold to Record";
    };

    micButton.addEventListener("pointerdown", async (event) => {
      event.preventDefault();
      await startRecording();
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      micButton.addEventListener(eventName, (event) => {
        event.preventDefault();
        stopRecording();
      });
    });

    undoButton.addEventListener("click", () => {
      audioResponses.delete(question.id);
      undoButton.disabled = true;
      feedback.textContent = "Removed. Record again.";
      feedback.style.color = "#9a6700";
    });
  });

  els.courseList.append(node);
}

async function renderCourses() {
  const courses = (await getAll("courses")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (els.courseCount) els.courseCount.textContent = `${SPECIALIZATIONS.length} Tracks`;
  els.courseList.innerHTML = "";
  if (els.courseCatalogList) els.courseCatalogList.innerHTML = "";
  els.specializationGrid.innerHTML = "";

  if (!currentProfile) {
    renderSpecializationCards([], []);
    toggleLearningDetail(false);
    if (els.courseCatalogList) {
      els.courseCatalogList.textContent = "Register to start learning.";
      els.courseCatalogList.className = "course-catalog-list empty-state";
    }
    return;
  }

  const records = await getAll("learningRecords");
  const ownRecords = records.filter((item) => item.userId === currentProfile.id);
  renderSpecializationCards(courses, ownRecords);

  if (!isLearningDetailOpen) {
    toggleLearningDetail(false);
    return;
  }

  const selectedSpecialization = getSpecializationMeta(activeSpecializationId);
  const specializationCourses = courses.filter((course) => (course.specializationId || SPECIALIZATIONS[0].id) === activeSpecializationId);
  toggleLearningDetail(true);
  toggleCourseContentView(Boolean(activeCourseId));
  els.specializationTitle.textContent = selectedSpecialization.title;
  els.specializationDescription.textContent = selectedSpecialization.description;
  els.specializationCount.textContent = `${specializationCourses.length} ${specializationCourses.length === 1 ? "Item" : "Items"}`;
  if (els.courseCatalogList) {
    els.courseCatalogList.className = specializationCourses.length === 0 ? "course-catalog-list empty-state" : "course-catalog-list";
  }

  if (!specializationCourses.length) {
    if (els.courseCatalogList) {
      els.courseCatalogList.textContent = "No courses yet.";
    }
    activeCourseId = "";
    toggleCourseContentView(false);
    return;
  }

  const directoryCards = [];
  for (const course of specializationCourses) {
    const learningRecord = await getLearningRecord(currentProfile, course);
    directoryCards.push(buildCourseDirectoryCard(course, learningRecord));
  }

  if (els.courseCatalogList) {
    els.courseCatalogList.innerHTML = directoryCards.join("");
    els.courseCatalogList.querySelectorAll(".course-directory-card").forEach((button) => {
      button.addEventListener("click", async () => {
        activeCourseId = button.dataset.courseId;
        toggleCourseContentView(true);
        const selectedCourse = specializationCourses.find((course) => course.id === activeCourseId);
        await renderCourseContent(selectedCourse);
      });
    });
  }

  if (!activeCourseId) {
    toggleCourseContentView(false);
    return;
  }

  const selectedCourse = specializationCourses.find((course) => course.id === activeCourseId);
  if (!selectedCourse) {
    activeCourseId = "";
    toggleCourseContentView(false);
    return;
  }

  toggleCourseContentView(true);
  await renderCourseContent(selectedCourse);
}

/* ── Carousel arrow controls ── */
function initCarouselArrows() {
  const track = document.getElementById("learnCarouselTrack");
  const leftBtn = document.getElementById("carouselLeft");
  const rightBtn = document.getElementById("carouselRight");
  if (!track || !leftBtn || !rightBtn) return;

  const scrollAmount = 280;

  leftBtn.addEventListener("click", () => {
    track.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  });

  rightBtn.addEventListener("click", () => {
    track.scrollBy({ left: scrollAmount, behavior: "smooth" });
  });

  track.addEventListener("scroll", updateCarouselArrows);
  window.addEventListener("resize", updateCarouselArrows);
}

function updateCarouselArrows() {
  const track = document.getElementById("learnCarouselTrack");
  const leftBtn = document.getElementById("carouselLeft");
  const rightBtn = document.getElementById("carouselRight");
  if (!track) return;

  if (leftBtn) {
    leftBtn.disabled = track.scrollLeft <= 2;
  }
  if (rightBtn) {
    const maxScroll = track.scrollWidth - track.clientWidth;
    rightBtn.disabled = track.scrollLeft >= maxScroll - 2;
  }
}

/* ── Continue Learning section ── */
function updateContinueLearning(courses, ownRecords) {
  const section = document.getElementById("learnContinueSection");
  const titleEl = document.getElementById("continueCourseTitle");
  const fillEl = document.getElementById("continueProgressFill");
  const textEl = document.getElementById("continueProgressText");
  const btnEl = document.getElementById("continueBtn");
  if (!section || !titleEl || !fillEl || !textEl || !btnEl) return;

  // Find the course with the most progress for "Continue Learning"
  let bestRecord = null;
  let bestCourse = null;
  let bestProgress = -1;

  for (const record of ownRecords) {
    if (record.quizCompleted) continue; // skip fully completed
    const course = courses.find((c) => c.id === record.courseId);
    if (!course) continue;
    // Calculate aggregate progress: average of video/file/test
    const hasVid = Boolean(course.video);
    const hasFile = hasMaterial(course);
    const hasQuiz = hasQuiz(course);
    let totalTracks = 0;
    let trackSum = 0;
    if (hasVid) { totalTracks++; trackSum += record.videoCompleted ? 100 : (record.videoProgress || 0); }
    if (hasFile) { totalTracks++; trackSum += record.materialViewed ? 100 : 0; }
    if (hasQuiz) { totalTracks++; trackSum += record.quizCompleted ? 100 : 0; }
    const agg = totalTracks > 0 ? Math.round(trackSum / totalTracks) : 0;
    if (agg > bestProgress) {
      bestProgress = agg;
      bestRecord = record;
      bestCourse = course;
    }
  }

  if (bestCourse && bestRecord && bestProgress > 0) {
    section.style.display = "block";
    titleEl.textContent = bestCourse.title || "Continue your course";
    fillEl.style.width = bestProgress + "%";
    textEl.textContent = bestProgress + "%";
    btnEl.onclick = () => {
      activeSpecializationId = bestCourse.specializationId || SPECIALIZATIONS[0].id;
      activeCourseId = bestCourse.id;
      toggleLearningDetail(true);
      toggleCourseContentView(true);
      renderCourses();
      // scroll to detail view
      const detailEl = document.getElementById("specializationDetail");
      if (detailEl) {
        detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
  } else {
    section.style.display = "none";
  }
}

/* ── Unified navigation bar ── */
function updateTopbarAvatar() {
  const avatarEl = document.getElementById("topbarAvatarInitial");
  if (!avatarEl) return;
  if (currentProfile && currentProfile.name) {
    avatarEl.textContent = currentProfile.name.charAt(0).toUpperCase();
  } else {
    avatarEl.textContent = "U";
  }
}

function initLearningNavLinks() {
  const navLinks = document.querySelectorAll(".topbar-nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const view = link.dataset.view;
      if (!view) return;
      showView(view);
    });
  });
}

function syncLightNavActive(viewId) {
  const navLinks = document.querySelectorAll(".topbar-nav-link");
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.view === viewId);
  });
}

/* ── Learning welcome message ── */
function updateLearnWelcome() {
  if (!els.learnIdentityName) return;
  if (currentProfile && currentProfile.name) {
    els.learnIdentityName.textContent = currentProfile.name;
  } else {
    els.learnIdentityName.textContent = "Not registered";
  }
}

async function saveSurvey(event) {
  event.preventDefault();
  const profile = requireProfile();
  if (!profile) return;
  const selectedModel = document.querySelector('input[name="surveyModel"]:checked');
  const submitBtn = document.querySelector(".draw-submit-btn");
  try {
    // Show submitting state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";
    }
    const receipt = await fileToStoredFile($("#surveyReceipt").files[0]);
    if (!receipt) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit Sales Record"; }
      alert("Failed to upload receipt. Please try again or select a different file.");
      return;
    }
    const survey = {
      id: uid("survey"),
      userId: profile.id,
      name: profile.name,
      province: profile.province,
      store: profile.store,
      model: selectedModel ? selectedModel.value : "",
      receipt,
      prize: "",
      createdAt: new Date().toISOString()
    };
    await put("surveys", survey);
    currentSurveyId = survey.id;
    isDrawActive = true;
    updateWheelState();
    els.surveyForm.reset();
    // Reset upload placeholder
    const placeholder = document.querySelector(".draw-upload-placeholder");
    if (placeholder) {
      placeholder.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Click to upload receipt image or PDF</span>`;
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit Sales Record"; }
    _cachedSurveys = null; // invalidate cache after new submission
    showToast("Submitted! 🎉 Click <strong>SPIN</strong> to draw your prize!", "success");
    await renderAdmin();
  } catch (e) {
    console.error("Survey submit error:", e);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit Sales Record"; }
    alert("Submit failed: " + (e.message || "Unknown error. Please try again."));
  }
}

function renderPrizeWheel() {
  const wheel = els.wheel;
  if (!wheel) return;
  // Wheel background, dividers, labels, and bulbs are all hardcoded in CSS/HTML.
  // This function only sets the rotation and updates the lock state.
  drawWheel(wheelAngle);
  updateWheelState();
}

function updateWheelState() {
  const spinBtn = els.spinButton;
  const wheelHint = document.getElementById("drawWheelHint");
  const drawStatusText = document.getElementById("surveyDrawStatusText");
  if (!spinBtn) return;

  // Center hub text
  const hubText = document.querySelector(".festive-hub-text");
  // Wheel segments locked appearance
  const wheelSegments = els.wheel;

  if (isDrawActive) {
    // Unlocked state
    spinBtn.disabled = false;
    spinBtn.textContent = "SPIN";
    if (hubText) hubText.textContent = "SPIN";
    if (wheelHint) wheelHint.innerHTML = '<span style="color:#16A34A;">🎉</span> Good luck! Spin the wheel to win rewards.';
    if (drawStatusText) drawStatusText.textContent = "Unlocked";
    if (wheelSegments) wheelSegments.style.filter = "none";
    // Scale animation on unlock
    if (spinBtn) {
      spinBtn.style.animation = 'none';
      spinBtn.offsetHeight; // trigger reflow
      spinBtn.style.animation = 'btnPulseGlow 1.8s ease-in-out infinite';
    }
  } else {
    // Locked state
    spinBtn.disabled = true;
    spinBtn.textContent = "Locked";
    spinBtn.title = "Submit sales record to unlock";
    if (hubText) hubText.textContent = "LOCKED";
    if (wheelHint) wheelHint.innerHTML = '🔒 Submit sales record to unlock Lucky Draw';
    if (drawStatusText) drawStatusText.textContent = "Locked";
    if (wheelSegments) wheelSegments.style.filter = "grayscale(0.15) brightness(0.9)";
    if (spinBtn) {
      spinBtn.style.animation = 'none';
    }
  }
  updateDrawChancesCount();
  updateWeeklyWinnersCard();
}

/* ── Left Card: Available Chances ── */
async function updateDrawChancesCount() {
  const countEl = document.getElementById("drawChancesCount");
  if (!countEl) return;
  if (isDrawActive) {
    countEl.textContent = "1";
    countEl.style.color = "#0f172a";
  } else {
    countEl.textContent = "0";
    countEl.style.color = "#0f172a";
  }
}

/* ── Right Card: Weekly's Winners ── */
async function updateWeeklyWinnersCard() {
  const listEl = document.getElementById("drawWeeklyWinnersList");
  if (!listEl) return;

  try {
    const surveys = await getAll("surveys");

    const winners = surveys
      .filter(s => s.prize && s.prizeAt && s.prize !== "Missed")
      .sort((a, b) => new Date(b.prizeAt) - new Date(a.prizeAt))
      .slice(0, 8);

    if (!winners.length) {
      listEl.innerHTML = '<div class="draw-winners-empty-new"><svg class="draw-winners-empty-gift" width="80" height="80" viewBox="0 0 80 80"><rect x="15" y="30" width="50" height="40" rx="4" fill="none" stroke="#94a3b8" stroke-width="1.8"/><path d="M15 30 L40 18 L65 30" fill="none" stroke="#94a3b8" stroke-width="1.8"/><path d="M40 18 L40 70" fill="none" stroke="#94a3b8" stroke-width="1.8"/><path d="M28 18 Q28 8 40 18 Q52 8 52 18" fill="none" stroke="#94a3b8" stroke-width="1.8"/><rect x="30" y="42" width="20" height="18" rx="2" fill="none" stroke="#94a3b8" stroke-width="1.2"/><line x1="40" y1="42" x2="40" y2="60" stroke="#94a3b8" stroke-width="1.2"/></svg><span class="draw-winners-empty-text">No winners yet</span></div>';
      return;
    }

    listEl.innerHTML = winners.map(w => {
      const prizeLabel = (prizes.find(p => p.name === w.prize) || {}).label || w.prize;
      return `<div class="draw-winner-item-new">
        <span class="draw-winner-name-new">${escapeHtml(w.name || "Anonymous")}</span>
        <span class="draw-winner-prize-new">${escapeHtml(prizeLabel)}</span>
      </div>`;
    }).join("");
  } catch {
    listEl.innerHTML = '<div class="draw-winners-empty-new"><span class="draw-winners-empty-text">No winners yet</span></div>';
  }
}

function showPrizeModal(prizeName) {
  const existing = document.querySelector(".prize-modal");
  if (existing) existing.remove();
  const isMissed = prizeName === "Missed";
  const modal = document.createElement("div");
  modal.className = "prize-modal";
  modal.innerHTML = `
    <div class="prize-modal-card ${isMissed ? "prize-modal-missed" : ""}">
      <span class="modal-star">${isMissed ? "😞" : "★"}</span>
      <h3>${isMissed ? "Sorry!" : "Congratulations!"}</h3>
      <p>${isMissed ? "Better luck next time!" : `You won <strong>${escapeHtml(prizeName)}</strong>`}</p>
      <button class="primary-btn" type="button">OK</button>
    </div>
  `;
  document.body.append(modal);
  modal.querySelector("button").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });
}

function drawWheel(rotation = wheelAngle) {
  wheelAngle = rotation;
  if (els.wheel) {
    els.wheel.style.transform = `rotate(${wheelAngle}deg)`;
  }
}

async function pickPrizeIndex() {
  // Use cache if available for instant response, otherwise fetch
  const surveys = _cachedSurveys || await getAll("surveys");
  const used = surveys.reduce((totals, item) => {
    if (item.prize) totals[item.prize] = (totals[item.prize] || 0) + 1;
    return totals;
  }, {});
  const weighted = prizes.flatMap((prize, index) => {
    const remaining = Math.max(prize.stock - (used[prize.name] || 0), 0);
    return Array.from({ length: remaining }, () => index);
  });

  if (!weighted.length) {
    return prizes.findIndex((prize) => prize.name === "Missed");
  }

  return weighted[Math.floor(Math.random() * weighted.length)];
}

async function spinWheel() {
  if (!isDrawActive || !currentSurveyId) {
    alert("Please submit sales record first to unlock lucky draw");
    return;
  }
  if (spinning) return;
  spinning = true;

  const wheelHint = document.getElementById("drawWheelHint");
  if (wheelHint) wheelHint.textContent = "Spinning... Good luck!";

  const prizeIndex = await pickPrizeIndex();
  const count = prizes.length;
  const slice = 360 / count;

  // The pointer is at 12 o'clock (0° / top).
  const segmentAngle = prizeIndex * slice;
  const targetAngle = (360 - segmentAngle + 360) % 360;

  const randomOffset = (Math.random() - 0.5) * (slice * 0.6);
  const finalTarget = (targetAngle + randomOffset + 360) % 360;

  const extraRounds = 2 + Math.floor(Math.random() * 3);
  const currentNormalized = ((wheelAngle % 360) + 360) % 360;
  const deltaToTarget = ((finalTarget - currentNormalized) + 360) % 360;
  const totalRotation = extraRounds * 360 + deltaToTarget;

  const start = performance.now();
  const duration = 2000;
  const initial = wheelAngle;

  await new Promise((resolve) => {
    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      wheelAngle = initial + totalRotation * eased;
      drawWheel(wheelAngle);
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });

  // Show prize modal immediately — don't wait for DB save
  showPrizeModal(prizes[prizeIndex].label);

  // Save prize result in background
  const surveys = await getAll("surveys");
  const survey = surveys.find((item) => item.id === currentSurveyId);
  if (survey) {
    survey.prize = prizes[prizeIndex].name;
    survey.prizeAt = new Date().toISOString();
    await put("surveys", survey);
  }

  // Win flash on winning segment
  const wheelSegments = els.wheel;
  if (wheelSegments) {
    wheelSegments.classList.add("win-flash");
    setTimeout(() => {
      wheelSegments.classList.remove("win-flash");
    }, 1800);
  }

  // Pointer bounce animation on win
  const pointer = document.querySelector('.festive-pointer');
  if (pointer) {
    pointer.style.animation = 'pointerBounce 0.5s ease-out 3';
    setTimeout(() => {
      pointer.style.animation = '';
    }, 1500);
  }

  if (wheelHint) {
    wheelHint.textContent = "Your prize has been recorded. Submit again to play more!";
  }
  currentSurveyId = null;
  isDrawActive = false;
  spinning = false;
  updateWheelState();
  await renderAdmin();
}

async function redeemMallItem(itemId) {
  const item = (await getMallItems()).find((entry) => entry.id === itemId);
  if (!item) return;
  const profile = requireProfile();
  if (!profile) return;
  const summary = await getLearnerSummary();
  if (summary.available < item.cost) {
    alert("Not enough points for this gift.");
    return;
  }
  await put("redemptions", {
    id: uid("redeem"),
    userId: profile.id,
    userName: summary.learner,
    province: profile.province,
    store: profile.store,
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    createdAt: new Date().toISOString()
  });
  await refreshLearnerSummary();
  await renderMall();
  await renderAdmin();
}

async function renderMall() {
  if (!els.mallGrid) return;
  const summary = await getLearnerSummary();
  const items = (await getMallItems()).map((item) => restoreFileFields(item, ["image"]));
  // Show 8 rewards: 4 gifts + 4 point tiers
  const fixedOrder = ["bag", "brush", "earbuds", "fan", "points20k", "points50k", "points100k", "points200k"];
  const filteredItems = fixedOrder
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean);
  const pointsDisplay = document.getElementById("mallPointsDisplay");
  if (pointsDisplay) pointsDisplay.textContent = summary.available;
  els.mallGrid.innerHTML = filteredItems
    .map((item) => {
      const disabled = summary.available < item.cost ? "disabled" : "";
      const buttonText = summary.available < item.cost ? "Need Points" : "Redeem Now";
      // Format large point values with commas
      const costDisplay = item.cost >= 1000 ? item.cost.toLocaleString() : item.cost;
      return `
        <article class="mall-card">
          <div class="gift-photo">
            ${item.image
              ? `<img src="${fileUrl(item.image)}" alt="${escapeHtml(item.name)}" />`
              : `<span class="gift-icon">${escapeHtml(item.icon || "GF")}</span>`}
          </div>
          <h3>${escapeHtml(item.name)}</h3>
          <span class="mall-cost">${costDisplay} pts</span>
          <button class="redeem-button" data-item="${escapeHtml(item.id)}" ${disabled}>${buttonText}</button>
        </article>
      `;
    })
    .join("");
  els.mallGrid.querySelectorAll(".redeem-button").forEach((button) => {
    button.addEventListener("click", () => redeemMallItem(button.dataset.item));
  });
}

function table(headers, rows, emptyText) {
  if (!rows.length) return `<div class="empty-state">${emptyText}</div>`;
  const head = headers.map((item) => `<th>${item}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => {
    // If cell is already HTML (contains tags), render as-is; otherwise escape
    if (typeof cell === "string" && /<[a-zA-Z][^>]*>/.test(cell)) {
      return `<td>${cell}</td>`;
    }
    return `<td>${escapeHtml(cell)}</td>`;
  }).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", { hour12: false });
}

function displayPrize(prize) {
  const legacyPrizeNames = {
    "\u4e00\u7b49\u5956": "First Prize",
    "\u4e8c\u7b49\u5956": "Second Prize",
    "\u4e09\u7b49\u5956": "Third Prize",
    "\u53c2\u4e0e\u5956": "Participation Prize",
    "\u518d\u63a5\u518d\u5389": "Missed",
    "\u8d44\u6599\u793c\u5305": "Material Pack"
  };
  return legacyPrizeNames[prize] || prize || "Not drawn";
}

function renderCourseManager(courses) {
  if (!els.courseManagerList) return;
  if (!courses.length) {
    els.courseManagerList.className = "course-manager-list empty-state";
    els.courseManagerList.textContent = "No courses yet.";
    return;
  }

  els.courseManagerList.className = "course-manager-list";
  els.courseManagerList.innerHTML = courses
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    .map((course) => `
      <article class="course-manager-card">
        <div class="course-manager-meta">
          <strong>${escapeHtml(course.title)}</strong>
          <span>${escapeHtml(getSpecializationMeta(course.specializationId).title)}</span>
          <small>${getQuestionsForCourse(course).length} question(s)</small>
        </div>
        <div class="course-manager-actions">
          <button class="secondary-btn manage-edit" type="button" data-course-id="${course.id}">Edit</button>
          <button class="danger-btn manage-delete" type="button" data-course-id="${course.id}">Delete</button>
        </div>
      </article>
    `)
    .join("");

  els.courseManagerList.querySelectorAll(".manage-edit").forEach((button) => {
    button.addEventListener("click", async () => {
      const course = await getById("courses", button.dataset.courseId);
      if (course) {
        loadCourseIntoEditor(course);
        showView("admin");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  els.courseManagerList.querySelectorAll(".manage-delete").forEach((button) => {
    button.addEventListener("click", async () => {
      const course = await getById("courses", button.dataset.courseId);
      if (!course) return;
      if (!confirm(`Delete "${course.title}"?`)) return;
      await remove("courses", course.id);
      if (editingCourseId === course.id) {
        resetCourseEditor();
      }
      await renderAll();
    });
  });
}

function setMallEditorMode(item = null) {
  editingMallItemId = item?.id || "";
  if (els.editingMallItemId) els.editingMallItemId.value = editingMallItemId;
  if (els.mallEditorTitle) {
    els.mallEditorTitle.textContent = editingMallItemId ? "Edit Points Mall Gift" : "Edit Points Mall Gifts";
  }
  if (els.saveMallItemButton) {
    els.saveMallItemButton.textContent = editingMallItemId ? "Update Gift" : "Save Gift";
  }
  if (els.cancelMallEditButton) {
    els.cancelMallEditButton.hidden = !editingMallItemId;
  }
}

function resetMallItemEditor() {
  if (els.mallItemForm) els.mallItemForm.reset();
  setMallEditorMode(null);
  setMallItemSaveStatus("", "idle");
}

function loadMallItemIntoEditor(item) {
  setMallEditorMode(item);
  if (els.mallItemName) els.mallItemName.value = item.name || "";
  if (els.mallItemCost) els.mallItemCost.value = item.cost ?? "";
  setMallItemSaveStatus(`Editing: ${item.name}`, "progress");
}

async function saveMallItem(event) {
  event.preventDefault();
  try {
    setMallItemSaveStatus("Saving gift...", "progress");
    const existing = editingMallItemId ? await getById("mallItems", editingMallItemId) : null;
    const name = textValue(els.mallItemName?.value);
    const cost = Number(els.mallItemCost?.value);
    if (!name) {
      setMallItemSaveStatus("Gift name is required.", "error");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setMallItemSaveStatus("Required points must be 0 or more.", "error");
      return;
    }

    const payload = {
      id: editingMallItemId || uid("gift"),
      name,
      cost,
      image: (await fileToStoredFile(els.mallItemPhoto?.files?.[0])) || existing?.image || null,
      icon: textValue(name).slice(0, 2).toUpperCase() || "GF",
      description: existing?.description || "Custom gift managed by admin.",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await put("mallItems", payload);
    setMallItemSaveStatus(`${editingMallItemId ? "Updated" : "Saved"}: ${payload.name}`, "success");
    resetMallItemEditor();
    await renderMall();
    await renderAdmin();
  } catch (error) {
    console.error(error);
    setMallItemSaveStatus(`Save failed: ${error.message || "Unknown error"}`, "error");
  }
}

function renderMallManager(items) {
  if (!els.mallManagerList) return;
  if (!items.length) {
    els.mallManagerList.className = "course-manager-list empty-state";
    els.mallManagerList.textContent = "No gifts yet.";
    return;
  }

  els.mallManagerList.className = "course-manager-list";
  els.mallManagerList.innerHTML = items
    .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
    .map((item) => `
      <article class="mall-manager-card">
        <div class="mall-manager-media">
          ${item.image ? `<img src="${fileUrl(item.image)}" alt="${escapeHtml(item.name)}" />` : `<span>${escapeHtml(item.icon || "GF")}</span>`}
        </div>
        <div class="course-manager-meta">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.cost} pts</span>
        </div>
        <div class="course-manager-actions">
          <button class="secondary-btn mall-manage-edit" type="button" data-item-id="${item.id}">Edit</button>
          <button class="danger-btn mall-manage-delete" type="button" data-item-id="${item.id}">Delete</button>
        </div>
      </article>
    `)
    .join("");

  els.mallManagerList.querySelectorAll(".mall-manage-edit").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = await getById("mallItems", button.dataset.itemId);
      if (item) {
        loadMallItemIntoEditor(item);
        showView("admin");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  els.mallManagerList.querySelectorAll(".mall-manage-delete").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = await getById("mallItems", button.dataset.itemId);
      if (!item) return;
      if (!confirm(`Delete "${item.name}"?`)) return;
      await remove("mallItems", item.id);
      if (editingMallItemId === item.id) {
        resetMallItemEditor();
      }
      await renderMall();
      await renderAdmin();
    });
  });
}

function isGiftPrize(prize) {
  const shownPrize = displayPrize(prize);
  return Boolean(prize) && shownPrize !== "Missed";
}

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function renderLotteryInsights(surveys) {
  if (!els.topPlayers || !els.weeklyWinners) return;
  const completedDraws = surveys.filter((item) => item.prize);
  const totals = completedDraws.reduce((acc, item) => {
    const name = item.name || "Anonymous";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const topPlayers = Object.entries(totals)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);

  els.topPlayers.classList.toggle("empty-state", topPlayers.length === 0);
  els.topPlayers.classList.toggle("small-empty", topPlayers.length === 0);
  if (!topPlayers.length) {
    els.topPlayers.innerHTML = "No entries yet.";
  } else {
    const ordered = [
      topPlayers[1] || null,
      topPlayers[0] || null,
      topPlayers[2] || null
    ];
    els.topPlayers.innerHTML = `
      <div class="podium-stage">
        <div class="podium-column podium-column-second">
          <span class="podium-crown" aria-hidden="true">2</span>
          <div class="podium-base podium-base-second"></div>
          <div class="podium-plate">
            <span class="podium-name">${escapeHtml(ordered[0]?.name || "—")}</span>
            <span class="podium-count">${ordered[0] ? `${ordered[0].count} wins` : "—"}</span>
          </div>
        </div>
        <div class="podium-column podium-column-first">
          <span class="podium-crown podium-crown-first" aria-hidden="true">1</span>
          <div class="podium-base podium-base-first"></div>
          <div class="podium-plate">
            <span class="podium-name">${escapeHtml(ordered[1]?.name || "—")}</span>
            <span class="podium-count">${ordered[1] ? `${ordered[1].count} wins` : "—"}</span>
          </div>
        </div>
        <div class="podium-column podium-column-third">
          <span class="podium-crown" aria-hidden="true">3</span>
          <div class="podium-base podium-base-third"></div>
          <div class="podium-plate">
            <span class="podium-name">${escapeHtml(ordered[2]?.name || "—")}</span>
            <span class="podium-count">${ordered[2] ? `${ordered[2].count} wins` : "—"}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Monthly Winners - simple list: Name, Prize, Time
  const monthStart = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  })();
  const winnerEntries = surveys
    .filter((item) => isGiftPrize(item.prize))
    .filter((item) => new Date(item.prizeAt || item.createdAt).getTime() >= monthStart)
    .sort((a, b) => new Date(b.prizeAt || b.createdAt).getTime() - new Date(a.prizeAt || b.createdAt).getTime());

  if (!winnerEntries.length) {
    els.weeklyWinners.innerHTML = `<div class="empty-state">No gift winners recorded this month.</div>`;
  } else {
    els.weeklyWinners.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Prize</th><th>Time</th></tr></thead>
        <tbody>
          ${winnerEntries.map((item) => {
            const prizeLabel = prizes.find((p) => p.name === item.prize)?.label || item.prize;
            return `
              <tr>
                <td>${escapeHtml(item.name || "Anonymous")}</td>
                <td class="winner-prize">${escapeHtml(prizeLabel)}</td>
                <td>${timeAgo(item.prizeAt || item.createdAt)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }
}

async function renderAdmin() {
  const [users, courses, attempts, surveys, learningRecords, redemptions, salesRecords, pointsMallItems] = await Promise.all([
    getAll("users"),
    getAll("courses"),
    getAll("attempts"),
    getAll("surveys"),
    getAll("learningRecords"),
    getAll("redemptions"),
    getAll("salesRecords"),
    getMallItems()
  ]);
  const restoredCourses = courses.map((course) => restoreFileFields(course, ["video", "material"]));
  const restoredMallItems = pointsMallItems.map((item) => restoreFileFields(item, ["image"]));
  $("#statUsers").textContent = users.length;
  $("#statCourses").textContent = restoredCourses.length;
  $("#statAttempts").textContent = attempts.length;
  $("#statSurveys").textContent = surveys.length;
  if (els.statSalesRecords) els.statSalesRecords.textContent = salesRecords.length;
  $("#statWins").textContent = surveys.filter((item) => isGiftPrize(item.prize)).length;

  const userRows = users
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .map((item) => [
      item.name,
      item.province,
      item.store,
      formatTime(item.createdAt),
      formatTime(item.updatedAt)
    ]);

  const learningRows = learningRecords
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .map((item) => [
      item.userName,
      item.province || "",
      item.store || "",
      escapeHtml(item.userId || ""),
      getSpecializationMeta(item.specializationId).title,
      item.courseTitle,
      `${Math.round(item.videoProgress || 0)}%`,
      `${item.materialViewed ? "Viewed" : "Pending"}`,
      `${item.quizCompleted ? "Completed" : "Pending"}`,
      `${item.pointsEarned || 0}`
    ]);

  const redemptionRows = redemptions
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => [
      formatTime(item.createdAt),
      item.userName,
      item.province || "",
      item.store || "",
      escapeHtml(item.userId || ""),
      item.itemName,
      `${item.cost} pts`
    ]);

  const attemptRows = attempts
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => [
      formatTime(item.createdAt),
      item.studentName,
      item.province || "",
      item.store || "",
      item.courseTitle,
      item.answer,
      item.correct,
      item.passed ? "Correct" : "Incorrect"
    ]);

  const surveyRows = surveys
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => {
      const receiptDisplay = item.receipt
        ? (item.receipt.url || item.receipt.dataUrl
            ? `<a href="${item.receipt.url || item.receipt.dataUrl}" target="_blank" rel="noopener" title="View receipt">${escapeHtml(item.receipt.name || "Receipt")}</a>`
            : escapeHtml(item.receipt.name || "Uploaded"))
        : "";
      return [
        formatTime(item.createdAt),
        item.name,
        item.province || "",
        item.store || item.group || "",
        escapeHtml(item.userId || ""),
        item.model || item.satisfaction || "",
        receiptDisplay,
        displayPrize(item.prize)
      ];
    });

  const salesRows = salesRecords
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => [
      formatTime(item.createdAt),
      item.userName,
      item.province || "",
      item.store || "",
      escapeHtml(item.userId || ""),
      item.model || "",
      item.barcodeNumber || "",
      item.image ? (item.image.url || item.image.dataUrl
        ? `<a href="${item.image.url || item.image.dataUrl}" target="_blank" rel="noopener" title="View image">${escapeHtml(item.image.name || "Image")}</a>`
        : escapeHtml(item.image.name || "Uploaded")) : ""
    ]);

  $("#userTable").innerHTML = table(["Name", "Province", "Store", "Registered At", "Last Updated"], userRows, "No users yet.");
  $("#learningTable").innerHTML = table(["Learner", "Province", "Store", "User ID", "Specialized Course", "Course", "Video Progress", "File Status", "Test Status", "Points Earned"], learningRows, "No progress yet.");
  $("#redemptionTable").innerHTML = table(["Time", "Learner", "Province", "Store", "User ID", "Gift", "Cost"], redemptionRows, "No redemptions yet.");
  $("#attemptTable").innerHTML = table(["Time", "Learner", "Province", "Store", "Course", "Answer", "Correct Answer", "Result"], attemptRows, "No attempts yet.");
  if (els.salesRecordTable) {
    els.salesRecordTable.innerHTML = table(["Time", "User Name", "Province", "Store", "User ID", "Model", "Barcode Number", "Image"], salesRows, "No scans yet.");
  }
  $("#surveyTable").innerHTML = table(["Time", "Name", "Province", "Store", "User ID", "TV Model", "Receipt", "Prize"], surveyRows, "No sales yet.");
  renderCourseManager(restoredCourses);
  renderMallManager(restoredMallItems);
  renderLotteryInsights(surveys);
  refreshStorageStats();
  renderDashboards(users, surveys, learningRecords, redemptions, salesRecords);
}

// ── Dispatch status storage ──
const DISPATCH_KEY = "skyworth_dispatch_status";
function loadDispatchStatus() {
  try {
    const raw = localStorage.getItem(DISPATCH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveDispatchStatus(status) {
  localStorage.setItem(DISPATCH_KEY, JSON.stringify(status));
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function renderDashboards(users, surveys, learningRecords, redemptions, salesRecords) {
  const today = getTodayRange();
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  // ─── Dashboard 1: Today's Active Users ───
  const todayActiveUsers = users.filter(u => u.updatedAt && u.updatedAt >= today.start && u.updatedAt < today.end);
  const totalToday = todayActiveUsers.length;

  // Province breakdown
  const provinceMap = {};
  todayActiveUsers.forEach(u => {
    const p = u.province || "Unknown";
    provinceMap[p] = (provinceMap[p] || 0) + 1;
  });
  const provinceEntries = Object.entries(provinceMap).sort((a, b) => b[1] - a[1]);

  // Store breakdown
  const storeMap = {};
  todayActiveUsers.forEach(u => {
    const s = u.store || "Unknown";
    storeMap[s] = (storeMap[s] || 0) + 1;
  });
  const storeEntries = Object.entries(storeMap).sort((a, b) => b[1] - a[1]);

  const dashDateEl = document.getElementById("dashboardTodayDate");
  if (dashDateEl) dashDateEl.textContent = todayStr;

  const kpiRow = document.getElementById("dashActiveKpiRow");
  if (kpiRow) {
    kpiRow.innerHTML = `
      <div class="dash-kpi">
        <span class="dash-kpi-value">${totalToday}</span>
        <span class="dash-kpi-label">Active Today</span>
      </div>
      <div class="dash-kpi">
        <span class="dash-kpi-value">${provinceEntries.length}</span>
        <span class="dash-kpi-label">Provinces</span>
      </div>
      <div class="dash-kpi">
        <span class="dash-kpi-value">${storeEntries.length}</span>
        <span class="dash-kpi-label">Stores</span>
      </div>
    `;
  }

  const provEl = document.getElementById("dashProvinceBreakdown");
  if (provEl) {
    provEl.innerHTML = provinceEntries.length
      ? provinceEntries.map(([name, count]) => `<div class="dash-bar-item"><span class="dash-bar-label">${escapeHtml(name)}</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round(count / Math.max(...provinceEntries.map(e => e[1]))) * 100}%"></div></div><span class="dash-bar-value">${count}</span></div>`).join("")
      : `<div class="empty-state">No activity today</div>`;
  }

  const storeEl = document.getElementById("dashStoreBreakdown");
  if (storeEl) {
    storeEl.innerHTML = storeEntries.length
      ? storeEntries.map(([name, count]) => `<div class="dash-bar-item"><span class="dash-bar-label">${escapeHtml(name)}</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round(count / Math.max(...storeEntries.map(e => e[1]))) * 100}%"></div></div><span class="dash-bar-value">${count}</span></div>`).join("")
      : `<div class="empty-state">No activity today</div>`;
  }

  // ─── Dashboard 2: Lucky Draw Prize Dispatch ───
  const dispatchStatus = loadDispatchStatus();
  const giftWinners = surveys
    .filter(s => isGiftPrize(s.prize))
    .sort((a, b) => new Date(b.prizeAt || b.createdAt) - new Date(a.prizeAt || a.createdAt));

  const drawDispatchEl = document.getElementById("dashDrawDispatchTable");
  if (drawDispatchEl) {
    if (!giftWinners.length) {
      drawDispatchEl.innerHTML = `<div class="empty-state">No prize winners yet</div>`;
    } else {
      const rows = giftWinners.map(item => {
        const key = `draw_${item.id}`;
        const dispatched = dispatchStatus[key] === true;
        return [
          formatTime(item.prizeAt || item.createdAt),
          escapeHtml(item.name || ""),
          escapeHtml(item.province || ""),
          escapeHtml(item.store || item.group || ""),
          displayPrize(item.prize),
          dispatched
            ? `<span class="dispatch-badge dispatched">Dispatched</span>`
            : `<span class="dispatch-badge pending">Pending</span>`,
          `<button class="dispatch-toggle-btn" data-dispatch="${key}" data-state="${dispatched ? "1" : "0"}">${dispatched ? "Mark Pending" : "Mark Dispatched"}</button>`
        ];
      });
      drawDispatchEl.innerHTML = table(["Time", "Name", "Province", "Store", "Prize", "Status", "Action"], rows, "");
    }
  }

  // ─── Dashboard 3: Points Mall Redemption Dispatch ───
  const redEl = document.getElementById("dashRedemptionDispatchTable");
  if (redEl) {
    if (!redemptions.length) {
      redEl.innerHTML = `<div class="empty-state">No redemptions yet</div>`;
    } else {
      const sorted = [...redemptions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const rows = sorted.map(item => {
        const key = `redemption_${item.id}`;
        const dispatched = dispatchStatus[key] === true;
        return [
          formatTime(item.createdAt),
          escapeHtml(item.store || ""),
          escapeHtml(item.userId || ""),
          escapeHtml(item.itemName || ""),
          dispatched
            ? `<span class="dispatch-badge dispatched">Dispatched</span>`
            : `<span class="dispatch-badge pending">Pending</span>`,
          `<button class="dispatch-toggle-btn" data-dispatch="${key}" data-state="${dispatched ? "1" : "0"}">${dispatched ? "Mark Pending" : "Mark Dispatched"}</button>`
        ];
      });
      redEl.innerHTML = table(["Time", "Store", "User ID", "Gift", "Status", "Action"], rows, "");
    }
  }

  // ─── Dashboard 4: Today's Sales Dashboard ───
  const todaySales = salesRecords.filter(r => r.createdAt && r.createdAt >= today.start && r.createdAt < today.end);
  const totalSalesToday = todaySales.length;

  // By Model
  const modelMap = {};
  todaySales.forEach(r => {
    const m = r.model || "Unknown";
    modelMap[m] = (modelMap[m] || 0) + 1;
  });
  const modelEntries = Object.entries(modelMap).sort((a, b) => b[1] - a[1]);

  // By Province → Store (nested)
  const provStoreMap = {};
  todaySales.forEach(r => {
    const p = r.province || "Unknown";
    const s = r.store || "Unknown";
    if (!provStoreMap[p]) provStoreMap[p] = {};
    provStoreMap[p][s] = (provStoreMap[p][s] || 0) + 1;
  });

  const salesDateEl = document.getElementById("dashboardSalesDate");
  if (salesDateEl) salesDateEl.textContent = todayStr;

  const salesKpiRow = document.getElementById("dashSalesKpiRow");
  if (salesKpiRow) {
    salesKpiRow.innerHTML = `
      <div class="dash-kpi">
        <span class="dash-kpi-value">${totalSalesToday}</span>
        <span class="dash-kpi-label">Units Sold Today</span>
      </div>
      <div class="dash-kpi">
        <span class="dash-kpi-value">${modelEntries.length}</span>
        <span class="dash-kpi-label">SKUs Sold</span>
      </div>
    `;
  }

  const modelEl = document.getElementById("dashModelBreakdown");
  if (modelEl) {
    modelEl.innerHTML = modelEntries.length
      ? modelEntries.map(([name, count]) => `<div class="dash-bar-item"><span class="dash-bar-label">${escapeHtml(name)}</span><div class="dash-bar-track"><div class="dash-bar-fill dash-bar-fill-sales" style="width:${Math.round(count / Math.max(...modelEntries.map(e => e[1]))) * 100}%"></div></div><span class="dash-bar-value">${count}台</span></div>`).join("")
      : `<div class="empty-state">No sales today</div>`;
  }

  const provSalesEl = document.getElementById("dashProvinceStoreSales");
  if (provSalesEl) {
    const provList = Object.entries(provStoreMap).sort((a, b) => {
      const sumA = Object.values(a[1]).reduce((s, v) => s + v, 0);
      const sumB = Object.values(b[1]).reduce((s, v) => s + v, 0);
      return sumB - sumA;
    });
    if (!provList.length) {
      provSalesEl.innerHTML = `<div class="empty-state">No sales today</div>`;
    } else {
      let html = "";
      provList.forEach(([prov, stores]) => {
        const provTotal = Object.values(stores).reduce((s, v) => s + v, 0);
        html += `<div class="dash-group"><div class="dash-group-header"><strong>${escapeHtml(prov)}</strong><span class="dash-group-total">${provTotal}台</span></div>`;
        Object.entries(stores).sort((a, b) => b[1] - a[1]).forEach(([store, count]) => {
          html += `<div class="dash-bar-item dash-bar-item-sub"><span class="dash-bar-label">${escapeHtml(store)}</span><div class="dash-bar-track"><div class="dash-bar-fill dash-bar-fill-sales" style="width:${Math.round(count / Math.max(...Object.values(stores))) * 100}%"></div></div><span class="dash-bar-value">${count}台</span></div>`;
        });
        html += `</div>`;
      });
      provSalesEl.innerHTML = html;
    }
  }
}

async function renderAll() {
  await renderCourses();
  await renderSalesRecords();
  await renderAdmin();
  renderPrizeWheel();
  drawWheel(wheelAngle);
  const requestedView = new URLSearchParams(window.location.search).get("view");
  if (requestedView && document.getElementById(requestedView)) {
    showView(requestedView);
  }

  // Debounced resize handler for wheel re-render
  let wheelResizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(wheelResizeTimer);
    wheelResizeTimer = setTimeout(() => {
      const surveyView = document.getElementById("survey");
      if (surveyView && surveyView.classList.contains("is-active")) {
        renderPrizeWheel();
      }
    }, 250);
  });
}

async function applyDemoViewIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") !== "draw") return;
  currentProfile = currentProfile || {
    id: "demo_draw_user",
    name: "Demo User",
    province: "Demo Province",
    store: "Demo Store",
    accountKey: "demo_draw_user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  document.body.classList.remove("intro-playing");
  stopIntroParticles();
  if (els.introOverlay) {
    els.introOverlay.hidden = true;
    els.introOverlay.style.display = "none";
    els.introOverlay.classList.add("is-hidden");
  }
  showAppShell(true);
  await refreshLearnerSummary();
  showView(params.get("view") || "survey");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function exportCsv() {
  const [users, attempts, surveys, learningRecords, redemptions, salesRecords] = await Promise.all([
    getAll("users"),
    getAll("attempts"),
    getAll("surveys"),
    getAll("learningRecords"),
    getAll("redemptions"),
    getAll("salesRecords")
  ]);
  const lines = [
    "Type,Time,Name,Province,Store,Reference,Result,Notes",
    ...users.map((item) => [
      "User",
      formatTime(item.createdAt),
      item.name,
      item.province,
      item.store,
      "Registration",
      "Registered",
      `Updated: ${formatTime(item.updatedAt)}`
    ].map(csvEscape).join(",")),
    ...learningRecords.map((item) => [
      "Learning Progress",
      formatTime(item.updatedAt),
      item.userName,
      item.province || "",
      item.store || "",
      `${getSpecializationMeta(item.specializationId).title} / ${item.courseTitle}`,
      `${Math.round(item.videoProgress || 0)}% / ${item.pointsEarned || 0} pts`,
      `Video: ${item.videoCompleted ? "Yes" : "No"}, File: ${item.materialViewed ? "Yes" : "No"}, Test: ${item.quizCompleted ? "Yes" : "No"}`
    ].map(csvEscape).join(",")),
    ...attempts.map((item) => [
      "Quiz Attempt",
      formatTime(item.createdAt),
      item.studentName,
      item.province || "",
      item.store || "",
      item.courseTitle,
      item.passed ? "Correct" : "Incorrect",
      `Answer: ${item.answer}, Correct answer: ${item.correct}`
    ].map(csvEscape).join(",")),
    ...redemptions.map((item) => [
      "Redemption",
      formatTime(item.createdAt),
      item.userName,
      item.province || "",
      item.store || "",
      item.itemName,
      `${item.cost} pts`,
      ""
    ].map(csvEscape).join(",")),
    ...surveys.map((item) => [
      "Sales Record",
      formatTime(item.createdAt),
      item.name,
      item.province || "",
      item.store || item.group || "",
      item.model || item.satisfaction || "",
      displayPrize(item.prize),
      item.receipt ? item.receipt.name : ""
    ].map(csvEscape).join(",")),
    ...salesRecords.map((item) => [
      "Scanned Sales Record",
      formatTime(item.createdAt),
      item.userName,
      item.province || "",
      item.store || "",
      item.model || "",
      item.barcodeNumber || "",
      item.image ? item.image.name : ""
    ].map(csvEscape).join(","))
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `admin_data_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.join(","), ...rows.map(r => r.map(csvEscape).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ── Export 1: Learning Progress (all users) ──
async function exportLearning() {
  const [learningRecords, users] = await Promise.all([getAll("learningRecords"), getAll("users")]);
  const headers = ["User ID", "User Name", "Province", "Store", "Specialized Course", "Course Title", "Video Progress (%)", "Video Completed", "Material Viewed", "Quiz Completed", "Points Earned", "Last Updated"];
  const rows = learningRecords
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .map(item => [
      item.userId || "",
      item.userName || "",
      item.province || "",
      item.store || "",
      getSpecializationMeta(item.specializationId).title,
      item.courseTitle || "",
      Math.round(item.videoProgress || 0),
      item.videoCompleted ? "Yes" : "No",
      item.materialViewed ? "Yes" : "No",
      item.quizCompleted ? "Yes" : "No",
      item.pointsEarned || 0,
      formatTime(item.updatedAt)
    ]);
  downloadCsv(`learning_progress_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ── Export 2: Lucky Draw (surveys + prizes + receipts) ──
async function exportLuckyDraw() {
  const surveys = await getAll("surveys");
  const headers = ["User ID", "User Name", "Province", "Store", "TV Model", "Receipt File Name", "Receipt URL", "Prize Won", "Prize Time", "Draw Time"];
  const rows = surveys
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map(item => [
      item.userId || "",
      item.name || "",
      item.province || "",
      item.store || item.group || "",
      item.model || item.satisfaction || "",
      item.receipt ? (item.receipt.name || "") : "",
      item.receipt ? (item.receipt.url || item.receipt.dataUrl || "") : "",
      displayPrize(item.prize),
      item.prizeAt ? formatTime(item.prizeAt) : "",
      formatTime(item.createdAt)
    ]);
  downloadCsv(`lucky_draw_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ── Export 3: Points Mall Redemptions (all users) ──
async function exportRedemptions() {
  const redemptions = await getAll("redemptions");
  const headers = ["User ID", "User Name", "Province", "Store", "Gift Name", "Cost (pts)", "Redemption Time"];
  const rows = redemptions
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map(item => [
      item.userId || "",
      item.userName || "",
      item.province || "",
      item.store || "",
      item.itemName || "",
      item.cost || 0,
      formatTime(item.createdAt)
    ]);
  downloadCsv(`redemptions_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ── Export 4: Sales Records (all users) ──
async function exportSales() {
  const salesRecords = await getAll("salesRecords");
  const headers = ["User ID", "User Name", "Province", "Store", "Model", "Barcode Number", "Image File Name", "Image URL", "Record Time"];
  const rows = salesRecords
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map(item => [
      item.userId || "",
      item.userName || "",
      item.province || "",
      item.store || "",
      item.model || "",
      item.barcodeNumber || "",
      item.image ? (item.image.name || "") : "",
      item.image ? (item.image.url || item.image.dataUrl || "") : "",
      formatTime(item.createdAt)
    ]);
  downloadCsv(`sales_records_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ── Storage stats ──
async function refreshStorageStats() {
  if (!els.storageStats) return;
  try {
    const res = await fetch("./api/stats");
    const stats = await res.json();
    if (stats.error) return;

    const dbMB = (stats.dbEstimateBytes / (1024 * 1024)).toFixed(2);
    const imgMB = (stats.imageEstimateBytes / (1024 * 1024)).toFixed(2);
    const dbMax = stats.limits.dbMaxMB;
    const imgMax = stats.limits.storageMaxMB;

    els.dbBarFill.style.width = Math.min((dbMB / dbMax) * 100, 100) + "%";
    els.dbBarLabel.textContent = `${dbMB} / ${dbMax} MB`;

    els.imgBarFill.style.width = Math.min((imgMB / imgMax) * 100, 100) + "%";
    els.imgBarLabel.textContent = `${imgMB} / ${imgMax} MB (${stats.imageCount} files)`;

    // Color coding
    els.dbBarFill.className = "storage-bar-fill" + (dbMB / dbMax > 0.8 ? " danger" : dbMB / dbMax > 0.6 ? " warning" : "");
    els.imgBarFill.className = "storage-bar-fill" + (imgMB / imgMax > 0.8 ? " danger" : imgMB / imgMax > 0.6 ? " warning" : "");

    els.storageStats.style.display = "";
    if (els.perTableActions) els.perTableActions.style.display = "";
  } catch (e) {
    console.warn("Failed to refresh storage stats:", e);
  }
}

// ── Per-table clear ──
async function clearOneTable(storeName) {
  const labels = {
    users: "all users",
    attempts: "all quiz attempts",
    surveys: "all lucky draw data",
    learningRecords: "all learning progress",
    redemptions: "all redemptions",
    salesRecords: "all sales records"
  };
  if (!confirm(`Delete ${labels[storeName] || storeName}? This cannot be undone.`)) return;
  await clearStore(storeName);
  await renderAdmin();
}

async function exportBackup() {
  const payload = {
    app: DB_NAME,
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    stores: {}
  };

  for (const storeName of stores) {
    payload.stores[storeName] = await serializeBackupValue(await getAll(storeName));
  }

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `skyworth_platform_backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload?.stores || typeof payload.stores !== "object") {
      throw new Error("Invalid backup file.");
    }
    if (!confirm("Restore backup data to this page? Existing matching items will be updated.")) return;

    for (const storeName of stores) {
      const items = Array.isArray(payload.stores[storeName]) ? payload.stores[storeName] : [];
      for (const item of items) {
        await put(storeName, reviveBackupValue(item));
      }
    }

    const currentUserId = safeStorageGet(CURRENT_USER_KEY);
    currentProfile = currentUserId ? await getById("users", currentUserId) : currentProfile;
    await refreshLearnerSummary();
    await renderAll();
    alert("Restore complete.");
  } catch (error) {
    console.error(error);
    alert(`Restore failed: ${error.message || "Invalid file"}`);
  } finally {
    if (els.restoreInput) els.restoreInput.value = "";
  }
}

async function clearData() {
  if (!confirm("Clear learning, sales, draw, and user data? Points Mall gifts stay saved.")) return;
  const storesToClear = stores.filter((storeName) => storeName !== "mallItems");
  await Promise.all(storesToClear.map(clearStore));
  currentSurveyId = null;
  currentProfile = null;
  isLearningDetailOpen = false;
  setStoredCurrentUserId("");
  isDrawActive = false;
  if (els.salesForm) els.salesForm.reset();
  if (els.salesModel) els.salesModel.value = "";
  if (els.salesBarcode) els.salesBarcode.value = "";
  showAppShell(false);
  els.registrationForm.reset();
  els.registerStore.disabled = true;
  els.registerStore.innerHTML = '<option value="">Select province first</option>';
  handleAdminLogout();
  await renderAll();
}

async function handleRegistration(event) {
  if (event) {
    event.preventDefault();
  }
  if (!dbReady) {
    setRegistrationStatus("Loading. Try again soon.", "warning");
    return;
  }
  const profile = normalizeProfile({
    name: els.registerName.value,
    province: els.registerProvince.value,
    store: els.registerStore.value
  });
  if (!profile) {
    setRegistrationStatus("Complete name, province, and store.", "error");
    return;
  }
  try {
    setRegistrationBusy(true, "Starting...");
    setRegistrationStatus("Saving...", "progress");
    await setCurrentProfile(profile);
    els.registrationForm.reset();
    // Reset store dropdown after form reset
    els.registerStore.disabled = true;
    els.registerStore.innerHTML = '<option value="">Select province first</option>';
    setRegistrationStatus("Registered.", "success");
  } catch (error) {
    console.error(error);
    setRegistrationStatus(`Registration failed: ${error.message || "Unknown error"}`, "error");
  } finally {
    setRegistrationBusy(false, "Start Learning");
  }
}

async function restoreSession() {
  const storedId = getStoredCurrentUserId();
  if (!storedId) {
    showAppShell(false);
    return;
  }
  let user = await getById("users", storedId);
  if (!user) {
    const users = await getAll("users");
    user = users.find((item) => item.accountKey === storedId || makeAccountKey(item.name, item.province, item.store) === storedId) || null;
  }
  if (!user) {
    setStoredCurrentUserId("");
    showAppShell(false);
    return;
  }
  currentProfile = normalizeProfile(user);
  setStoredCurrentUserId(currentProfile.accountKey || currentProfile.id);
  showAppShell(true);
  await refreshLearnerSummary();
  // Restore Lucky Draw state: check if user already submitted today
  await restoreDrawState();
}

async function restoreDrawState() {
  try {
    const surveys = await getAll("surveys");
    const today = new Date().toISOString().slice(0, 10);
    const todaysSurvey = surveys.find(
      (s) => s.userId === currentProfile.id && s.createdAt && s.createdAt.startsWith(today)
    );
    if (todaysSurvey && !todaysSurvey.prize) {
      // User submitted today but hasn't spun yet
      currentSurveyId = todaysSurvey.id;
      isDrawActive = true;
    } else if (todaysSurvey && todaysSurvey.prize) {
      // User already spun today — keep locked
      currentSurveyId = null;
      isDrawActive = false;
    }
  } catch (e) {
    console.warn("Could not restore draw state:", e);
  }
}

function startUserSwitch() {
  currentProfile = null;
  isLearningDetailOpen = false;
  setStoredCurrentUserId("");
  if (els.salesForm) els.salesForm.reset();
  if (els.salesModel) els.salesModel.value = "";
  if (els.salesBarcode) els.salesBarcode.value = "";
  showAppShell(false);
  setRegistrationStatus("Enter another profile.", "idle");
  els.registerName.focus();
}

function backToSpecializationOverview() {
  isLearningDetailOpen = false;
  activeCourseId = "";
  toggleCourseContentView(false);
  renderCourses();
}

function backToCourseCatalog() {
  activeCourseId = "";
  toggleCourseContentView(false);
}

async function migrateLegacyLearningData() {
  const courses = (await getAll("courses")).map((course) => restoreFileFields(course, ["video", "material"]));
  let changed = false;
  for (const course of courses) {
    if (!course.specializationId) {
      course.specializationId = "tv-operations";
      await put("courses", course);
      changed = true;
    }
  }

  const learningRecords = await getAll("learningRecords");
  for (const record of learningRecords) {
    if (!record.specializationId) {
      record.specializationId = "tv-operations";
      await put("learningRecords", record);
      changed = true;
    }
  }

  return changed;
}

async function migrateLocalFallbackToIndexedDb() {
  if (useLocalStore) return false;
  const raw = safeStorageGet(LOCAL_DB_KEY);
  if (!raw) return false;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("Could not parse local fallback storage for migration.", error);
    return false;
  }

  const hasAnyData = stores.some((store) => Array.isArray(parsed[store]) && parsed[store].length > 0);
  if (!hasAnyData) return false;

  for (const store of stores) {
    const items = Array.isArray(parsed[store]) ? parsed[store] : [];
    if (!items.length) continue;
    const existingItems = await getAll(store);
    const existingIds = new Set(existingItems.map((item) => item.id));
    for (const item of items) {
      if (!existingIds.has(item.id)) {
        await put(store, item);
      }
    }
  }

  safeStorageRemove(LOCAL_DB_KEY);
  return true;
}

function handleQuestionBuilderInput(event) {
  const target = event.target;
  const questionIdValue = target.dataset.questionId;
  if (!questionIdValue) return;

  if (target.dataset.action === "prompt") {
    updateQuestionDraft(questionIdValue, (question) => ({ ...question, prompt: target.value }));
    return;
  }

  if (target.dataset.action === "question-type") {
    updateQuestionDraft(questionIdValue, (question) => {
      const next = createQuestionDraft(target.value);
      return {
        ...next,
        id: question.id,
        prompt: question.prompt
      };
    });
    return;
  }

  if (target.dataset.action === "option-text") {
    const optionIndex = Number(target.dataset.optionIndex);
    updateQuestionDraft(questionIdValue, (question) => {
      const options = [...question.options];
      options[optionIndex] = target.value;
      return { ...question, options };
    });
    return;
  }

  if (target.dataset.action === "sample-answer") {
    updateQuestionDraft(questionIdValue, (question) => ({ ...question, sampleAnswer: target.value }));
    return;
  }

  if (target.dataset.action === "correct-answer") {
    const optionIndex = String(Number(target.dataset.optionIndex));
    updateQuestionDraft(questionIdValue, (question) => {
      if (question.type === "multiple") {
        const next = question.correctAnswers.includes(optionIndex)
          ? question.correctAnswers.filter((item) => item !== optionIndex)
          : [...question.correctAnswers, optionIndex];
        return { ...question, correctAnswers: next };
      }
      return { ...question, correctAnswers: [optionIndex] };
    });
    return;
  }

  if (target.dataset.action === "audio-prompt-label") {
    updateQuestionDraft(questionIdValue, (question) => ({ ...question, audioPromptLabel: target.value }));
  }
}

function handleQuestionBuilderClick(event) {
  const target = event.target;
  const questionIdValue = target.dataset.questionId;
  if (target.dataset.action === "remove-question" && questionIdValue) {
    questionDrafts = questionDrafts.filter((question) => question.id !== questionIdValue);
    renderQuestionBuilder();
    persistCourseDraft();
    return;
  }

  if (target.dataset.action === "add-option" && questionIdValue) {
    updateQuestionDraft(questionIdValue, (question) => ({ ...question, options: [...question.options, ""] }));
  }

  if ((target.dataset.action === "move-option-up" || target.dataset.action === "move-option-down") && questionIdValue) {
    const optionIndex = Number(target.dataset.optionIndex);
    updateQuestionDraft(questionIdValue, (question) => {
      const nextIndex = target.dataset.action === "move-option-up" ? optionIndex - 1 : optionIndex + 1;
      if (nextIndex < 0 || nextIndex >= question.options.length) return question;
      return {
        ...question,
        options: moveArrayItem(question.options, optionIndex, nextIndex)
      };
    });
  }
}

if (els.adminLoginForm) els.adminLoginForm.addEventListener("submit", handleAdminLogin);
els.courseForm.addEventListener("submit", saveCourse);
els.surveyForm.addEventListener("submit", saveSurvey);
// Show file preview after selection in Lucky Draw
const surveyReceiptInput = document.getElementById("surveyReceipt");
if (surveyReceiptInput) {
  surveyReceiptInput.addEventListener("change", () => {
    const file = surveyReceiptInput.files[0];
    const placeholder = document.querySelector(".draw-upload-placeholder");
    if (file && placeholder) {
      const sizeKB = (file.size / 1024).toFixed(0);
      placeholder.innerHTML = `<span style="color:#16A34A;">✓</span> <strong>${file.name}</strong> (${sizeKB} KB)`;
    }
  });
}
els.spinButton.addEventListener("click", spinWheel);
/* ── Side Card Button Events ── */
const myHistoryBtn = document.getElementById("myHistoryBtn");
if (myHistoryBtn) {
  myHistoryBtn.addEventListener("click", async () => {
    const surveys = _cachedSurveys || await getAll("surveys");
    const profile = currentProfile;
    const userWins = surveys
      .filter(s => s.prize && s.name === (profile ? profile.name : ""))
      .sort((a, b) => new Date(b.prizeAt) - new Date(a.prizeAt));
    if (!userWins.length) {
      showInfoModal("My Draw History", "No draw history yet. Submit sales to enter lucky draw!");
      return;
    }
    const rows = userWins.map(w => {
      const label = (prizes.find(p => p.name === w.prize) || {}).label || w.prize;
      return `<div class="info-modal-row"><span class="info-modal-date">${new Date(w.prizeAt).toLocaleDateString()}</span><span class="info-modal-prize">${escapeHtml(label)}</span></div>`;
    }).join("");
    showInfoModal("My Draw History", rows, true);
  });
}
const viewAllBtn = document.getElementById("viewAllWinnersBtn");
if (viewAllBtn) {
  viewAllBtn.addEventListener("click", async () => {
    const surveys = _cachedSurveys || await getAll("surveys");
    const allWins = surveys
      .filter(s => s.prize)
      .sort((a, b) => new Date(b.prizeAt) - new Date(a.prizeAt));
    if (!allWins.length) {
      showInfoModal("All Winners", "No winners yet. Be the first!");
      return;
    }
    const rows = allWins.map(w => {
      const label = (prizes.find(p => p.name === w.prize) || {}).label || w.prize;
      return `<div class="info-modal-row"><span class="info-modal-name">${escapeHtml(w.name || "Anonymous")}</span><span class="info-modal-prize">${escapeHtml(label)}</span><span class="info-modal-date">${new Date(w.prizeAt).toLocaleDateString()}</span></div>`;
    }).join("");
    showInfoModal("All Winners", rows, true);
  });
}

// Reusable in-page modal for lists (My History / View All Winners)
function showInfoModal(title, content, isHtml) {
  const existing = document.querySelector(".info-modal-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "info-modal-overlay";
  overlay.innerHTML = `
    <div class="info-modal-card">
      <div class="info-modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="info-modal-close" type="button">&times;</button>
      </div>
      <div class="info-modal-body">${isHtml ? content : `<p class="info-modal-empty">${escapeHtml(content)}</p>`}</div>
    </div>
  `;
  document.body.append(overlay);
  const close = () => overlay.remove();
  overlay.querySelector(".info-modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}

// Toast notification
function showToast(message, type) {
  const existing = document.querySelector(".toast-bar");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast-bar " + (type || "");
  toast.innerHTML = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("toast-bar--show"));
  setTimeout(() => {
    toast.classList.remove("toast-bar--show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
els.exportButton.addEventListener("click", exportCsv);
if (els.exportLearningBtn) els.exportLearningBtn.addEventListener("click", exportLearning);
if (els.exportDrawBtn) els.exportDrawBtn.addEventListener("click", exportLuckyDraw);
if (els.exportRedemptionBtn) els.exportRedemptionBtn.addEventListener("click", exportRedemptions);
if (els.exportSalesBtn) els.exportSalesBtn.addEventListener("click", exportSales);

// Data panel inline download buttons
document.querySelectorAll(".data-panel-dl-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const dl = btn.dataset.dl;
    if (dl === "learning") exportLearning();
    else if (dl === "draw") exportLuckyDraw();
    else if (dl === "redemption") exportRedemptions();
    else if (dl === "sales") exportSales();
  });
});

if (els.refreshStatsBtn) els.refreshStatsBtn.addEventListener("click", refreshStorageStats);
if (els.perTableActions) {
  els.perTableActions.querySelectorAll("[data-clear]").forEach(btn => {
    btn.addEventListener("click", () => clearOneTable(btn.dataset.clear));
  });
}
if (els.backupButton) els.backupButton.addEventListener("click", exportBackup);
if (els.restoreButton) els.restoreButton.addEventListener("click", () => els.restoreInput?.click());
if (els.restoreInput) els.restoreInput.addEventListener("change", () => importBackupFile(els.restoreInput.files?.[0]));
els.clearButton.addEventListener("click", clearData);
els.registrationForm.addEventListener("submit", handleRegistration);
els.registerButton.addEventListener("click", handleRegistration);
els.switchUserButton.addEventListener("click", startUserSwitch);
els.backToTracksButton.addEventListener("click", backToSpecializationOverview);
if (els.backToCatalogButton) els.backToCatalogButton.addEventListener("click", backToCourseCatalog);
els.cancelEditButton.addEventListener("click", resetCourseEditor);
if (els.mallItemForm) els.mallItemForm.addEventListener("submit", saveMallItem);
if (els.cancelMallEditButton) els.cancelMallEditButton.addEventListener("click", resetMallItemEditor);
els.addQuestionButton.addEventListener("click", () => addQuestionDraft("single"));
els.questionBuilder.addEventListener("input", handleQuestionBuilderInput);
els.questionBuilder.addEventListener("change", handleQuestionBuilderInput);
els.questionBuilder.addEventListener("click", handleQuestionBuilderClick);
els.courseForm.addEventListener("input", persistCourseDraft);
els.courseForm.addEventListener("change", persistCourseDraft);
if (els.salesForm) els.salesForm.addEventListener("submit", saveSalesRecord);
if (els.uploadAlbumButton && els.salesImage) {
  els.uploadAlbumButton.addEventListener("click", () => els.salesImage.click());
}
if (els.openCameraButton && els.salesCameraImage) {
  els.openCameraButton.addEventListener("click", () => els.salesCameraImage.click());
}
if (els.salesImage) {
  els.salesImage.addEventListener("change", async () => {
    if (els.salesCameraImage) els.salesCameraImage.value = "";
    if (els.salesModel) els.salesModel.value = "";
    if (els.salesBarcode) els.salesBarcode.value = "";
    setSalesSaveStatus("", "idle");
    setSalesScanStatus(els.salesImage.files[0] ? "Detecting..." : "", els.salesImage.files[0] ? "progress" : "idle");
    if (els.salesImage.files[0]) await scanSalesImage();
  });
}
if (els.salesCameraImage) {
  els.salesCameraImage.addEventListener("change", async () => {
    if (els.salesImage) els.salesImage.value = "";
    if (els.salesModel) els.salesModel.value = "";
    if (els.salesBarcode) els.salesBarcode.value = "";
    setSalesSaveStatus("", "idle");
    setSalesScanStatus(els.salesCameraImage.files[0] ? "Detecting..." : "", els.salesCameraImage.files[0] ? "progress" : "idle");
    if (els.salesCameraImage.files[0]) await scanSalesImage();
  });
}

// Initialize new Learning page components
initCarouselArrows();
initLearningNavLinks();

// ── Dispatch toggle: event delegation for dispatch buttons in dashboards ──
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".dispatch-toggle-btn");
  if (!btn) return;
  const key = btn.dataset.dispatch;
  const currentState = btn.dataset.state === "1";
  const status = loadDispatchStatus();
  status[key] = !currentState;
  saveDispatchStatus(status);
  // Re-render dashboards
  if (adminAuthenticated) renderAdmin();
});

// Start intro animation immediately — do not wait for DB
if (new URLSearchParams(window.location.search).get("demo") !== "draw") {
  startIntroFlow();
}

openDb()
  .then(async (opened) => {
    db = opened;
    await openServerStore();
    await migrateIndexedDbToServerIfNeeded();
    await migrateLocalFallbackToIndexedDb();
    dbReady = true;
    initProvinceSelect();
    setRegistrationStatus(supabaseConnected ? "Registration is ready. Data is saved to cloud database." : useServerStore ? "Registration is ready. Uploads save on this server." : useLocalStore ? "Registration is ready in local file mode." : "Registration is ready.", "success");
    resetQuestionDrafts();
    addQuestionDraft("single");
    restoreCourseDraft();
    await migrateLegacyLearningData();
    await restoreSession();
    await renderAll();
    await applyDemoViewIfRequested();
  })
  .catch((error) => {
    console.error(error);
    setRegistrationStatus("Database unavailable. Try another browser.", "error");
  });

/* ═══════════════════════════════════════════════
   Blue Dragon Walk + Coin Rain Animation
   ═══════════════════════════════════════════════ */
(function initWheelAnimations() {
  if (!document.getElementById('dragonStage')) return;

  const dragonChar = document.getElementById('dragonChar');
  const dragonStage = document.getElementById('dragonStage');
  const coinRainContainer = document.getElementById('coinRainContainer');
  const starDustRing = document.getElementById('starDustRing');
  const rivetsContainer = document.getElementById('rivetsContainer');
  const wheelContainer = document.querySelector('.draw-wheel-container-new');
  if (!dragonChar || !coinRainContainer) return;

  // ── Star Dust Dots ──
  if (starDustRing && wheelContainer) {
    const styleEl = document.createElement('style');
    styleEl.textContent = `@keyframes starTwinkle{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.7;transform:scale(1.6)}}`;
    document.head.appendChild(styleEl);
    setTimeout(() => {
      const cx = wheelContainer.clientWidth / 2;
      const cy = wheelContainer.clientHeight / 2;
      const baseR = 228;
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
        const r = baseR + (Math.random() - 0.5) * 28;
        const dot = document.createElement('div');
        dot.style.cssText = `position:absolute;width:${1.5+Math.random()*2.5}px;height:${1.5+Math.random()*2.5}px;border-radius:50%;background:rgba(255,255,255,${0.35+Math.random()*0.45});box-shadow:0 0 ${2+Math.random()*3}px rgba(255,255,240,0.4);left:${cx+Math.cos(angle)*r}px;top:${cy+Math.sin(angle)*r}px;animation:starTwinkle ${1.5+Math.random()*3}s ease-in-out infinite;animation-delay:${Math.random()*3}s;`;
        starDustRing.appendChild(dot);
      }
    }, 200);
  }

  // ── Rivets ──
  if (rivetsContainer && wheelContainer) {
    setTimeout(() => {
      const cx = wheelContainer.clientWidth / 2;
      const cy = wheelContainer.clientHeight / 2;
      const r = 218;
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const rivet = document.createElement('div');
        rivet.className = 'wheel-rivet';
        rivet.style.cssText = `position:absolute;z-index:7;pointer-events:none;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#f0d78c 0%,#d4a850 40%,#8b6914 100%);box-shadow:0 2px 4px rgba(0,0,0,0.3),0 0 4px rgba(240,215,140,0.25);left:${cx+Math.cos(angle)*r-5}px;top:${cy+Math.sin(angle)*r-5}px;`;
        rivetsContainer.appendChild(rivet);
      }
    }, 200);
  }

  // ── Dragon Walk Animation ──
  let dragonLeft = -110;
  let dragonDir = 1; // 1 = right, -1 = left
  const walkSpeed = (dragonStage.clientWidth + 220) / 360; // pixels per frame at ~60fps for 6s traversal

  function animateDragon() {
    const stageWidth = dragonStage.clientWidth;
    const charWidth = 110;
    dragonLeft += walkSpeed * dragonDir;

    if (dragonLeft > stageWidth) {
      dragonLeft = stageWidth;
      dragonDir = -1;
      dragonChar.classList.add('flip');
    } else if (dragonLeft < -charWidth) {
      dragonLeft = -charWidth;
      dragonDir = 1;
      dragonChar.classList.remove('flip');
    }

    dragonChar.style.left = dragonLeft + 'px';
    requestAnimationFrame(animateDragon);
  }
  requestAnimationFrame(animateDragon);

  // ── Coin Rain ──
  const coinPalettes = [
    { fill: '#d4a850', stroke: '#8b6914', inner: '#f0d78c', text: '#8b6914' },
    { fill: '#e8d5a3', stroke: '#b89246', inner: '#f0d78c', text: '#8b6914' },
    { fill: '#c9a042', stroke: '#8b6914', inner: '#e8d5a3', text: '#6b4f10' },
    { fill: '#dbc070', stroke: '#9a7420', inner: '#f5e6b8', text: '#8b6914' },
  ];

  let uidCounter = 0;
  const maxCoins = 14;
  let activeCoins = 0;

  function makeCoinSVG(palette, size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2"/><circle cx="20" cy="20" r="14" fill="none" stroke="${palette.inner}" stroke-width="0.8" opacity="0.5"/><circle cx="15" cy="13" r="4" fill="white" opacity="0.2"/><text x="20" y="25" text-anchor="middle" fill="${palette.text}" font-size="12" font-weight="900" font-family="Inter,system-ui,sans-serif">¥</text></svg>`;
  }

  function spawnCoin() {
    if (activeCoins >= maxCoins || !coinRainContainer) return;
    activeCoins++;
    const palette = coinPalettes[Math.floor(Math.random() * coinPalettes.length)];
    const size = 16 + Math.random() * 20;
    const leftPct = 5 + Math.random() * 85;
    const duration = 3.5 + Math.random() * 2.5;
    const delay = Math.random() * 2;

    const el = document.createElement('div');
    el.style.cssText = `position:absolute;top:-50px;left:${leftPct}%;width:${size}px;height:${size}px;animation:coinFall ${duration}s linear ${delay}s infinite;will-change:transform;`;
    el.innerHTML = makeCoinSVG(palette, size);
    coinRainContainer.appendChild(el);

    let caught = false;
    const checkTimer = setInterval(() => {
      if (caught) { clearInterval(checkTimer); return; }
      if (!el.parentNode || !dragonChar) { clearInterval(checkTimer); return; }
      const coinR = el.getBoundingClientRect();
      const dragonR = dragonChar.getBoundingClientRect();
      const coinBottom = coinR.top + coinR.height;
      const dragonTop = dragonR.top;
      const dragonBottom = dragonR.bottom;
      const dragonMidX = dragonR.left + dragonR.width / 2;
      const coinMidX = coinR.left + coinR.width / 2;
      const catchRange = dragonR.width * 0.35;

      if (coinBottom >= dragonTop + dragonR.height * 0.1 &&
          coinBottom <= dragonTop + dragonR.height * 0.6 &&
          Math.abs(coinMidX - dragonMidX) < catchRange) {
        caught = true;
        clearInterval(checkTimer);
        activeCoins--;
        dragonChar.classList.add('hit');
        setTimeout(() => dragonChar.classList.remove('hit'), 550);
        el.style.transition = 'all 0.3s ease-out';
        el.style.transform = 'scale(0)';
        el.style.opacity = '0';
        setTimeout(() => { if (el.parentNode) el.remove(); }, 350);
        setTimeout(() => spawnCoin(), 400 + Math.random() * 900);
      }
      if (coinR.top > dragonR.bottom + 50) {
        clearInterval(checkTimer);
        caught = true;
        el.style.transition = 'opacity 0.6s ease-out';
        el.style.opacity = '0';
        setTimeout(() => {
          if (el.parentNode) { el.remove(); activeCoins--; }
          setTimeout(() => spawnCoin(), 300 + Math.random() * 700);
        }, 650);
      }
    }, 80);

    // Fallback
    el.addEventListener('animationiteration', () => {
      if (!caught && el.parentNode) {
        // Reset check logic on each iteration
      }
    });
  }

  // Add coinFall keyframes if not present
  if (!document.getElementById('coinFallStyle')) {
    const coinStyle = document.createElement('style');
    coinStyle.id = 'coinFallStyle';
    coinStyle.textContent = `@keyframes coinFall{0%{transform:translateY(0) rotate(0deg);opacity:0}4%{opacity:0.88}88%{opacity:0.82}100%{transform:translateY(620px) rotate(360deg);opacity:0}}`;
    document.head.appendChild(coinStyle);
  }

  // Spawn initial coins
  for (let i = 0; i < 8; i++) {
    setTimeout(spawnCoin, i * 350 + 500);
  }
  setInterval(() => {
    if (activeCoins < maxCoins - 4) spawnCoin();
  }, 1600);

})();
