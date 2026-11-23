-- Seed: 001_dimensions
-- Inserts base dimensions and topics

INSERT INTO dimensions (code, name, description, is_scoring_dimension) VALUES
('economy', 'Economía', 'Política económica, fiscal y laboral', true),
('social', 'Social', 'Sanidad, educación, vivienda, bienestar', true),
('rights', 'Derechos', 'Derechos civiles, libertades, igualdad', true),
('territory', 'Territorio', 'Modelo de Estado, descentralización', true),
('institutions', 'Instituciones', 'Sistema político, justicia, seguridad', true),
('environment', 'Medio ambiente', 'Cambio climático, energía, territorio', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO topics (code, name, dimension_id, depth) VALUES
('economy.fiscal', 'Política fiscal', (SELECT id FROM dimensions WHERE code = 'economy'), 1),
('economy.labor', 'Mercado laboral', (SELECT id FROM dimensions WHERE code = 'economy'), 1),
('social.health', 'Sanidad', (SELECT id FROM dimensions WHERE code = 'social'), 1),
('social.education', 'Educación', (SELECT id FROM dimensions WHERE code = 'social'), 1),
('social.housing', 'Vivienda', (SELECT id FROM dimensions WHERE code = 'social'), 1),
('rights.civil', 'Derechos civiles', (SELECT id FROM dimensions WHERE code = 'rights'), 1),
('rights.equality', 'Igualdad', (SELECT id FROM dimensions WHERE code = 'rights'), 1),
('territory.model', 'Modelo de Estado', (SELECT id FROM dimensions WHERE code = 'territory'), 1),
('institutions.system', 'Sistema político', (SELECT id FROM dimensions WHERE code = 'institutions'), 1),
('institutions.justice', 'Justicia', (SELECT id FROM dimensions WHERE code = 'institutions'), 1),
('environment.climate', 'Cambio climático', (SELECT id FROM dimensions WHERE code = 'environment'), 1),
('environment.energy', 'Energía', (SELECT id FROM dimensions WHERE code = 'environment'), 1)
ON CONFLICT (code) DO NOTHING;
