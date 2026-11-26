-- Prueba de la migración 009 sobre una BD temporal con el esquema copiado (sin datos reales).
-- Uso: crear BD vacía con `pg_dump --schema-only`, aplicar 009 y ejecutar este fichero con ON_ERROR_STOP=1.
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO entities (id, name, type) VALUES ('00000000-0000-0000-0000-0000000000e1', 'Partido de prueba', 'party');
INSERT INTO questions (id, canonical_text) VALUES ('00000000-0000-0000-0000-0000000000a1', '¿Pregunta de prueba?');
CREATE TEMP TABLE t_results (caso text, esperado text, obtenido text);

CREATE OR REPLACE FUNCTION pg_temp.try(caso text, esperado text, sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := 'ok';
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN OTHERS THEN r := 'error: ' || SQLSTATE; END;
  INSERT INTO t_results VALUES (caso, esperado, r);
END $$;

\set base '(run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity)'
SELECT pg_temp.try('supports +2', 'ok', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'ok', 'supports', 2)$$);
SELECT pg_temp.try('explicit_neutral 0', 'ok', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'ok', 'explicit_neutral', 0)$$);
SELECT pg_temp.try('not_mentioned sin intensidad', 'ok', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'ok', 'not_mentioned', NULL)$$);
SELECT pg_temp.try('timeout sin clase', 'ok', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'timeout', NULL, NULL)$$);
SELECT pg_temp.try('supports con -1', 'error: 23514', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'ok', 'supports', -1)$$);
SELECT pg_temp.try('not_mentioned con 0', 'error: 23514', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'ok', 'not_mentioned', 0)$$);
SELECT pg_temp.try('fallo de API con clase not_mentioned', 'error: 23514', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'api_error', 'not_mentioned', NULL)$$);
SELECT pg_temp.try('ejecución ok sin clase', 'error: 23514', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'ok', NULL, NULL)$$);
SELECT pg_temp.try('estado técnico desconocido', 'error: 23514', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'ai', 't', 'x', 'raro', NULL, NULL)$$);
SELECT pg_temp.try('UPDATE bloqueado', 'error: 23001', $$UPDATE position_codings SET rationale = 'x'$$);
SELECT pg_temp.try('DELETE bloqueado', 'error: 23001', $$DELETE FROM position_codings$$);
SELECT pg_temp.try('TRUNCATE bloqueado', 'error: 23001', $$TRUNCATE position_codings$$);
SELECT caso, esperado, obtenido, CASE WHEN esperado = obtenido THEN 'PASA' ELSE 'FALLA' END AS resultado FROM t_results;
SELECT CASE WHEN count(*) FILTER (WHERE esperado <> obtenido) = 0 THEN 'TODAS LAS PRUEBAS PASAN' ELSE 'HAY FALLOS' END FROM t_results;
ROLLBACK;
