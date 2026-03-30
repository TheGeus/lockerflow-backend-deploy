-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('EMPLOYEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('NONE', 'MOCK', 'API', 'SENSOR');

-- CreateEnum
CREATE TYPE "SizeCategory" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "CompartmentStatus" AS ENUM ('LIBRE', 'RESERVADO', 'OCUPADO', 'BLOQUEADO', 'AVERIADO');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('PENDING_ASSIGNMENT', 'ASSIGNED', 'STORED', 'OVERFLOW', 'RETRIEVAL_IN_PROGRESS', 'RETRIEVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OverflowStatus" AS ENUM ('WAITING', 'REASSIGNED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickupAttemptStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'OPENED', 'FAILED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('OPEN_FAILURE', 'STATE_MISMATCH', 'HARDWARE_ERROR', 'MANUAL_OVERRIDE', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "employees" (
    "id" BIGSERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL DEFAULT 'EMPLOYEE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" BIGSERIAL NOT NULL,
    "external_qr_id" VARCHAR(150) NOT NULL,
    "document_id" VARCHAR(100),
    "full_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lockers" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "location" VARCHAR(200),
    "integration_type" "IntegrationType" NOT NULL DEFAULT 'MOCK',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compartments" (
    "id" BIGSERIAL NOT NULL,
    "locker_id" BIGINT NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "size_category" "SizeCategory" NOT NULL,
    "status" "CompartmentStatus" NOT NULL DEFAULT 'LIBRE',
    "reserved_for_package_id" BIGINT,
    "last_status_change_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compartments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" BIGSERIAL NOT NULL,
    "tracking_number" VARCHAR(120) NOT NULL,
    "person_id" BIGINT NOT NULL,
    "size_category" "SizeCategory" NOT NULL,
    "weight_grams" INTEGER,
    "status" "PackageStatus" NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    "assigned_compartment_id" BIGINT,
    "overflow_reason" VARCHAR(200),
    "created_by_employee_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_codes" (
    "id" BIGSERIAL NOT NULL,
    "package_id" BIGINT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_attempts" (
    "id" BIGSERIAL NOT NULL,
    "package_id" BIGINT NOT NULL,
    "compartment_id" BIGINT NOT NULL,
    "requested_by_employee_id" BIGINT,
    "provided_code" VARCHAR(32) NOT NULL,
    "gateway_mode" "IntegrationType" NOT NULL,
    "status" "PickupAttemptStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overflow_items" (
    "id" BIGSERIAL NOT NULL,
    "package_id" BIGINT NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "status" "OverflowStatus" NOT NULL DEFAULT 'WAITING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "overflow_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" BIGSERIAL NOT NULL,
    "locker_id" BIGINT,
    "compartment_id" BIGINT,
    "package_id" BIGINT,
    "type" "IncidentType" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "performed_by_employee_id" BIGINT,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_username_key" ON "employees"("username");

-- CreateIndex
CREATE UNIQUE INDEX "people_external_qr_id_key" ON "people"("external_qr_id");

-- CreateIndex
CREATE UNIQUE INDEX "lockers_code_key" ON "lockers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "compartments_reserved_for_package_id_key" ON "compartments"("reserved_for_package_id");

-- CreateIndex
CREATE UNIQUE INDEX "compartments_locker_id_slot_number_key" ON "compartments"("locker_id", "slot_number");

-- CreateIndex
CREATE UNIQUE INDEX "packages_tracking_number_key" ON "packages"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_codes_package_id_key" ON "pickup_codes"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_codes_code_key" ON "pickup_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "overflow_items_package_id_key" ON "overflow_items"("package_id");

-- AddForeignKey
ALTER TABLE "compartments" ADD CONSTRAINT "compartments_locker_id_fkey" FOREIGN KEY ("locker_id") REFERENCES "lockers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compartments" ADD CONSTRAINT "compartments_reserved_for_package_id_fkey" FOREIGN KEY ("reserved_for_package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_created_by_employee_id_fkey" FOREIGN KEY ("created_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_assigned_compartment_id_fkey" FOREIGN KEY ("assigned_compartment_id") REFERENCES "compartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_codes" ADD CONSTRAINT "pickup_codes_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_attempts" ADD CONSTRAINT "pickup_attempts_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_attempts" ADD CONSTRAINT "pickup_attempts_compartment_id_fkey" FOREIGN KEY ("compartment_id") REFERENCES "compartments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_attempts" ADD CONSTRAINT "pickup_attempts_requested_by_employee_id_fkey" FOREIGN KEY ("requested_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overflow_items" ADD CONSTRAINT "overflow_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_locker_id_fkey" FOREIGN KEY ("locker_id") REFERENCES "lockers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_compartment_id_fkey" FOREIGN KEY ("compartment_id") REFERENCES "compartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_performed_by_employee_id_fkey" FOREIGN KEY ("performed_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
