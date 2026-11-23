-- Test suite: Release immutability triggers (10 tests)
-- Self-contained: each test creates and cleans up its own data
-- Usage: docker compose exec -T db psql -U app -d affinity < db/test-releases.sql

\echo '=== Test 1: Create draft without manifest (should succeed) ==='
DO $$
DECLARE slug text := 't1-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T1') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status) VALUES (survey_id, '1.0.0', 'draft') RETURNING id INTO release_id;
  RAISE NOTICE 'Test 1 PASS: Draft created without manifest';
  DELETE FROM survey_releases WHERE id = release_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 2: Publish without manifest (should fail) ==='
DO $$
DECLARE slug text := 't2-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T2') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status) VALUES (survey_id, '1.0.0', 'draft') RETURNING id INTO release_id;
  UPDATE survey_releases SET status = 'published' WHERE id = release_id;
  RAISE NOTICE 'Test 2 FAIL: Should have rejected';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Test 2 PASS: Rejected publish without manifest';
  DELETE FROM survey_releases WHERE consultation_id = survey_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 3: Publish with manifest and valid hash (should succeed) ==='
DO $$
DECLARE slug text := 't3-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T3') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status) VALUES (survey_id, '1.0.0', 'draft') RETURNING id INTO release_id;
  UPDATE survey_releases SET status = 'published', manifest_jsonb = '{}'::jsonb, manifest_hash = 'a'||repeat('b',63), published_at = now() WHERE id = release_id;
  RAISE NOTICE 'Test 3 PASS: Published with manifest and hash';
  UPDATE survey_releases SET status = 'archived' WHERE id = release_id;
  UPDATE survey_releases SET status = 'draft' WHERE id = release_id;
  DELETE FROM survey_releases WHERE id = release_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 4: Modify published release (should fail) ==='
DO $$
DECLARE slug text := 't4-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T4') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status, manifest_jsonb, manifest_hash, published_at) VALUES (survey_id, '1.0.0', 'published', '{}'::jsonb, 'a'||repeat('b',63), now()) RETURNING id INTO release_id;
  UPDATE survey_releases SET manifest_jsonb = '{"modified":true}'::jsonb WHERE id = release_id;
  RAISE NOTICE 'Test 4 FAIL: Should have rejected';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Test 4 PASS: Rejected modification of published';
  UPDATE survey_releases SET status = 'draft' WHERE consultation_id = survey_id;
  DELETE FROM survey_releases WHERE consultation_id = survey_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 5: Delete published release (should fail) ==='
DO $$
DECLARE slug text := 't5-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T5') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status, manifest_jsonb, manifest_hash, published_at) VALUES (survey_id, '1.0.0', 'published', '{}'::jsonb, 'a'||repeat('b',63), now()) RETURNING id INTO release_id;
  DELETE FROM survey_releases WHERE id = release_id;
  RAISE NOTICE 'Test 5 FAIL: Should have rejected';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Test 5 PASS: Rejected deletion of published';
  UPDATE survey_releases SET status = 'draft' WHERE consultation_id = survey_id;
  DELETE FROM survey_releases WHERE consultation_id = survey_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 6: Archive published release (should succeed) ==='
DO $$
DECLARE slug text := 't6-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T6') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status, manifest_jsonb, manifest_hash, published_at) VALUES (survey_id, '1.0.0', 'published', '{}'::jsonb, 'a'||repeat('b',63), now()) RETURNING id INTO release_id;
  UPDATE survey_releases SET status = 'archived' WHERE id = release_id;
  RAISE NOTICE 'Test 6 PASS: Archived published release';
  UPDATE survey_releases SET status = 'draft' WHERE id = release_id;
  DELETE FROM survey_releases WHERE id = release_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 7: Modify archived release (should fail) ==='
DO $$
DECLARE slug text := 't7-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T7') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status, manifest_jsonb, manifest_hash, published_at) VALUES (survey_id, '1.0.0', 'published', '{}'::jsonb, 'a'||repeat('b',63), now()) RETURNING id INTO release_id;
  UPDATE survey_releases SET status = 'archived' WHERE id = release_id;
  UPDATE survey_releases SET manifest_jsonb = '{}'::jsonb WHERE id = release_id;
  RAISE NOTICE 'Test 7 FAIL: Should have rejected';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Test 7 PASS: Rejected modification of archived';
  UPDATE survey_releases SET status = 'draft' WHERE consultation_id = survey_id;
  DELETE FROM survey_releases WHERE consultation_id = survey_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 8: INSERT published without manifest (should fail) ==='
DO $$
DECLARE slug text := 't8-' || substr(md5(random()::text),1,8); survey_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T8') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status) VALUES (survey_id, '1.0.0', 'published');
  RAISE NOTICE 'Test 8 FAIL: Should have rejected';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Test 8 PASS: Rejected INSERT published without manifest';
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 9: Archive with modified protected fields (should fail) ==='
DO $$
DECLARE slug text := 't9-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T9') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status, manifest_jsonb, manifest_hash, published_at) VALUES (survey_id, '1.0.0', 'published', '{}'::jsonb, 'a'||repeat('b',63), now()) RETURNING id INTO release_id;
  UPDATE survey_releases SET status = 'archived', version = '2.0.0' WHERE id = release_id;
  RAISE NOTICE 'Test 9 FAIL: Should have rejected';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Test 9 PASS: Rejected archive with modified version';
  UPDATE survey_releases SET status = 'draft' WHERE consultation_id = survey_id;
  DELETE FROM survey_releases WHERE consultation_id = survey_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== Test 10: Hash format validation ==='
DO $$
DECLARE slug text := 't10-' || substr(md5(random()::text),1,8); survey_id uuid; release_id uuid; valid boolean;
BEGIN
  INSERT INTO consultations (slug, title) VALUES (slug, 'T10') RETURNING id INTO survey_id;
  INSERT INTO survey_releases (consultation_id, version, status, manifest_jsonb, manifest_hash) VALUES (survey_id, '1.0.0', 'draft', '{}'::jsonb, 'a'||repeat('b',63)) RETURNING id INTO release_id;
  SELECT manifest_hash ~ '^[0-9a-f]{64}$' INTO valid FROM survey_releases WHERE id = release_id;
  IF valid THEN RAISE NOTICE 'Test 10 PASS: Hash format valid';
  ELSE RAISE NOTICE 'Test 10 FAIL: Hash format invalid'; END IF;
  DELETE FROM survey_releases WHERE id = release_id;
  DELETE FROM consultations WHERE id = survey_id;
END $$;

\echo '=== All 10 tests completed ==='
