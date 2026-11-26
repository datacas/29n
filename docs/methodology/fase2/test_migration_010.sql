-- Pruebas de la migración 010 (ejecutar en una BD TEMPORAL con las migraciones aplicadas; todo en una transacción que se revierte).
-- Uso: psql -v ON_ERROR_STOP=1 -d <bd_temporal> -f docs/methodology/fase2/test_migration_010.sql
BEGIN;
CREATE TEMP TABLE _r (name text, ok boolean);
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  BEGIN
    EXECUTE stmt;
    INSERT INTO _r VALUES (name, false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES (name, true);
  END;
END $f$;
CREATE OR REPLACE FUNCTION pg_temp.expect_ok(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  BEGIN
    EXECUTE stmt;
    INSERT INTO _r VALUES (name, true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES (name || ' [' || SQLERRM || ']', false);
  END;
END $f$;

CREATE TEMP TABLE _fx AS SELECT (SELECT id FROM entities LIMIT 1) AS ent, (SELECT id FROM questions LIMIT 1) AS q;
INSERT INTO eval_evaluators (id, label, affiliation) VALUES ('00000000-0000-0000-0000-0000000000a1', 'Humano interno 1', 'internal');
INSERT INTO eval_campaigns (id, name, manual_version, manual_text, selection_method, selection_bias_note)
  VALUES ('00000000-0000-0000-0000-0000000000c1', 'test', 'v0', 'manual', 'dirigida', 'sesgo');
INSERT INTO eval_cells (id, campaign_id, ord, question_id, entity_id, blind_label, party_name)
  SELECT '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 1, q, ent, 'Partido A', 'X' FROM _fx;

-- position_codings: clase documental / contexto insuficiente / estado técnico
SELECT pg_temp.expect_ok('coding: clase + ok', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity)
  SELECT gen_random_uuid(), ent, q, 'human', 'Humano interno 1', 'h', 'ok', 'supports', 1 FROM _fx$$);
SELECT pg_temp.expect_ok('coding: contexto insuficiente sin clase (ok técnico)', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, insufficient_context)
  SELECT gen_random_uuid(), ent, q, 'human', 'Humano interno 1', 'h', 'ok', true FROM _fx$$);
SELECT pg_temp.expect_fail('coding: ok sin clase ni insuficiencia', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status)
  SELECT gen_random_uuid(), ent, q, 'human', 'x', 'h', 'ok' FROM _fx$$);
SELECT pg_temp.expect_fail('coding: fallo técnico con clase', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity)
  SELECT gen_random_uuid(), ent, q, 'ai', 'x', 'h', 'timeout', 'supports', 1 FROM _fx$$);
SELECT pg_temp.expect_fail('coding: fallo técnico con insufficient_context', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, insufficient_context)
  SELECT gen_random_uuid(), ent, q, 'ai', 'x', 'h', 'timeout', true FROM _fx$$);
SELECT pg_temp.expect_fail('coding: contexto insuficiente NO es estado técnico', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status)
  SELECT gen_random_uuid(), ent, q, 'human', 'x', 'h', 'insufficient_context' FROM _fx$$);
SELECT pg_temp.expect_fail('coding: intensidad incoherente', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, execution_status, document_class, intensity)
  SELECT gen_random_uuid(), ent, q, 'human', 'x', 'h', 'ok', 'supports', -1 FROM _fx$$);
SELECT pg_temp.expect_fail('coding: UPDATE bloqueado', $$UPDATE position_codings SET rationale = 'x'$$);
SELECT pg_temp.expect_fail('coding: DELETE bloqueado', $$DELETE FROM position_codings$$);
SELECT pg_temp.expect_fail('coding: TRUNCATE bloqueado', $$TRUNCATE position_codings$$);

-- unicidad de evaluación finalizada por (campaña, evaluador, celda, revisión); una revisión nueva sí es posible
SELECT pg_temp.expect_ok('coding eval: primera', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, campaign_id, evaluator_id, revision, execution_status, document_class, intensity)
  SELECT gen_random_uuid(), ent, q, 'human', 'Humano interno 1', 'h', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 1, 'ok', 'opposes', -1 FROM _fx$$);
