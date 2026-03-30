-- Seed base para LockerFlow / GestionLocker
-- Compatible con PostgreSQL y Supabase SQL API.

INSERT INTO "employees" ("username", "password_hash", "role", "active")
VALUES
  ('admin', '$2b$10$LbOrnYpH.f9EAQvGemw4hulX3eWoyKsK2XqtFue6Sri3TQc/H1oFu', 'ADMIN', true),
  ('operador1', '$2b$10$sZvqUsLWaW3QPIV6bexSR.4hdaAs8g5AFzO2EnVdy5paApiarh2Ku', 'EMPLOYEE', true)
ON CONFLICT ("username") DO UPDATE
SET
  "password_hash" = EXCLUDED."password_hash",
  "role" = EXCLUDED."role",
  "active" = EXCLUDED."active";

INSERT INTO "people" ("external_qr_id", "document_id", "full_name", "phone", "email", "updated_at")
VALUES
  ('QR-0001', '12345678A', 'Ana Perez', '+34111111111', 'ana@example.com', NOW()),
  ('QR-0002', '87654321B', 'Luis Gomez', '+34222222222', 'luis@example.com', NOW())
ON CONFLICT ("external_qr_id") DO UPDATE
SET
  "document_id" = EXCLUDED."document_id",
  "full_name" = EXCLUDED."full_name",
  "phone" = EXCLUDED."phone",
  "email" = EXCLUDED."email",
  "updated_at" = NOW();

INSERT INTO "lockers" ("code", "name", "location", "integration_type", "active")
VALUES
  ('LKR-A', 'Locker A', 'Recepcion Planta 1', 'MOCK', true),
  ('LKR-B', 'Locker B', 'Recepcion Planta 2', 'MOCK', true)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "location" = EXCLUDED."location",
  "integration_type" = EXCLUDED."integration_type",
  "active" = EXCLUDED."active";

INSERT INTO "compartments" ("locker_id", "slot_number", "size_category", "status", "reserved_for_package_id")
VALUES
  ((SELECT "id" FROM "lockers" WHERE "code" = 'LKR-A'), 1, 'S', 'LIBRE', NULL),
  ((SELECT "id" FROM "lockers" WHERE "code" = 'LKR-A'), 2, 'S', 'LIBRE', NULL),
  ((SELECT "id" FROM "lockers" WHERE "code" = 'LKR-A'), 3, 'M', 'LIBRE', NULL),
  ((SELECT "id" FROM "lockers" WHERE "code" = 'LKR-A'), 4, 'L', 'LIBRE', NULL),
  ((SELECT "id" FROM "lockers" WHERE "code" = 'LKR-B'), 1, 'S', 'LIBRE', NULL),
  ((SELECT "id" FROM "lockers" WHERE "code" = 'LKR-B'), 2, 'M', 'BLOQUEADO', NULL),
  ((SELECT "id" FROM "lockers" WHERE "code" = 'LKR-B'), 3, 'L', 'AVERIADO', NULL)
ON CONFLICT ("locker_id", "slot_number") DO UPDATE
SET
  "size_category" = EXCLUDED."size_category",
  "status" = EXCLUDED."status",
  "reserved_for_package_id" = NULL,
  "last_status_change_at" = NOW();
