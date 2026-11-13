-- CreateTable
CREATE TABLE "students" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "class_ref" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "display_ref" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateIndex
CREATE INDEX "students_tenant_id_campus_id_status_idx" ON "students"("tenant_id", "campus_id", "status");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
