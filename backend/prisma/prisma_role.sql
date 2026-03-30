-- Usuario recomendado para Prisma sobre Supabase.
-- Se ejecuta fuera del flujo de migraciones porque crea/actualiza un rol del servidor.
-- La contraseña real se inyecta desde `SUPABASE_PRISMA_DB_PASSWORD`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prisma') THEN
    CREATE ROLE "prisma" WITH LOGIN PASSWORD '__PRISMA_DB_PASSWORD__' BYPASSRLS CREATEDB;
  ELSE
    ALTER ROLE "prisma" WITH LOGIN PASSWORD '__PRISMA_DB_PASSWORD__' BYPASSRLS CREATEDB;
  END IF;
END
$$;

GRANT "prisma" TO "postgres";
GRANT USAGE ON SCHEMA public TO "prisma";
GRANT CREATE ON SCHEMA public TO "prisma";
GRANT ALL ON ALL TABLES IN SCHEMA public TO "prisma";
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO "prisma";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "prisma";

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO "prisma";

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON ROUTINES TO "prisma";

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO "prisma";
