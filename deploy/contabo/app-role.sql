-- Rôle PostgreSQL applicatif soumis à la RLS (audit M2) — version SQL de
-- scripts/db/app-role.mjs, exécutable sans Node dans le conteneur postgres :
--
--   docker compose exec -T postgres psql -U edupilot -d edupilot \
--     -v app_password="$APP_DB_PASSWORD" -v owner=edupilot -f - < deploy/contabo/app-role.sql
--
-- Idempotent. À jouer AVANT le premier démarrage de l'application (droits par
-- défaut sur les tables que les migrations vont créer), puis APRÈS (tables
-- existantes, historique des migrations retiré). Rejouable après chaque mise à jour.
\set ON_ERROR_STOP on

SELECT format('CREATE ROLE edupilot_app LOGIN')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'edupilot_app') \gexec

SELECT format('ALTER ROLE edupilot_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_password') \gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO edupilot_app', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO edupilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edupilot_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO edupilot_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO edupilot_app;

-- Tables créées plus tard par les migrations (propriétaire) : mêmes droits
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO edupilot_app', :'owner') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO edupilot_app', :'owner') \gexec

-- Historique des migrations : jamais accessible à l'application
SELECT 'REVOKE ALL ON TABLE "_prisma_migrations" FROM edupilot_app'
WHERE to_regclass('public._prisma_migrations') IS NOT NULL \gexec

-- Vérification lisible
SELECT rolname AS role, rolsuper AS superutilisateur, rolbypassrls AS ignore_rls
FROM pg_roles WHERE rolname = 'edupilot_app';
