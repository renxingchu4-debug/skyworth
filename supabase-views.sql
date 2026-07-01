-- ============================================================================
-- SKYWORTH Learning Platform — Supabase SQL Views & Migration
-- Run this in Supabase Dashboard → SQL Editor if auto-migration fails.
-- ============================================================================

-- 1. Add relational columns to existing tables (safe to re-run)
ALTER TABLE attempts    ADD COLUMN IF NOT EXISTS user_id TEXT, ADD COLUMN IF NOT EXISTS user_name TEXT, ADD COLUMN IF NOT EXISTS province TEXT, ADD COLUMN IF NOT EXISTS store TEXT, ADD COLUMN IF NOT EXISTS course_id TEXT, ADD COLUMN IF NOT EXISTS course_title TEXT, ADD COLUMN IF NOT EXISTS passed BOOLEAN, ADD COLUMN IF NOT EXISTS answer TEXT;
ALTER TABLE surveys     ADD COLUMN IF NOT EXISTS user_id TEXT, ADD COLUMN IF NOT EXISTS user_name TEXT, ADD COLUMN IF NOT EXISTS province TEXT, ADD COLUMN IF NOT EXISTS store TEXT, ADD COLUMN IF NOT EXISTS tv_model TEXT, ADD COLUMN IF NOT EXISTS prize TEXT, ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE "learningRecords" ADD COLUMN IF NOT EXISTS user_id TEXT, ADD COLUMN IF NOT EXISTS user_name TEXT, ADD COLUMN IF NOT EXISTS province TEXT, ADD COLUMN IF NOT EXISTS store TEXT, ADD COLUMN IF NOT EXISTS course_id TEXT, ADD COLUMN IF NOT EXISTS course_title TEXT, ADD COLUMN IF NOT EXISTS specialization_id TEXT, ADD COLUMN IF NOT EXISTS video_progress FLOAT, ADD COLUMN IF NOT EXISTS video_completed BOOLEAN, ADD COLUMN IF NOT EXISTS quiz_completed BOOLEAN, ADD COLUMN IF NOT EXISTS points_earned INTEGER;
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS user_id TEXT, ADD COLUMN IF NOT EXISTS user_name TEXT, ADD COLUMN IF NOT EXISTS province TEXT, ADD COLUMN IF NOT EXISTS store TEXT, ADD COLUMN IF NOT EXISTS item_id TEXT, ADD COLUMN IF NOT EXISTS item_name TEXT, ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE "salesRecords" ADD COLUMN IF NOT EXISTS user_id TEXT, ADD COLUMN IF NOT EXISTS user_name TEXT, ADD COLUMN IF NOT EXISTS province TEXT, ADD COLUMN IF NOT EXISTS store TEXT, ADD COLUMN IF NOT EXISTS model TEXT, ADD COLUMN IF NOT EXISTS barcode_number TEXT, ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create indexes for fast user-based lookups
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_user_id ON "salesRecords"(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_user_id ON "learningRecords"(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);

-- 3. Convenience Views — use these in Supabase SQL Editor for quick queries

-- Lucky Draw: surveys with user info + receipt URL + prize
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

-- User Summary: one row per user with all stats
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
  SELECT user_id, COUNT(*) AS draw_count,
    COUNT(*) FILTER (WHERE prize IS NOT NULL AND prize != '' AND prize != 'Missed') AS win_count
  FROM surveys GROUP BY user_id
) sv ON sv.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS sales_count FROM "salesRecords" GROUP BY user_id
) sr ON sr.user_id = u.id
ORDER BY points_available DESC;

-- Redemptions with user info
CREATE OR REPLACE VIEW v_redemptions AS
SELECT
  r.id, r.user_id, r.user_name, r.province, r.store,
  r.item_id, r.item_name, r.cost, r.created_at
FROM redemptions r
ORDER BY r.created_at DESC;

-- Sales Records with user info
CREATE OR REPLACE VIEW v_sales_records AS
SELECT
  sr.id, sr.user_id, sr.user_name, sr.province, sr.store,
  sr.model, sr.barcode_number, sr.image_url, sr.created_at
FROM "salesRecords" sr
ORDER BY sr.created_at DESC;

-- Learning Progress with user info
CREATE OR REPLACE VIEW v_learning_progress AS
SELECT
  lr.id, lr.user_id, lr.user_name, lr.province, lr.store,
  lr.course_id, lr.course_title, lr.specialization_id,
  lr.video_progress, lr.video_completed, lr.quiz_completed, lr.points_earned,
  lr.updated_at
FROM "learningRecords" lr
ORDER BY lr.updated_at DESC;

-- ============================================================================
-- 4. Backfill existing data: extract fields from JSONB into new columns
--    Run this once after adding columns to populate existing records.
-- ============================================================================

-- Backfill surveys
UPDATE surveys SET
  user_id     = data->>'userId',
  user_name   = COALESCE(data->>'userName', data->>'name'),
  province    = data->>'province',
  store       = data->>'store',
  tv_model    = data->>'model',
  prize       = data->>'prize',
  receipt_url = COALESCE(data->'receipt'->>'url', data->'receipt'->>'dataUrl')
WHERE user_id IS NULL;

-- Backfill learningRecords
UPDATE "learningRecords" SET
  user_id           = data->>'userId',
  user_name         = data->>'userName',
  province          = data->>'province',
  store             = data->>'store',
  course_id         = data->>'courseId',
  course_title      = data->>'courseTitle',
  specialization_id = data->>'specializationId',
  video_progress    = (data->>'videoProgress')::FLOAT,
  video_completed   = (data->>'videoCompleted')::BOOLEAN,
  quiz_completed    = (data->>'quizCompleted')::BOOLEAN,
  points_earned     = (data->>'pointsEarned')::INTEGER
WHERE user_id IS NULL;

-- Backfill redemptions
UPDATE redemptions SET
  user_id   = data->>'userId',
  user_name = data->>'userName',
  province  = data->>'province',
  store     = data->>'store',
  item_id   = data->>'itemId',
  item_name = data->>'itemName',
  cost      = (data->>'cost')::INTEGER
WHERE user_id IS NULL;

-- Backfill salesRecords
UPDATE "salesRecords" SET
  user_id        = data->>'userId',
  user_name      = data->>'userName',
  province       = data->>'province',
  store          = data->>'store',
  model          = data->>'model',
  barcode_number = data->>'barcodeNumber',
  image_url      = COALESCE(data->'image'->>'url', data->'image'->>'dataUrl')
WHERE user_id IS NULL;

-- Backfill attempts
UPDATE attempts SET
  user_id      = data->>'userId',
  user_name    = COALESCE(data->>'userName', data->>'studentName'),
  province     = data->>'province',
  store        = data->>'store',
  course_id    = data->>'courseId',
  course_title = data->>'courseTitle',
  passed       = (data->>'passed')::BOOLEAN,
  answer       = data->>'answer'
WHERE user_id IS NULL;