SELECT pg_temp.expect_fail('coding eval: duplicado misma revisión', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, campaign_id, evaluator_id, revision, execution_status, document_class, intensity)
  SELECT gen_random_uuid(), ent, q, 'human', 'Humano interno 1', 'h', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 1, 'ok', 'supports', 1 FROM _fx$$);
SELECT pg_temp.expect_ok('coding eval: revisión 2 conserva la original', $$INSERT INTO position_codings (run_id, entity_id, question_id, evaluator_kind, evaluator_label, item_text_sha256, campaign_id, evaluator_id, revision, execution_status, document_class, intensity)
  SELECT gen_random_uuid(), ent, q, 'human', 'Humano interno 1', 'h', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 2, 'ok', 'supports', 1 FROM _fx$$);

-- versiones de celda inmutables
INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ('00000000-0000-0000-0000-0000000000e1', 1, '{}', 'abc', 'inicial');
SELECT pg_temp.expect_fail('cell_versions: UPDATE bloqueado', $$UPDATE eval_cell_versions SET reason = 'x'$$);
SELECT pg_temp.expect_fail('cell_versions: DELETE bloqueado', $$DELETE FROM eval_cell_versions$$);
SELECT pg_temp.expect_fail('cell_versions: versión duplicada', $$INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ('00000000-0000-0000-0000-0000000000e1', 1, '{}', 'abc', 'dup')$$);
SELECT pg_temp.expect_ok('cell_versions: versión 2 (contexto añadido)', $$INSERT INTO eval_cell_versions (cell_id, version, snapshot, sha256, reason) VALUES ('00000000-0000-0000-0000-0000000000e1', 2, '{}', 'abd', 'contexto')$$);

-- borradores: sin valores por defecto, mutables hasta finalizar
INSERT INTO eval_drafts (cell_id, evaluator_id, cell_version) VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 1);
SELECT pg_temp.expect_ok('draft: sin clase ni intensidad por defecto', $$SELECT 1 FROM eval_drafts WHERE document_class IS NULL AND intensity IS NULL AND NOT insufficient_context$$);
SELECT pg_temp.expect_fail('draft: clase inválida', $$UPDATE eval_drafts SET document_class = 'conditional'$$);
SELECT pg_temp.expect_ok('draft: editable antes de finalizar', $$UPDATE eval_drafts SET document_class = 'supports', intensity = 1, version = version + 1$$);

-- adjudicación: puerta (no se adjudica sin finalizar la evaluación propia)
SELECT pg_temp.expect_fail('adjudicación sin evaluación propia finalizada', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, document_class, intensity, rationale)
  VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'supports', 1, 'x')$$);
UPDATE eval_drafts SET finalized_at = now();
SELECT pg_temp.expect_fail('draft finalizado: UPDATE bloqueado', $$UPDATE eval_drafts SET rationale = 'x'$$);
SELECT pg_temp.expect_fail('draft: DELETE bloqueado', $$DELETE FROM eval_drafts$$);
SELECT pg_temp.expect_ok('adjudicación tras finalizar', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, document_class, intensity, rationale)
  VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'supports', 1, 'x')$$);
SELECT pg_temp.expect_fail('adjudicación: UPDATE bloqueado', $$UPDATE eval_adjudications SET rationale = 'y'$$);
SELECT pg_temp.expect_fail('adjudicación: DELETE bloqueado', $$DELETE FROM eval_adjudications$$);

-- auditoría solo añadir
INSERT INTO eval_audit (action) VALUES ('test');
SELECT pg_temp.expect_fail('audit: UPDATE bloqueado', $$UPDATE eval_audit SET action = 'x'$$);
SELECT pg_temp.expect_fail('audit: DELETE bloqueado', $$DELETE FROM eval_audit$$);

SELECT name, CASE WHEN ok THEN 'OK' ELSE 'FALLO' END AS resultado FROM _r ORDER BY ok, name;
SELECT count(*) FILTER (WHERE ok) AS correctas, count(*) FILTER (WHERE NOT ok) AS fallos FROM _r;
ROLLBACK;
