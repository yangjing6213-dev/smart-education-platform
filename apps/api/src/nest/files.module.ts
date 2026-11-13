import { Module, type DynamicModule } from "@nestjs/common";
import { FileService } from "../modules/files/file.service.js";
import { FILE_SERVICE, TRUSTED_AUTH_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import { FilesController } from "./files.controller.js";

@Module({})
export class FilesModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: FilesModule,
      controllers: [FilesController],
      providers: [
        { provide: FILE_SERVICE, useValue: options.fileService ?? new FileService() },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
