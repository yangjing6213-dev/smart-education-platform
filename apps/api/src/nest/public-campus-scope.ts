import type { PrismaClient } from "../generated/prisma/client.js";
import type { MealScope } from "../modules/meals/meal.service.js";
import type { ApiHttpRequest } from "./api-tokens.js";

const PUBLIC_REFERENCE_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/;
const ALLOWED_PUBLIC_QUERY_FIELDS = new Set(["date", "public_ref"]);

export function publicCampusReference(request: ApiHttpRequest): string | undefined {
  if (Object.keys(request.query).some((key) => !ALLOWED_PUBLIC_QUERY_FIELDS.has(key))) {
    return undefined;
  }
  const reference = request.query.public_ref;
  return typeof reference === "string" && PUBLIC_REFERENCE_PATTERN.test(reference)
    ? reference
    : undefined;
}

export async function resolvePublicCampusScope(
  prisma: PrismaClient,
  request: ApiHttpRequest,
): Promise<MealScope | undefined> {
  const reference = publicCampusReference(request);
  if (reference === undefined) return undefined;

  const campuses = await prisma.campus.findMany({
    where: { publicProfileRef: reference },
    select: { tenantId: true, id: true, status: true, tenant: { select: { status: true } } },
    take: 2,
  });
  if (campuses.length !== 1) return undefined;
  const campus = campuses[0]!;
  if (campus.status !== "ACTIVE" || campus.tenant.status !== "ACTIVE") return undefined;
  return { tenantId: campus.tenantId, campusId: campus.id };
}
