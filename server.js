const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 1024 * 1024 * 500);

// Supabase configuration — hardcoded keys (env vars as override)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://lqdzczfsudohuriygqhu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "sb_secret_vsaxzh8YXetuXFppoKbQNw_wUfAFQyq";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_XHZ12t0KPBeGJQ_1k50Vlw_g9nVZ8FV";
let useSupabase = true; // force Supabase mode

const stores = ["courses", "attempts", "surveys", "learningRecords", "redemptions", "users", "salesRecords", "mallItems"];

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

// ─── File-based fallback storage (used when Supabase is not configured) ───
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
const dataFile = path.join(dataDir, "platform-data.json");

function emptyData() {
  return stores.reduce((acc, store) => { acc[store] = []; return acc; }, {});
}

function readData() {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = raw ? JSON.parse(raw) : emptyData();
    stores.forEach((store) => { if (!Array.isArray(parsed[store])) parsed[store] = []; });
    return parsed;
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Could not read persisted data.", error);
    return emptyData();
  }
}

function writeData(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmpFile = `${dataFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  fs.renameSync(tmpFile, dataFile);
}

// ─── Supabase client ───
let supabase = null;

async function initSupabase() {
  if (!useSupabase) {
    console.log("Supabase not configured (missing env vars), using file storage");
    return false;
  }
  console.log("Initializing Supabase with URL:", SUPABASE_URL);
  console.log("Service key present:", SUPABASE_SERVICE_KEY ? "yes (length " + SUPABASE_SERVICE_KEY.length + ")" : "NO");
  try {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    // Verify connection by trying to select from users table
    const { data, error } = await supabase.from("users").select("id").limit(1);
    if (error) {
      console.error("Supabase query error:", error.message, "| code:", error.code);
      if (error.code === "42P01") {
        console.log("Tables not found, creating...");
        await createTables();
      } else {
        console.error("Supabase connection failed, falling back to file storage");
        useSupabase = false;
        supabase = null;
        return false;
      }
    }
    console.log("Supabase connected successfully:", SUPABASE_URL, "| rows:", data ? data.length : 0);
    return true;
  } catch (error) {
    console.error("Supabase init exception:", error.message, error.stack);
    useSupabase = false;
    supabase = null;
    return false;
  }
}

async function createTables() {
  if (!supabase) return;
  console.log("Creating Supabase tables...");

  // Create tables via raw SQL
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "learningRecords" (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS redemptions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "salesRecords" (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "mallItems" (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_surveys_created ON surveys(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_records_created ON "salesRecords"(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_learning_records_created ON "learningRecords"(created_at DESC);
  `;
  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    // exec_sql may not be available — try creating tables one by one via REST
    console.warn("Could not create tables via RPC, will create on first write:", error.message);
  } else {
    console.log("Supabase tables created successfully.");
  }
}

// Ensure a table exists by attempting an insert with a dummy then deleting it
async function ensureTable(tableName) {
  if (!supabase) return;
  try {
    const dummyId = `__table_init_${Date.now()}`;
    await supabase.from(tableName).upsert({ id: dummyId, data: {} });
    await supabase.from(tableName).delete().eq("id", dummyId);
  } catch (_) {
    // Table might already exist, that's fine
  }
}

// ─── Supabase data access ───
async function supabaseGetAll(store) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(store)
    .select("data")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data || []).map(row => row.data);
}

async function supabaseGetById(store, id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(store)
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data.data : null;
}

