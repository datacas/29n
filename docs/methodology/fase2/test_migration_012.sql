-- Pruebas de la migración 012 (BD temporal con 010–012; todo se revierte).
BEGIN;
CREATE TEMP TABLE _r (name text, ok boolean);
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN BEGIN EXECUTE stmt; INSERT INTO _r VALUES (name, false); EXCEPTION WHEN OTHERS THEN INSERT INTO _r VALUES (name, true); END; END $f$;
CREATE OR REPLACE FUNCTION pg_temp.expect_ok(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN BEGIN EXECUTE stmt; INSERT INTO _r VALUES (name, true); EXCEPTION WHEN OTHERS THEN INSERT INTO _r VALUES (name || ' [' || SQLERRM || ']', false); END; END $f$;
CREATE TEMP TABLE _fx AS SELECT e.id AS ev, k.id AS camp FROM eval_evaluators e, eval_campaigns k LIMIT 1;
SELECT pg_temp.expect_ok('registro válido', $$INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) SELECT ev, camp, 'all', 'human_verified', 'verificado' FROM _fx$$);
SELECT pg_temp.expect_fail('procedencia inválida', $$INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) SELECT ev, camp, 'all', 'humano', 'x' FROM _fx$$);
SELECT pg_temp.expect_fail('ámbito inválido', $$INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) SELECT ev, camp, 'todo', 'ai_agent', 'x' FROM _fx$$);
SELECT pg_temp.expect_fail('declaración vacía', $$INSERT INTO eval_provenance (evaluator_id, campaign_id, scope, provenance, statement) SELECT ev, camp, 'all', 'ai_agent', '  ' FROM _fx$$);
SELECT pg_temp.expect_fail('UPDATE bloqueado', $$UPDATE eval_provenance SET provenance = 'human_verified'$$);
SELECT pg_temp.expect_fail('DELETE bloqueado', $$DELETE FROM eval_provenance$$);
SELECT name, CASE WHEN ok THEN 'OK' ELSE 'FALLO' END FROM _r ORDER BY ok, name;
SELECT count(*) FILTER (WHERE ok) AS correctas, count(*) FILTER (WHERE NOT ok) AS fallos FROM _r;
ROLLBACK;
