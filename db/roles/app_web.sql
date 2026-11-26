-- Rol de la APLICACIÓN sin privilegios de superusuario (incidente I21: con `app` como superusuario se pudieron desactivar disparadores y alterar marcas de tiempo por SQL directo).
-- Un rol que NO es propietario de las tablas ni superusuario no puede: ALTER TABLE … DISABLE TRIGGER, SET session_replication_role, ni saltarse los disparadores de solo añadir.
-- Además se revocan UPDATE/DELETE/TRUNCATE sobre las tablas de solo añadir (defensa en profundidad).
-- Uso (la contraseña NO se guarda en el repositorio):  psql -d affinity -v app_web_password='…' -f db/roles/app_web.sql
-- Luego, apuntar DATABASE_URL de la aplicación a este rol: postgresql://app_web:<contraseña>@localhost:5433/affinity
SELECT format('CREATE ROLE app_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'app_web_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_web') \gexec
GRANT CONNECT ON DATABASE affinity TO app_web;
GRANT USAGE ON SCHEMA public TO app_web;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_web;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_web;
REVOKE UPDATE, DELETE, TRUNCATE ON position_codings, eval_audit, eval_cell_versions, eval_adjudications, eval_provenance, eval_authorship, eval_sample_design, eval_absence_checks FROM app_web;
REVOKE DELETE, TRUNCATE ON eval_drafts FROM app_web;
