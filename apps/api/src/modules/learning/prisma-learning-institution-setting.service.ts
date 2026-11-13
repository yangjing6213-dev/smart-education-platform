import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  LearningInstitutionSettingContext,
  LearningInstitutionSettingOperations,
  LearningInstitutionSettingView,
} from "../../nest/api-tokens.js";

class SettingFailure extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
const conflict = () => new SettingFailure(409, "CONFLICT_STATE");
const forbidden = () => new SettingFailure(403, "FORBIDDEN_SCOPE");

export class PrismaLearningInstitutionSettingService implements LearningInstitutionSettingOperations {
  public constructor(private readonly prisma: PrismaClient) {}

  private async member(
    database: Prisma.TransactionClient,
    context: LearningInstitutionSettingContext,
  ) {
    if (!context.capabilities.includes("learning:institution-setting")) throw forbidden();
    const members = await database.membershipCampus.findMany({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        campus: { status: "ACTIVE" },
        membership: {
          userId: context.actorId,
          status: "ACTIVE",
          user: { status: "ACTIVE" },
          tenant: { status: "ACTIVE" },
        },
      },
      select: { membershipId: true },
    });
    if (members.length !== 1) throw forbidden();
    return members[0]!.membershipId;
  }

  public async read(
    context: LearningInstitutionSettingContext,
  ): Promise<LearningInstitutionSettingView> {
    return this.prisma.$transaction(async (database) => {
      await this.member(database, context);
      return (
        (await database.aIInstitutionSetting.findUnique({
          where: { tenantId_campusId: { tenantId: context.tenantId, campusId: context.campusId } },
          select: { enabled: true, version: true },
        })) ?? { enabled: false, version: 0 }
      );
    });
  }

  public async update(
    context: LearningInstitutionSettingContext,
    body: unknown,
  ): Promise<LearningInstitutionSettingView> {
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 2 ||
      !("enabled" in body) ||
      !("expectedVersion" in body) ||
      typeof body.enabled !== "boolean" ||
      !Number.isInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 0 ||
      Number(body.expectedVersion) >= 2147483647
    ) {
      throw new SettingFailure(400, "VALIDATION_FAILED");
    }
    const enabled = body.enabled;
    const version = Number(body.expectedVersion);
    try {
      return await this.prisma.$transaction(
        async (database) => {
          const updatedByMembershipId = await this.member(database, context);
          const scope = { tenantId: context.tenantId, campusId: context.campusId };
          if (version === 0) {
            return database.aIInstitutionSetting.create({
              data: { ...scope, enabled, version: 1, updatedByMembershipId },
              select: { enabled: true, version: true },
            });
          }
          const updated = await database.aIInstitutionSetting.updateMany({
            where: { ...scope, version },
            data: { enabled, version: { increment: 1 }, updatedByMembershipId },
          });
          if (updated.count !== 1) throw conflict();
          return { enabled, version: version + 1 };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        throw conflict();
      throw error;
    }
  }
}
