-- ============================================================
-- DUPLICATE CHECK QUERIES
-- Run individually in Supabase SQL Editor
-- ============================================================

-- 1. EXACT IMAGE HASH MATCH (identical image file uploaded more than once)
-- Even with dHash disabled, SHA-256 still catches byte-identical files
SELECT u.name, u.team_id, a.sport_type, a.start_date::date,
       a.image_hash, COUNT(*) AS copies
FROM activities a
JOIN users u ON a.user_id = u.id
WHERE a.image_hash IS NOT NULL
GROUP BY a.image_hash, u.name, u.team_id, a.sport_type, a.start_date::date
HAVING COUNT(*) > 1
ORDER BY copies DESC;

-- 2. SAME USER + DATE + SPORT + SIMILAR DISTANCE (< 2 meters)
-- Classic combo duplicate — exact same activity submitted again
SELECT u.name, u.team_id, a1.sport_type, a1.start_date::date,
       ROUND(a1.distance) AS dist1_m, ROUND(a2.distance) AS dist2_m,
       ROUND(ABS(a1.distance - a2.distance)::numeric, 1) AS diff_m,
       a1.id AS id1, a2.id AS id2
FROM activities a1
JOIN activities a2 ON a1.user_id = a2.user_id
  AND a1.start_date::date = a2.start_date::date
  AND a1.sport_type = a2.sport_type
  AND a1.id < a2.id
  AND ABS(a1.distance - a2.distance) < 2
JOIN users u ON a1.user_id = u.id
ORDER BY a1.start_date DESC;

-- 3. SAME USER — ≥3 SUBMISSIONS ON SAME DAY (bulk)
-- Could indicate spamming or accidental re-submission
SELECT u.name, u.team_id, a.start_date::date,
       COUNT(*) AS submissions,
       STRING_AGG(a.sport_type, ' | ' ORDER BY a.created_at) AS sports
FROM activities a
JOIN users u ON a.user_id = u.id
GROUP BY u.name, u.team_id, a.start_date::date
HAVING COUNT(*) >= 3
ORDER BY submissions DESC;

-- 4. SAME SPORT SUBMITTED WITHIN 10 MINUTES (likely re-OCR of same screenshot)
SELECT u.name, u.team_id, a1.sport_type,
       a1.start_date::date,
       a1.created_at AS sub1, a2.created_at AS sub2,
       ROUND(EXTRACT(EPOCH FROM (a2.created_at - a1.created_at))/60::numeric, 1) AS min_apart
FROM activities a1
JOIN activities a2 ON a1.user_id = a2.user_id
  AND a1.sport_type = a2.sport_type
  AND a1.id < a2.id
  AND a2.created_at - a1.created_at <= INTERVAL '10 minutes'
JOIN users u ON a1.user_id = u.id
ORDER BY min_apart;

-- 5. NEARLY IDENTICAL CALORIES + DURATION (same activity, different screenshot)
-- Same user, same day, same sport: calories within 10, duration within 1 minute
SELECT u.name, a1.sport_type, a1.start_date::date,
       a1.calories::int AS cal1, a2.calories::int AS cal2,
       (a1.moving_time/60)::int AS dur1_m, (a2.moving_time/60)::int AS dur2_m,
       a1.id AS id1, a2.id AS id2
FROM activities a1
JOIN activities a2 ON a1.user_id = a2.user_id
  AND a1.start_date::date = a2.start_date::date
  AND a1.sport_type = a2.sport_type
  AND a1.id < a2.id
  AND ABS(a1.calories - a2.calories) < 10
  AND ABS(a1.moving_time - a2.moving_time) < 60
JOIN users u ON a1.user_id = u.id
ORDER BY a1.start_date DESC;

-- 6. DELETE DUPLICATES (keeps oldest, deletes newer copies)
-- ⚠️ RUN AFTER REVIEWING THE QUERIES ABOVE ⚠️
-- Replace 'TARGET_ID' with the duplicate activity IDs from results above
-- DELETE FROM activities WHERE id = 'TARGET_ID';
