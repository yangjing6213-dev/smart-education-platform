import { Module, type DynamicModule } from "@nestjs/common";
import {
  INVITE_AUTH_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { IdentityController } from "./identity.controller.js";
import { InviteAuthService } from "./invite-auth.service.js";

@Module({})
export class IdentityModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: IdentityModule,
      controllers: [IdentityController],
      providers: [
        {
          provide: INVITE_AUTH_SERVICE,
          useValue: options.inviteAuthService ?? new InviteAuthService([]),
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
