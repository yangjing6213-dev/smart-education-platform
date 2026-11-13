CREATE UNIQUE INDEX "binding_applications_tenant_campus_applicant_student_key"
ON "binding_applications"("tenant_id", "campus_id", "applicant_user_id", "student_candidate_ref");
