import { Module, type DynamicModule } from "@nestjs/common";
import { ContentService } from "../modules/content/content.service.js";
import { CONTENT_SERVICE, TRUSTED_AUTH_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import { PublicContentController } from "./public-content.controller.js";

@Module({})
export class PublicContentModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: PublicContentModule,
      controllers: [PublicContentController],
      providers: [
        { provide: CONTENT_SERVICE, useValue: options.contentService ?? new ContentService() },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
