import { Module, type DynamicModule } from "@nestjs/common";
import { AuditService } from "../modules/audit/audit.service.js";
import {
  AUDIT_SERVICE,
  MEAL_PUBLICATION_AUDIT_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { AdminAuditController } from "./admin-audit.controller.js";

@Module({})
export class AdminAuditModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: AdminAuditModule,
      controllers: [AdminAuditController],
      providers: [
        {
          provide: AUDIT_SERVICE,
          useValue: options.auditService ?? new AuditService(),
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
        {
          provide: MEAL_PUBLICATION_AUDIT_SERVICE,
          useValue: options.mealPublicationAuditService ?? null,
        },
      ],
    };
  }
}
