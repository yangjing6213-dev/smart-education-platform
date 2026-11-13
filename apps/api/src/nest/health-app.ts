import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { HealthModule } from "./health.module.js";

export function createHealthApp(): Promise<INestApplication> {
  return NestFactory.create(HealthModule, { logger: false });
}
