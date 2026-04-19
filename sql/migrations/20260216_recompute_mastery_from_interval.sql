-- Recompute mastery_level from interval_days so UI tabs (New / Beginner / …) match SRS spacing.
-- Run once in Supabase SQL editor after deploying backend srs.py change.
-- Tier 0 = never advanced (no successful path) or treat as "new" band; we use interval + review_count:

UPDATE user_reviews
SET mastery_level = CASE
  WHEN COALESCE(review_count, 0) = 0 THEN 0
  WHEN COALESCE(interval_days, 0) <= 0 THEN 0
  WHEN interval_days < 7 THEN 1
  WHEN interval_days < 14 THEN 2
  WHEN interval_days < 30 THEN 3
  WHEN interval_days < 60 THEN 4
  ELSE 5
END;
