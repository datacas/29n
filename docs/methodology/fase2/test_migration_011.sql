-- Pruebas de la migración 011 (BD TEMPORAL con 010 y 011 aplicadas y al menos una evaluación finalizada; todo se revierte).
-- Uso: psql -v ON_ERROR_STOP=1 -d <bd_temporal> -f docs/methodology/fase2/test_migration_011.sql
BEGIN;
CREATE TEMP TABLE _r (name text, ok boolean);
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN BEGIN EXECUTE stmt; INSERT INTO _r VALUES (name, false); EXCEPTION WHEN OTHERS THEN INSERT INTO _r VALUES (name, true); END; END $f$;
CREATE OR REPLACE FUNCTION pg_temp.expect_ok(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN BEGIN EXECUTE stmt; INSERT INTO _r VALUES (name, true); EXCEPTION WHEN OTHERS THEN INSERT INTO _r VALUES (name || ' [' || SQLERRM || ']', false); END; END $f$;

CREATE TEMP TABLE _fx AS SELECT d.cell_id, d.evaluator_id FROM eval_drafts d WHERE d.finalized_at IS NOT NULL LIMIT 1;
-- Una celda sin evaluación propia finalizada (se crea una auxiliar sin borrador)
INSERT INTO eval_campaigns (id, name, manual_version, manual_text, selection_method, selection_bias_note) VALUES ('00000000-0000-0000-0000-0000000000c9', 'aux', 'v', 'm', 's', 'b');
INSERT INTO eval_cells (id, campaign_id, ord, question_id, entity_id, blind_label, party_name)
  SELECT '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c9', 1, c.question_id, c.entity_id, 'Partido X', 'X' FROM eval_cells c WHERE c.id = (SELECT cell_id FROM _fx);

SELECT pg_temp.expect_ok('adjudicación completa (varias causas)', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, document_class, intensity, rationale, causes, proposed_action)
  SELECT cell_id, evaluator_id, 'opposes', -1, 'verificado en el programa', ARRAY['omitted_position','intensity_error'], 'add_position' FROM _fx$$);
SELECT pg_temp.expect_fail('sin causa', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, revision) SELECT cell_id, evaluator_id, 'x', 2 FROM _fx$$);
SELECT pg_temp.expect_fail('causa desconocida', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, revision) SELECT cell_id, evaluator_id, 'x', ARRAY['mayoria'], 2 FROM _fx$$);
SELECT pg_temp.expect_fail('«otra causa» exige texto', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, revision) SELECT cell_id, evaluator_id, 'x', ARRAY['other'], 2 FROM _fx$$);
SELECT pg_temp.expect_ok('«otra causa» con texto', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, other_cause_text, revision) SELECT cell_id, evaluator_id, 'x', ARRAY['other'], 'motivo', 2 FROM _fx$$);
SELECT pg_temp.expect_fail('justificación vacía', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, revision) SELECT cell_id, evaluator_id, '  ', ARRAY['reasonable_disagreement'], 3 FROM _fx$$);
SELECT pg_temp.expect_fail('intensidad incoherente con la clase', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, document_class, intensity, rationale, causes, revision) SELECT cell_id, evaluator_id, 'supports', -1, 'x', ARRAY['intensity_error'], 3 FROM _fx$$);
SELECT pg_temp.expect_ok('sin resolver (sin clase) con desacuerdo razonable', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, revision) SELECT cell_id, evaluator_id, 'no se puede decidir', ARRAY['reasonable_disagreement'], 3 FROM _fx$$);
SELECT pg_temp.expect_fail('revisión repetida', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, revision) SELECT cell_id, evaluator_id, 'x', ARRAY['other'], 3 FROM _fx$$);
SELECT pg_temp.expect_fail('revisión con salto', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, revision) SELECT cell_id, evaluator_id, 'x', ARRAY['intensity_error'], 7 FROM _fx$$);
SELECT pg_temp.expect_fail('acción propuesta inválida', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, proposed_action, revision) SELECT cell_id, evaluator_id, 'x', ARRAY['intensity_error'], 'aplicar_ya', 4 FROM _fx$$);
SELECT pg_temp.expect_fail('no se puede marcar como aplicada', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes, applied, revision) SELECT cell_id, evaluator_id, 'x', ARRAY['intensity_error'], true, 4 FROM _fx$$);
SELECT pg_temp.expect_fail('UPDATE bloqueado', $$UPDATE eval_adjudications SET rationale = 'cambio'$$);
SELECT pg_temp.expect_fail('DELETE bloqueado', $$DELETE FROM eval_adjudications$$);
SELECT pg_temp.expect_fail('sin evaluación propia finalizada no se adjudica', $$INSERT INTO eval_adjudications (cell_id, adjudicator_id, rationale, causes) SELECT '00000000-0000-0000-0000-0000000000f1', evaluator_id, 'x', ARRAY['intensity_error'] FROM _fx$$);
SELECT name, CASE WHEN ok THEN 'OK' ELSE 'FALLO' END AS resultado FROM _r ORDER BY ok, name;
SELECT count(*) FILTER (WHERE ok) AS correctas, count(*) FILTER (WHERE NOT ok) AS fallos FROM _r;
ROLLBACK;
