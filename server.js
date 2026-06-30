const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
const dataFile = path.join(dataDir, "platform-data.json");
const stores = ["courses", "attempts", "surveys", "learningRecords", "redemptions", "users", "salesRecords", "mallItems"];
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 1024 * 1024 * 500);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function emptyData() {
  return stores.reduce((acc, store) => {
    acc[store] = [];
    return acc;
  }, {});
}

function readData() {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = raw ? JSON.parse(raw) : emptyData();
    stores.forEach((store) => {
      if (!Array.isArray(parsed[store])) parsed[store] = [];
    });
    return parsed;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Could not read persisted data. Starting with an empty data file.", error);
    }
    return emptyData();
  }
}

function writeData(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmpFile = `${dataFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  fs.renameSync(tmpFile, dataFile);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, stores, persisted: true });
    return true;
  }

  if (parts[0] !== "api" || parts[1] !== "stores") return false;

  const store = parts[2];
  const id = parts[3] ? decodeURIComponent(parts[3]) : "";
  if (!stores.includes(store)) {
    sendJson(res, 404, { error: "Unknown store." });
    return true;
  }

  try {
    const data = readData();
    if (req.method === "GET" && !id) {
      sendJson(res, 200, data[store]);
      return true;
    }
    if (req.method === "GET" && id) {
      sendJson(res, 200, data[store].find((item) => item.id === id) || null);
      return true;
    }
    if ((req.method === "POST" || req.method === "PUT") && !id) {
      const item = await readBody(req);
      if (!item || typeof item !== "object" || !item.id) {
        sendJson(res, 400, { error: "Item requires an id." });
        return true;
      }
      const items = data[store];
      const index = items.findIndex((existing) => existing.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
      writeData(data);
      sendJson(res, 200, item);
      return true;
    }
    if (req.method === "DELETE" && id) {
      data[store] = data[store].filter((item) => item.id !== id);
      writeData(data);
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (req.method === "DELETE" && !id) {
      data[store] = [];
      writeData(data);
      sendJson(res, 200, { ok: true });
      return true;
    }
    sendJson(res, 405, { error: "Method not allowed." });
    return true;
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error." });
    return true;
  }
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${host}:${port}`);
  } catch (error) {
    send(res, 400, "Bad request");
    return;
  }

  handleApi(req, res, url).then((handled) => {
    if (handled) return;

  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, requestPath));
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(filePath).pipe(res);
  });
  }).catch((error) => {
    sendJson(res, 500, { error: error.message || "Server error." });
  });
});

server.listen(port, host, () => {
  console.log(`SKYWORTH app server http://${host}:${port}/ -> ${root}`);
});
