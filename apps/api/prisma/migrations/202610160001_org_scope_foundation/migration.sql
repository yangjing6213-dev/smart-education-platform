-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'INVITED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campuses" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "public_profile_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "membership_campuses" (
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_campuses_pkey" PRIMARY KEY ("tenant_id","membership_id","campus_id")
);

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "campuses_tenant_id_status_idx" ON "campuses"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_status_idx" ON "memberships"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_user_id_idx" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "membership_campuses_tenant_id_campus_id_idx" ON "membership_campuses"("tenant_id", "campus_id");

-- AddForeignKey
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_campuses" ADD CONSTRAINT "membership_campuses_tenant_id_membership_id_fkey" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_campuses" ADD CONSTRAINT "membership_campuses_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

