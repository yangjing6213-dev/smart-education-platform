import { Module, type DynamicModule } from "@nestjs/common";
import { AuditService } from "../modules/audit/audit.service.js";
import { HealthModule } from "./health.module.js";
import type { ApiAppOptions } from "./api-tokens.js";
import { IdentityModule } from "./identity.module.js";
import { InstitutionService } from "../modules/institution/institution.service.js";
import { AdminInstitutionModule } from "./admin-institution.module.js";
import { PublicInstitutionModule } from "./public-institution.module.js";
import { AdminAuditModule } from "./admin-audit.module.js";
import { PublicActivitiesModule } from "./public-activities.module.js";
import { PublicContentModule } from "./public-content.module.js";
import { PublicMealsModule } from "./public-meals.module.js";
import { AdminMealsModule } from "./admin-meals.module.js";
import { PublicTeachersModule } from "./public-teachers.module.js";
import { StaffGuidesModule } from "./staff-guides.module.js";
import { StaffResourcesModule } from "./staff-resources.module.js";
import { FileService } from "../modules/files/file.service.js";
import { PartnerLinkService } from "../modules/partner-links/partner-link.service.js";
import { FilesModule } from "./files.module.js";
import { PartnerLinksModule } from "./partner-links.module.js";
import { GuardianBindingModule } from "./guardian-binding.module.js";
import { CareRecordModule } from "./care-record.module.js";
import { AttendanceModule } from "./attendance.module.js";
import { LeaveModule } from "./leave.module.js";
import { ParentGovernanceModule } from "./parent-governance.module.js";
import { ParentPickupModule } from "./parent-pickup.module.js";
import { StaffTaskWorkbenchModule } from "./staff-task-workbench.module.js";
import { StaffHealthIncidentReviewModule } from "./staff-health-incident-review.module.js";
import { StaffDailyModule } from "./staff-daily.module.js";
import { MonthlyFeedbackModule } from "./monthly-feedback.module.js";
import { ChildMonthlyModule } from "./child-monthly.module.js";
import { ParentHealthIncidentModule } from "./parent-health-incident.module.js";
import { StaffNoticesModule } from "./staff-notices.module.js";
import { ParentNoticesModule } from "./parent-notices.module.js";
import { ParentLearningModule } from "./parent-learning.module.js";
import { ParentLearningSessionModule } from "./parent-learning-session.module.js";
import { LearningInstitutionSettingModule } from "./learning-institution-setting.module.js";
import { FeesModule } from "./fees.module.js";
import { StudentTransfersModule } from "./student-transfers.module.js";

@Module({})
export class ApiModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (
      options.parentGovernanceOperations !== undefined &&
      options.parentHealthIncidentOperations !== undefined
    )
      throw new Error("Parent health incident routes must have one operations provider.");
    if (
      options.parentGovernanceOperations !== undefined &&
      options.parentNoticeOperations !== undefined
    )
      throw new Error("Parent notices routes must have one operations provider.");
    if (
      options.parentGovernanceOperations !== undefined &&
      options.parentLearningOperations !== undefined
    )
      throw new Error("Parent learning routes must have one operations provider.");
    const authOptions: ApiAppOptions =
      options.getTrustedAuthResult !== undefined || options.inviteAuthService === undefined
        ? options
        : {
            ...options,
            getTrustedAuthResult: (request) =>
              options.inviteAuthService?.getTrustedAuthResult(request),
          };
    const auditService = options.auditService ?? new AuditService();
    const auditOptions = { ...authOptions, auditService };
    const institutionOptions =
      authOptions.institutionService === undefined
        ? { ...authOptions, institutionService: new InstitutionService() }
        : authOptions;
    const fileOptions =
      authOptions.fileService === undefined
        ? { ...auditOptions, fileService: new FileService(undefined, { auditService }) }
        : auditOptions;
    const partnerLinkOptions = {
      ...auditOptions,
      partnerLinkService:
        authOptions.partnerLinkService ?? new PartnerLinkService(undefined, { auditService }),
    };
    return {
      module: ApiModule,
      imports: [
        HealthModule,
        IdentityModule.register(authOptions),
        ...(authOptions.learningInstitutionSettingOperations
          ? [LearningInstitutionSettingModule.register(authOptions)]
          : []),
        ...(authOptions.feesOperations ? [FeesModule.register(authOptions)] : []),
        ...(authOptions.studentTransferOperations
          ? [StudentTransfersModule.register(authOptions)]
          : []),
        AdminAuditModule.register(auditOptions),
        AdminInstitutionModule.register(institutionOptions),
        PublicInstitutionModule.register(institutionOptions),
        PublicActivitiesModule.register(authOptions),
        PublicContentModule.register(authOptions),
        PublicMealsModule.register(authOptions),
        AdminMealsModule.register(authOptions),
        PublicTeachersModule.register(authOptions),
        StaffGuidesModule.register(authOptions),
        StaffResourcesModule.register(authOptions),
        FilesModule.register(fileOptions),
        PartnerLinksModule.register(partnerLinkOptions),
        GuardianBindingModule.register(authOptions),
        CareRecordModule.register(authOptions),
        AttendanceModule.register(authOptions),
        LeaveModule.register(authOptions),
        StaffDailyModule.register(authOptions),
        MonthlyFeedbackModule.register(authOptions),
        ChildMonthlyModule.register(authOptions),
        ...(authOptions.parentGovernanceOperations
          ? [ParentGovernanceModule.register(authOptions)]
          : []),
        ...(authOptions.parentPickupOperations ? [ParentPickupModule.register(authOptions)] : []),
        ...(authOptions.parentLearningOperations
          ? [ParentLearningModule.register(authOptions)]
          : []),
        ...(authOptions.parentLearningSessionOperations
          ? [ParentLearningSessionModule.register(authOptions)]
          : []),
        ...(authOptions.parentHealthIncidentOperations
          ? [ParentHealthIncidentModule.register(authOptions)]
          : []),
        ...(authOptions.staffNoticeOperations ? [StaffNoticesModule.register(authOptions)] : []),
        ...(authOptions.parentNoticeOperations ? [ParentNoticesModule.register(authOptions)] : []),
        ...(authOptions.staffTaskWorkbenchOperations
          ? [StaffTaskWorkbenchModule.register(authOptions)]
          : []),
        ...(authOptions.staffHealthIncidentReviewOperations
          ? [StaffHealthIncidentReviewModule.register(authOptions)]
          : []),
      ],
    };
  }
}