async function supabasePut(store, item) {
  if (!supabase) return;
  await ensureTable(store);
  const { error } = await supabase
    .from(store)
    .upsert({ id: item.id, data: item, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

async function supabaseDelete(store, id) {
  if (!supabase) return;
  if (id) {
    const { error } = await supabase.from(store).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

async function supabaseDeleteAll(store) {
  if (!supabase) return;
  // Delete all rows (use a filter that matches everything)
  const { error } = await supabase.from(store).delete().neq("id", "__nonexistent__");
  if (error) throw new Error(error.message);
}

// ─── Supabase Storage (for images) ───
const STORAGE_BUCKET = "images";

async function uploadImageToStorage(base64Data, fileName) {
  if (!supabase) throw new Error("Supabase not connected");
  // Remove data URL prefix if present
  const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
  let contentType = "image/jpeg";
  let buffer;
  if (matches) {
    contentType = matches[1];
    buffer = Buffer.from(matches[2], "base64");
  } else {
    buffer = Buffer.from(base64Data, "base64");
  }
  const uniqueName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(uniqueName, buffer, {
      contentType,
      upsert: true
    });
  if (error) throw new Error(error.message);
  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(uniqueName);
  return urlData.publicUrl;
}

async function deleteImageFromStorage(imageUrl) {
  if (!supabase || !imageUrl) return;
  try {
    const urlObj = new URL(imageUrl);
    const pathParts = urlObj.pathname.split("/");
    const fileName = pathParts[pathParts.length - 1];
    if (fileName) {
      await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);
    }
  } catch (e) {
    console.warn("Failed to delete image from storage:", e.message);
  }
}

// ─── Helpers ───
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
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); }
      catch (error) { reject(new Error("Invalid JSON body.")); }
    });
    req.on("error", reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ─── API Handler ───
async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      stores,
      persisted: true,
      storage: useSupabase ? "supabase" : "file",
      supabaseConnected: useSupabase
    });
    return true;
  }

  // ── Image upload ──
  // 限制：base64 解码后最大 500KB（base64 字符串约 667KB）
  const MAX_IMAGE_BYTES = 500 * 1024;
  if (url.pathname === "/api/upload" && req.method === "POST") {
    if (!useSupabase || !supabase) {
      sendJson(res, 503, { error: "Storage not available." });
      return true;
    }
    try {
      const { image, fileName } = await readBody(req);
      if (!image) {
        sendJson(res, 400, { error: "No image data provided." });
        return true;
      }
      // 服务端大小校验：解码后检查实际图片大小
      const matches = image.match(/^data:(.+);base64,(.+)$/);
      let decodedSize = 0;
      if (matches) {
        decodedSize = Math.ceil((matches[2].length * 3) / 4);
      } else {
        decodedSize = Math.ceil((image.length * 3) / 4);
      }
      if (decodedSize > MAX_IMAGE_BYTES) {
        sendJson(res, 413, { error: `Image too large (${(decodedSize / 1024).toFixed(0)} KB). Maximum is ${MAX_IMAGE_BYTES / 1024} KB.` });
        return true;
      }
      const publicUrl = await uploadImageToStorage(image, fileName || "upload.jpg");
      sendJson(res, 200, { url: publicUrl });
    } catch (error) {
      console.error("Upload error:", error);
      sendJson(res, 500, { error: error.message || "Upload failed." });
    }
    return true;
  }

  // ── Image delete ──
  if (url.pathname === "/api/delete-image" && req.method === "POST") {
    if (!useSupabase || !supabase) {
      sendJson(res, 503, { error: "Storage not available." });
      return true;
    }
    try {
      const { imageUrl } = await readBody(req);
      await deleteImageFromStorage(imageUrl);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error("Delete image error:", error);
      sendJson(res, 500, { error: error.message || "Delete failed." });
    }
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
    // ── GET all ──
    if (req.method === "GET" && !id) {
      if (useSupabase) {
        sendJson(res, 200, await supabaseGetAll(store));
      } else {
        sendJson(res, 200, readData()[store]);
      }
      return true;
    }

    // ── GET by id ──
    if (req.method === "GET" && id) {
      if (useSupabase) {
        sendJson(res, 200, await supabaseGetById(store, id));
      } else {
        const data = readData();
        sendJson(res, 200, data[store].find(item => item.id === id) || null);
      }
      return true;
    }

    // ── POST / PUT (upsert) ──
    if ((req.method === "POST" || req.method === "PUT") && !id) {
      const item = await readBody(req);
      if (!item || typeof item !== "object" || !item.id) {
        sendJson(res, 400, { error: "Item requires an id." });
        return true;
      }
      if (useSupabase) {
        await supabasePut(store, item);
      } else {
        const data = readData();
        const items = data[store];
        const index = items.findIndex(existing => existing.id === item.id);
        if (index >= 0) items[index] = item;
        else items.push(item);
        writeData(data);
      }
      sendJson(res, 200, item);
      return true;
    }

    // ── DELETE by id ──
    if (req.method === "DELETE" && id) {
      if (useSupabase) {
        await supabaseDelete(store, id);
      } else {
        const data = readData();
        data[store] = data[store].filter(item => item.id !== id);
        writeData(data);
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    // ── DELETE all ──
    if (req.method === "DELETE" && !id) {
      if (useSupabase) {
        await supabaseDeleteAll(store);
      } else {
        const data = readData();
        data[store] = [];
        writeData(data);
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    sendJson(res, 405, { error: "Method not allowed." });
    return true;
  } catch (error) {
    console.error("API error:", error);
    sendJson(res, 500, { error: error.message || "Server error." });
    return true;
  }
}

// ─── HTTP Server ───
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
    console.error("Server error:", error);
    sendJson(res, 500, { error: error.message || "Server error." });
  });
});

// ─── Start ───
initSupabase().then(() => {
  server.listen(port, host, () => {
    console.log(`SKYWORTH app server http://${host}:${port}/ -> ${root}`);
    console.log(`Storage: ${useSupabase ? "Supabase PostgreSQL" : "Local file"}`);
  });
});
