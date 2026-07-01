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
        // New tables already have relational columns; just create views
        await createViews();
        console.log("Supabase connected successfully:", SUPABASE_URL);
        return true;
      } else {
        console.error("Supabase connection failed, falling back to file storage");
        useSupabase = false;
        supabase = null;
        return false;
      }
    }
    console.log("Supabase connected successfully:", SUPABASE_URL, "| rows:", data ? data.length : 0);
    // Run column migration for existing tables (add missing columns to pre-existing DBs)
    await migrateAddColumns();
    // Create convenience views
    await createViews();
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
      user_id TEXT,
      user_name TEXT,
      province TEXT,
      store TEXT,
      course_id TEXT,
      course_title TEXT,
      passed BOOLEAN,
      answer TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      user_id TEXT,
      user_name TEXT,
      province TEXT,
      store TEXT,
      tv_model TEXT,
      prize TEXT,
      receipt_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "learningRecords" (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      user_id TEXT,
      user_name TEXT,
      province TEXT,
      store TEXT,
      course_id TEXT,
      course_title TEXT,
      specialization_id TEXT,
      video_progress FLOAT,
      video_completed BOOLEAN,
      quiz_completed BOOLEAN,
      points_earned INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS redemptions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      user_id TEXT,
      user_name TEXT,
      province TEXT,
      store TEXT,
      item_id TEXT,
      item_name TEXT,
      cost INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "salesRecords" (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      user_id TEXT,
      user_name TEXT,
      province TEXT,
      store TEXT,
      model TEXT,
      barcode_number TEXT,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "mallItems" (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- Indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_surveys_created ON surveys(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
    CREATE INDEX IF NOT EXISTS idx_sales_records_created ON "salesRecords"(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_records_user_id ON "salesRecords"(user_id);
    CREATE INDEX IF NOT EXISTS idx_learning_records_created ON "learningRecords"(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_learning_records_user_id ON "learningRecords"(user_id);
    CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON redemptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
  `;
  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    // exec_sql may not be available — try creating tables one by one via REST
    console.warn("Could not create tables via RPC, will create on first write:", error.message);
  } else {
    console.log("Supabase tables created successfully.");
  }
}

// ─── Add missing columns to existing tables (migration for existing DBs) ───
async function migrateAddColumns() {
  if (!supabase) return;
  console.log("Running column migration for existing tables...");

  const columnsToAdd = {};

  // Standard user columns for all user-linked tables
  for (const table of USER_LINKED_TABLES) {
    if (!columnsToAdd[table]) columnsToAdd[table] = [];
    for (const col of STANDARD_USER_COLUMNS) {
      columnsToAdd[table].push(`ADD COLUMN IF NOT EXISTS ${col.colName} ${col.colType}`);
    }
  }

  // Extra columns per table
  for (const [table, cols] of Object.entries(TABLE_EXTRA_COLUMNS)) {
    if (!columnsToAdd[table]) columnsToAdd[table] = [];
    for (const col of cols) {
      columnsToAdd[table].push(`ADD COLUMN IF NOT EXISTS ${col.colName} ${col.colType}`);
    }
  }

  for (const [table, alters] of Object.entries(columnsToAdd)) {
    const sql = `ALTER TABLE ${JSON.stringify(table)} ${alters.join(", ")}`;
    try {
      await supabase.rpc("exec_sql", { sql });
    } catch (e) {
      console.warn(`Could not migrate columns for ${table} via RPC:`, e.message);
      // Fallback: try Supabase Management API to execute SQL directly
      try {
        const projectRef = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
        if (projectRef && SUPABASE_SERVICE_KEY) {
          const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ query: sql })
          });
          if (!mgmtRes.ok) {
            console.warn(`Management API migration failed for ${table}:`, mgmtRes.status);
          } else {
            console.log(`Migrated columns for ${table} via Management API`);
          }
        }
      } catch (mgmtErr) {
        console.warn(`Management API migration failed for ${table}:`, mgmtErr.message);
      }
    }
  }

  console.log("Column migration complete.");
}

// ─── Create convenience views for Supabase Dashboard SQL queries ───
async function createViews() {
  if (!supabase) return;
  console.log("Creating convenience views...");

  const viewsSql = `
    -- View: all surveys with user info, receipt URL, and prize
    CREATE OR REPLACE VIEW v_lucky_draw AS
    SELECT
      s.id,
      s.user_id,
      s.user_name,
      s.province,
      s.store,
      s.tv_model,
      s.prize,
      s.receipt_url,
      s.created_at,
      s.updated_at
    FROM surveys s
    ORDER BY s.created_at DESC;

    -- View: user summary (learning + points + draw + sales)
    CREATE OR REPLACE VIEW v_user_summary AS
    SELECT
      u.id AS user_id,
      u.data->>'name' AS name,
      u.data->>'province' AS province,
      u.data->>'store' AS store,
      COALESCE(lr.total_points, 0) AS points_earned,
      COALESCE(rd.total_spent, 0) AS points_spent,
      COALESCE(lr.total_points, 0) - COALESCE(rd.total_spent, 0) AS points_available,
      COALESCE(lr.courses_completed, 0) AS courses_completed,
      COALESCE(sv.draw_count, 0) AS draw_count,
      COALESCE(sv.win_count, 0) AS win_count,
      COALESCE(sr.sales_count, 0) AS sales_count,
      u.created_at AS registered_at
    FROM users u
    LEFT JOIN (
      SELECT user_id, SUM(points_earned) AS total_points, COUNT(*) AS courses_completed
      FROM "learningRecords" GROUP BY user_id
    ) lr ON lr.user_id = u.id
    LEFT JOIN (
      SELECT user_id, SUM(cost) AS total_spent FROM redemptions GROUP BY user_id
    ) rd ON rd.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS draw_count, COUNT(*) FILTER (WHERE prize IS NOT NULL AND prize != '' AND prize != 'Missed') AS win_count
      FROM surveys GROUP BY user_id
    ) sv ON sv.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS sales_count FROM "salesRecords" GROUP BY user_id
    ) sr ON sr.user_id = u.id
    ORDER BY points_available DESC;

    -- View: redemptions with user info
    CREATE OR REPLACE VIEW v_redemptions AS
    SELECT
      r.id, r.user_id, r.user_name, r.province, r.store,
      r.item_id, r.item_name, r.cost, r.created_at
    FROM redemptions r
    ORDER BY r.created_at DESC;

    -- View: sales records with user info
    CREATE OR REPLACE VIEW v_sales_records AS
    SELECT
      sr.id, sr.user_id, sr.user_name, sr.province, sr.store,
      sr.model, sr.barcode_number, sr.image_url, sr.created_at
    FROM "salesRecords" sr
    ORDER BY sr.created_at DESC;

    -- View: learning progress with user info
    CREATE OR REPLACE VIEW v_learning_progress AS
    SELECT
      lr.id, lr.user_id, lr.user_name, lr.province, lr.store,
      lr.course_id, lr.course_title, lr.specialization_id,
      lr.video_progress, lr.video_completed, lr.quiz_completed, lr.points_earned,
      lr.updated_at
    FROM "learningRecords" lr
    ORDER BY lr.updated_at DESC;
  `;

  try {
    await supabase.rpc("exec_sql", { sql: viewsSql });
    console.log("Views created successfully.");
  } catch (e) {
    console.warn("Could not create views via RPC:", e.message);
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

// ─── Relational column helpers ───
// Extract values from JSONB data and sync to dedicated columns for SQL queries in Supabase Dashboard.

// Tables that have user-linked records: we extract userId, userName, province, store
const USER_LINKED_TABLES = ["attempts", "learningRecords", "redemptions", "salesRecords", "surveys"];

// Extra columns to extract per table (beyond the 4 standard user fields)
const TABLE_EXTRA_COLUMNS = {
  surveys: [
    { jsonField: "model",        colName: "tv_model",     colType: "TEXT" },
    { jsonField: "prize",        colName: "prize",         colType: "TEXT" },
    { jsonField: null,           colName: "receipt_url",   colType: "TEXT",  extract: (item) => item.receipt?.url || item.receipt?.dataUrl || null }
  ],
  learningRecords: [
    { jsonField: "courseId",         colName: "course_id",         colType: "TEXT" },
    { jsonField: "courseTitle",      colName: "course_title",      colType: "TEXT" },
    { jsonField: "specializationId", colName: "specialization_id", colType: "TEXT" },
    { jsonField: "videoProgress",    colName: "video_progress",    colType: "FLOAT" },
    { jsonField: "videoCompleted",   colName: "video_completed",   colType: "BOOLEAN" },
    { jsonField: "quizCompleted",    colName: "quiz_completed",    colType: "BOOLEAN" },
    { jsonField: "pointsEarned",     colName: "points_earned",     colType: "INTEGER" }
  ],
  redemptions: [
    { jsonField: "itemId",      colName: "item_id",    colType: "TEXT" },
    { jsonField: "itemName",    colName: "item_name",  colType: "TEXT" },
    { jsonField: "cost",        colName: "cost",       colType: "INTEGER" }
  ],
  salesRecords: [
    { jsonField: "model",         colName: "model",         colType: "TEXT" },
    { jsonField: "barcodeNumber", colName: "barcode_number", colType: "TEXT" },
    { jsonField: null,            colName: "image_url",     colType: "TEXT", extract: (item) => item.image?.url || item.image?.dataUrl || null }
  ],
  attempts: [
    { jsonField: "courseId",    colName: "course_id",    colType: "TEXT" },
    { jsonField: "courseTitle", colName: "course_title", colType: "TEXT" },
    { jsonField: "passed",      colName: "passed",       colType: "BOOLEAN" },
    { jsonField: "answer",      colName: "answer",       colType: "TEXT" }
  ]
};

const STANDARD_USER_COLUMNS = [
  { jsonField: "userId",   colName: "user_id",   colType: "TEXT" },
  { jsonField: "userName", colName: "user_name", colType: "TEXT" },
  { jsonField: "province", colName: "province",  colType: "TEXT" },
  { jsonField: "store",    colName: "store",     colType: "TEXT" }
];

function buildRelationalPayload(store, item) {
  const payload = { id: item.id, data: item, updated_at: new Date().toISOString() };

  if (USER_LINKED_TABLES.includes(store)) {
    for (const col of STANDARD_USER_COLUMNS) {
      // surveys table uses "name" instead of "userName" for the user's display name
      let value = item[col.jsonField] ?? null;
      if (col.jsonField === "userName" && value == null) {
        value = item["name"] ?? null;
      }
      payload[col.colName] = value;
    }
  }

  const extraCols = TABLE_EXTRA_COLUMNS[store];
  if (extraCols) {
    for (const col of extraCols) {
      if (col.extract) {
        payload[col.colName] = col.extract(item);
      } else {
        payload[col.colName] = item[col.jsonField] ?? null;
      }
    }
  }

  return payload;
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
  const payload = buildRelationalPayload(store, item);
  const { error } = await supabase
    .from(store)
    .upsert(payload);
  if (error) {
    // If the error is about a missing column in schema cache, retry with base columns only
    if (error.message && error.message.includes("Could not find") && error.message.includes("schema cache")) {
      console.warn(`Schema cache miss on ${store}, retrying with base columns only:`, error.message);
      const basePayload = { id: item.id, data: item, updated_at: new Date().toISOString() };
      const { error: retryError } = await supabase.from(store).upsert(basePayload);
      if (retryError) throw new Error(retryError.message);
      return;
    }
    throw new Error(error.message);
  }
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

  // ── Storage stats ──
  if (url.pathname === "/api/stats" && req.method === "GET") {
    try {
      if (useSupabase && supabase) {
        const counts = {};
        let totalDbBytes = 0;
        let totalImageBytes = 0;
        let imageCount = 0;

        for (const store of stores) {
          try {
            const { count, error } = await supabase
              .from(store)
              .select("*", { count: "exact", head: true });
            counts[store] = error ? 0 : (count || 0);
          } catch { counts[store] = 0; }
        }

        // Estimate DB storage: query all data and measure JSON size
        for (const store of stores) {
          try {
            const { data } = await supabase.from(store).select("data");
            if (data) {
              totalDbBytes += new Blob([JSON.stringify(data)]).size;
            }
          } catch {}
        }

        // Check Supabase storage for images
        try {
          const { data: files, error: storageErr } = await supabase.storage.from("images").list();
          if (!storageErr && files) {
            imageCount = files.length;
            totalImageBytes = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
          }
        } catch {}

        sendJson(res, 200, {
          storage: "supabase",
          dbEstimateBytes: totalDbBytes,
          imageCount,
          imageEstimateBytes: totalImageBytes,
          counts,
          limits: { dbMaxMB: 500, storageMaxMB: 1024 }
        });
      } else {
        // File-based storage
        const data = readData();
        const counts = {};
        let totalDbBytes = 0;
        for (const store of stores) {
          counts[store] = (data[store] || []).length;
          totalDbBytes += JSON.stringify(data[store] || []).length;
        }
        sendJson(res, 200, {
          storage: "file",
          dbEstimateBytes: totalDbBytes,
          imageCount: 0,
          imageEstimateBytes: 0,
          counts,
          limits: { dbMaxMB: 500, storageMaxMB: 1024 }
        });
      }
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  // ── Image upload ──
  // Limit: max 500KB after base64 decode (~667KB base64 string)
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
      // Server-side size check: validate decoded image size
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
