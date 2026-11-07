\set ON_ERROR_STOP on

-- Execute como administrador após criar os databases e roles fora deste script.
-- Os nomes são deliberadamente explícitos; senhas vêm do Secrets Manager, nunca do Git.
REVOKE ALL PRIVILEGES ON DATABASE oficina_os FROM oficina_billing_runtime;
REVOKE ALL PRIVILEGES ON DATABASE oficina_execution FROM oficina_billing_runtime;
GRANT CONNECT ON DATABASE oficina_billing TO oficina_billing_runtime;

\connect oficina_billing
GRANT USAGE ON SCHEMA public TO oficina_billing_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oficina_billing_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oficina_billing_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oficina_billing_runtime;
