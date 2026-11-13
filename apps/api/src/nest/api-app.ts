import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ApiModule } from "./api.module.js";
import type { ApiAppOptions } from "./api-tokens.js";

export function createApiApp(options: ApiAppOptions = {}): Promise<INestApplication> {
  return NestFactory.create(ApiModule.register(options), { logger: false });
}
