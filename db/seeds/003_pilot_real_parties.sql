-- Seed: Pilot with 5 real electoral programs (2026 Spanish General Elections)
-- This seed creates entities and sources for real parties with uploaded PDFs.
-- The PDFs must be in the storage/ directory.
-- Run after 001_dimensions.sql and 002_demo_release.sql.

-- 1. Create entities for real parties (ignore if exists)
INSERT INTO entities (name, type, is_historical, description)
VALUES 
  ('PSOE', 'party', false, 'Partido Socialista Obrero Español'),
  ('PP', 'party', false, 'Partido Popular'),
  ('Vox', 'party', false, 'Vox'),
  ('Sumar', 'party', false, 'Sumar plataforma progresista'),
  ('ERC', 'party', false, 'Esquerra Republicana de Catalunya')
ON CONFLICT DO NOTHING;

-- 2. Create sources linked to entities (ignore if exists)
-- The storage_path references files in the storage/ directory
INSERT INTO sources (entity_id, title, type, storage_path, language, status)
SELECT e.id, s.title, 'program', s.path, 'es', 'uploaded'
FROM (VALUES
  ('PSOE', 'Programa Electoral PSOE 2026', './storage/psoe_PROGRAMA_PSOE_29N26.pdf'),
  ('PP', 'Programa Electoral PP 2026', './storage/pp_PROGRAMA-ELECTORAL-PP-2026-RECONSTRUCCION-NACIONAL.pdf'),
  ('Vox', 'Programa Electoral Vox 2026', './storage/vox_Programa-completo-A5-1.pdf'),
  ('Sumar', 'Programa Electoral Sumar 2026', './storage/Castellano.pdf'),
  ('ERC', 'Programa Electoral ERC 2026', './storage/erc_e2026-programa.pdf')
) AS s(party, title, path)
JOIN entities e ON e.name = s.party
ON CONFLICT DO NOTHING;

-- Verification
SELECT e.name AS party, s.title, s.status, s.storage_path
FROM sources s
JOIN entities e ON e.id = s.entity_id
WHERE e.name IN ('PSOE', 'PP', 'Vox', 'Sumar', 'ERC')
ORDER BY e.name;
