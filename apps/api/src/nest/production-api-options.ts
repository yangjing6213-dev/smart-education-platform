import { InviteAuthService, parseInviteAccountsJson } from "./invite-auth.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { PrismaAttendanceService } from "../modules/attendance/prisma-attendance.service.js";
import { PrismaCareRecordService } from "../modules/care-records/prisma-care-record.service.js";
import { PrismaGuardianBindingService } from "../modules/guardian-bindings/prisma-guardian-binding.service.js";
import { PrismaHealthIncidentReviewService } from "../modules/health-incidents/prisma-health-incident-review.service.js";
import { PrismaLeaveService } from "../modules/leave/prisma-leave.service.js";
import { PrismaStaffDailyService } from "../modules/staff-daily/prisma-staff-daily.service.js";
import { PrismaMonthlyFeedbackService } from "../modules/monthly-feedback/prisma-monthly-feedback.service.js";
import { PrismaChildMonthlyService } from "../modules/monthly-feedback/prisma-child-monthly.service.js";
import { PrismaStaffTaskWorkbenchService } from "../modules/tasks/prisma-staff-task-workbench.service.js";
import { PrismaNoticeService } from "../modules/notices/prisma-notice.service.js";
import { PrismaParentLearningSummaryService } from "../modules/learning/prisma-parent-learning-summary.service.js";
import { PrismaLearningInstitutionSettingService } from "../modules/learning/prisma-learning-institution-setting.service.js";
import { PrismaParentLearningSessionService } from "../modules/learning/prisma-parent-learning-session.service.js";
import { PrismaMealService } from "../modules/meals/prisma-meal.service.js";
import { PrismaMealPublicationAuditService } from "../modules/audit/prisma-meal-publication-audit.service.js";
import { PrismaInstitutionService } from "../modules/institution/prisma-institution.service.js";
import type { ApiAppOptions } from "./api-tokens.js";
import { PrismaInviteSessionStore } from "./prisma-invite-session.store.js";
import { PrismaInviteAccountStore } from "./prisma-invite-account.store.js";
import { resolvePublicCampusScope } from "./public-campus-scope.js";
import { PrismaFeesService } from "../modules/fees/prisma-fees.service.js";
import { PrismaStudentTransferService } from "../modules/student-transfers/prisma-student-transfer.service.js";
import { PrismaParentPickupService } from "../modules/pickup/prisma-parent-pickup.service.js";

export function createProductionApiOptions(
  prisma: PrismaClient,
  inviteAccounts: ReturnType<typeof parseInviteAccountsJson>,
): ApiAppOptions {
  const healthIncidentReviewService = new PrismaHealthIncidentReviewService(prisma);
  const noticeService = new PrismaNoticeService(prisma);
  return {
    inviteAuthService: new InviteAuthService(
      inviteAccounts,
      undefined,
      new PrismaInviteSessionStore(prisma),
      new PrismaInviteAccountStore(prisma),
    ),
    guardianBindingOperations: new PrismaGuardianBindingService(
      prisma,
      new Map(
        inviteAccounts.map((account) => [
          account.identity.actor_id,
          account.binding_student_ids ?? [],
        ]),
      ),
      new Map(
        inviteAccounts.map((account) => [account.identity.actor_id, account.identity.display_name]),
      ),
    ),
    careRecordOperations: new PrismaCareRecordService(prisma),
    attendanceOperations: new PrismaAttendanceService(prisma),
    leaveOperations: new PrismaLeaveService(prisma),
    monthlyFeedbackOperations: new PrismaMonthlyFeedbackService(prisma),
    childMonthlyOperations: new PrismaChildMonthlyService(prisma),
    staffTaskWorkbenchOperations: new PrismaStaffTaskWorkbenchService(
      prisma,
      inviteAccounts.map(({ identity, memberships }) => ({ identity, memberships })),
    ),
    staffDailyOperations: new PrismaStaffDailyService(
      prisma,
      new Map(
        inviteAccounts.map((account) => [account.identity.actor_id, account.identity.display_name]),
      ),
    ),
    staffHealthIncidentReviewOperations: healthIncidentReviewService,
    parentHealthIncidentOperations: healthIncidentReviewService,
    staffNoticeOperations: noticeService,
    parentNoticeOperations: noticeService,
    parentLearningOperations: new PrismaParentLearningSummaryService(prisma),
    parentLearningSessionOperations: new PrismaParentLearningSessionService(prisma),
    learningInstitutionSettingOperations: new PrismaLearningInstitutionSettingService(prisma),
    feesOperations: new PrismaFeesService(prisma),
    studentTransferOperations: new PrismaStudentTransferService(prisma),
    parentPickupOperations: new PrismaParentPickupService(prisma),
    mealService: new PrismaMealService(prisma),
    getPublicMealScope: (request) => resolvePublicCampusScope(prisma, request),
    getPublicInstitutionScope: (request) => resolvePublicCampusScope(prisma, request),
    mealPublicationAuditService: new PrismaMealPublicationAuditService(prisma),
    institutionService: new PrismaInstitutionService(prisma),
  };
}
