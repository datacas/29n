-- Pruebas de la migración 013 (BD temporal con 010–013; todo se revierte).
BEGIN;
CREATE TEMP TABLE _r (name text, ok boolean);
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN BEGIN EXECUTE stmt; INSERT INTO _r VALUES (name, false); EXCEPTION WHEN OTHERS THEN INSERT INTO _r VALUES (name, true); END; END $f$;
CREATE OR REPLACE FUNCTION pg_temp.expect_ok(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN BEGIN EXECUTE stmt; INSERT INTO _r VALUES (name, true); EXCEPTION WHEN OTHERS THEN INSERT INTO _r VALUES (name || ' [' || SQLERRM || ']', false); END; END $f$;
CREATE TEMP TABLE _fx AS SELECT c.id AS cell, (SELECT id FROM eval_evaluators LIMIT 1) AS ev FROM eval_cells c LIMIT 1;
SELECT pg_temp.expect_ok('diseño R válido', $$INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, stratum_size, stratum_sampled, inclusion_prob, weight, seed, design_sha256) SELECT cell, 'R', 'R-negativa', 'negativa', 64, 20, 0.3125, 3.2, 1, 'x' FROM _fx$$);
SELECT pg_temp.expect_fail('una celda, un solo diseño', $$INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, stratum_size, stratum_sampled, inclusion_prob, weight, design_sha256) SELECT cell, 'T', 'T1', 's', NULL, NULL, NULL, NULL, 'x' FROM _fx$$);
SELECT pg_temp.expect_fail('R exige π y peso', $$INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, design_sha256) SELECT id, 'R', 'x', 's', 'x' FROM eval_cells WHERE id NOT IN (SELECT cell FROM _fx) LIMIT 1$$);
SELECT pg_temp.expect_fail('T no lleva π ni peso', $$INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, inclusion_prob, weight, design_sha256) SELECT id, 'T', 'x', 's', 0.5, 2, 'x' FROM eval_cells WHERE id NOT IN (SELECT cell FROM _fx) LIMIT 1$$);
SELECT pg_temp.expect_fail('π fuera de (0,1]', $$INSERT INTO eval_sample_design (cell_id, sample, tier, stratum, stratum_size, stratum_sampled, inclusion_prob, weight, design_sha256) SELECT id, 'R', 'x', 's', 10, 5, 1.5, 1, 'x' FROM eval_cells WHERE id NOT IN (SELECT cell FROM _fx) LIMIT 1$$);
SELECT pg_temp.expect_fail('diseño inmutable (UPDATE)', $$UPDATE eval_sample_design SET weight = 9$$);
SELECT pg_temp.expect_fail('diseño inmutable (DELETE)', $$DELETE FROM eval_sample_design$$);
SELECT pg_temp.expect_ok('ausencia en pasajes (no confirmada)', $$INSERT INTO eval_absence_checks (cell_id, checked_by, scope, result) SELECT cell, ev, 'retrieved_passages', 'present_found' FROM _fx$$);
SELECT pg_temp.expect_fail('ausencia confirmada exige programa completo', $$INSERT INTO eval_absence_checks (cell_id, checked_by, scope, result, search_terms) SELECT cell, ev, 'retrieved_passages', 'absent_confirmed', ARRAY['x'] FROM _fx$$);
SELECT pg_temp.expect_fail('ausencia confirmada exige términos de búsqueda', $$INSERT INTO eval_absence_checks (cell_id, checked_by, scope, result) SELECT cell, ev, 'full_program', 'absent_confirmed' FROM _fx$$);
SELECT pg_temp.expect_ok('ausencia confirmada en el programa completo', $$INSERT INTO eval_absence_checks (cell_id, checked_by, scope, result, search_terms, pages_reviewed) SELECT cell, ev, 'full_program', 'absent_confirmed', ARRAY['selectividad','PAU'], ARRAY[33,34] FROM _fx$$);
SELECT pg_temp.expect_fail('comprobaciones solo añadir', $$UPDATE eval_absence_checks SET notes = 'x'$$);
SELECT pg_temp.expect_ok('autoría: agente con autorización de la persona', $$INSERT INTO eval_authorship (record_table, record_id, author_kind, author_label, authorized_by) VALUES ('eval_adjudications', gen_random_uuid(), 'ai_agent', 'agente', 'persona responsable')$$);
SELECT pg_temp.expect_fail('autoría: tipo inválido', $$INSERT INTO eval_authorship (record_table, record_id, author_kind, author_label) VALUES ('position_codings', gen_random_uuid(), 'humano', 'x')$$);
SELECT pg_temp.expect_fail('autoría: tabla inválida', $$INSERT INTO eval_authorship (record_table, record_id, author_kind, author_label) VALUES ('positions', gen_random_uuid(), 'human', 'x')$$);
SELECT pg_temp.expect_fail('autoría solo añadir', $$DELETE FROM eval_authorship$$);
SELECT name, CASE WHEN ok THEN 'OK' ELSE 'FALLO' END FROM _r ORDER BY ok, name;
SELECT count(*) FILTER (WHERE ok) AS correctas, count(*) FILTER (WHERE NOT ok) AS fallos FROM _r;
ROLLBACK;
