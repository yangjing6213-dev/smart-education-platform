import { Module, type DynamicModule } from "@nestjs/common";
import { AuditService } from "../modules/audit/audit.service.js";
import { PartnerLinkService } from "../modules/partner-links/partner-link.service.js";
import {
  PARTNER_LINK_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { PartnerLinksController } from "./partner-links.controller.js";

@Module({})
export class PartnerLinksModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    const auditService = options.auditService ?? new AuditService();
    return {
      module: PartnerLinksModule,
      controllers: [PartnerLinksController],
      providers: [
        {
          provide: PARTNER_LINK_SERVICE,
          useValue:
            options.partnerLinkService ?? new PartnerLinkService(undefined, { auditService }),
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
