import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  ATTENDANCE_CORRECTION_REASONS,
  ATTENDANCE_CORRECTION_STATUSES,
  ATTENDANCE_REVISION_ACTIONS,
  ATTENDANCE_STATUSES,
  BLOCK_KINDS,
  CARE_RECORD_STATUSES,
  CARE_ARRIVALS,
  CARE_HOMEWORK,
  CARE_MEALS,
  CARE_RESTS,
  CARE_ACTIVITIES,
  CARE_WELLBEING,
  CARE_RECORD_RECEIPT_STATUSES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  CONTENT_VISIBILITIES,
  ERROR_CODES,
  GUARDIAN_BINDING_APPLICATION_STATUSES,
  GUARDIAN_RELATIONSHIPS,
  GUARDIAN_RELATIONSHIP_STATUSES,
  IDENTITY_CAPABILITIES,
  MEMBERSHIP_STATUSES,
  PARTNER_LINK_ENABLED_STATUSES,
  PARTNER_LINK_PUBLICATION_STATUSES,
  type PartnerLinkEntryProjectionDto,
  type PartnerLinkProjectionDto,
  type GuardianBindingApplicationInput,
  type GuardianBindingApplicationReviewInput,
  type GuardianBindingApplicationProjection,
  type GuardianRelationshipProjection,
  type GuardianRelationshipReleaseInput,
  type InviteLoginRequest,
  type InviteLoginResponse,
  type InviteLogoutResponse,
  type ContentItem,
  type ErrorEnvelope,
  type SuccessEnvelope,
} from "../src/index.js";

const sourceOpenApiDocumentUrl = new URL("../../openapi/v1.json", import.meta.url);
const colocatedOpenApiDocumentUrl = new URL("../openapi/v1.json", import.meta.url);
const openApiDocumentUrl = existsSync(sourceOpenApiDocumentUrl)
  ? sourceOpenApiDocumentUrl
  : colocatedOpenApiDocumentUrl;

test("OpenAPI exposes scoped student transfer creation and independent review", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  for (const [path, method, operationId] of [
    ["/admin/student-transfers", "get", "listAdminStudentTransfers"],
    ["/admin/student-transfers", "post", "createAdminStudentTransfer"],
    ["/admin/student-transfers/{id}/review", "post", "reviewAdminStudentTransfer"],
  ]) {
    const operation = document.paths[path!]?.[method!];
    assert.ok(operation, `${method} ${path} must exist`);
    assert.equal(operation.operationId, operationId);
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    for (const code of ["400", "401", "403"]) assert.ok(operation.responses[code]);
  }
  assert.equal(
    document.paths["/admin/student-transfers"].post["x-required-capability"],
    "students:transfer:request",
  );
  assert.equal(
    document.paths["/admin/student-transfers/{id}/review"].post["x-required-capability"],
    "students:transfer:review",
  );
  const create = document.components.schemas.StudentTransferCreateInput;
  assert.equal(create.additionalProperties, false);
  assert.deepEqual(create.required, ["student_id", "destination_class_ref"]);
  const review = document.components.schemas.StudentTransferReviewInput;
  assert.equal(review.additionalProperties, false);
  assert.deepEqual(review.properties.decision.enum, ["APPROVE", "REJECT"]);
  assert.equal(review.properties.expected_version.minimum, 1);
});

test("OpenAPI exposes nine child monthly report operations with scoped envelopes", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const expected = [
    [
      "/staff/child-monthly-reports",
      "get",
      "listStaffChildMonthlyReports",
      "feedback:read",
      undefined,
      "ChildMonthlyStaffListEnvelope",
    ],
    [
      "/staff/child-monthly-reports",
      "post",
      "createStaffChildMonthlyReport",
      "feedback:create",
      "ChildMonthlyCreateInput",
      "ChildMonthlyStaffReportEnvelope",
    ],
    [
      "/staff/child-monthly-reports/{id}",
      "patch",
      "editStaffChildMonthlyReport",
      "feedback:create",
      "ChildMonthlyEditInput",
      "ChildMonthlyStaffReportEnvelope",
    ],
    [
      "/staff/child-monthly-reports/{id}/submit",
      "post",
      "submitStaffChildMonthlyReport",
      "feedback:submit",
      "ChildMonthlyVersionInput",
      "ChildMonthlyStaffReportEnvelope",
    ],
    [
      "/admin/child-monthly-reports",
      "get",
      "listAdminChildMonthlyReports",
      "feedback:review",
      undefined,
      "ChildMonthlyStaffListEnvelope",
    ],
    [
      "/admin/child-monthly-reports/{id}/review",
      "post",
      "reviewAdminChildMonthlyReport",
      "feedback:review",
      "ChildMonthlyReviewInput",
      "ChildMonthlyStaffReportEnvelope",
    ],
    [
      "/admin/child-monthly-reports/{id}/publish",
      "post",
      "publishAdminChildMonthlyReport",
      "feedback:publish",
      "ChildMonthlyVersionInput",
      "ChildMonthlyStaffReportEnvelope",
    ],
    [
      "/parent/relationships/{relationshipId}/monthly-reports",
      "get",
      "listParentChildMonthlyReports",
      "binding:read",
      undefined,
      "ChildMonthlyParentListEnvelope",
    ],
    [
      "/parent/relationships/{relationshipId}/monthly-reports/{id}/ack",
      "post",
      "acknowledgeParentChildMonthlyReport",
      "binding:read",
      "ChildMonthlyAcknowledgeInput",
      "ChildMonthlyAcknowledgementEnvelope",
    ],
  ] as const;
  const actual = Object.entries(document.paths)
    .filter(([path]) =>
      /^\/(?:staff|admin)\/child-monthly-reports(?:\/|$)|^\/parent\/relationships\/\{relationshipId\}\/monthly-reports(?:\/|$)/u.test(
        path,
      ),
    )
    .flatMap(([path, item]) => Object.keys(item as object).map((method) => `${method} ${path}`))
    .sort();
  assert.deepEqual(actual, expected.map(([path, method]) => `${method} ${path}`).sort());
  for (const [path, method, operationId, capability, input, envelope] of expected) {
    const operation = document.paths[path][method];
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], capability);
    assert.match(operation.description, /query parameters.*rejected/iu);
    const parameters = [];
    if (path.includes("{relationshipId}"))
      parameters.push({ $ref: "#/components/parameters/ChildMonthlyRelationshipId" });
    if (path.includes("{id}"))
      parameters.push({ $ref: "#/components/parameters/ChildMonthlyReportId" });
    assert.deepEqual(operation.parameters ?? [], parameters);
    if (path === "/admin/child-monthly-reports")
      assert.deepEqual(operation["x-required-capabilities"], ["feedback:read", "feedback:review"]);
    const success = method === "post" && path === "/staff/child-monthly-reports" ? "201" : "200";
    for (const status of [success, "400", "401", "403", "409"])
      assert.ok(operation.responses[status], `${method} ${path} needs ${status}`);
    if (method !== "get" || path.startsWith("/parent/")) assert.ok(operation.responses["404"]);
    assert.deepEqual(operation.responses[success].content["application/json"].schema, {
      $ref: `#/components/schemas/${envelope}`,
    });
    for (const [status, response] of Object.entries(operation.responses)) {
      if (status === success) continue;
      const error = response as { $ref?: string; content?: Record<string, { schema: unknown }> };
      const resolved = error.$ref
        ? document.components.responses[error.$ref.split("/").at(-1)!]
        : error;
      assert.deepEqual(resolved.content["application/json"].schema, {
        $ref: "#/components/schemas/ErrorEnvelope",
      });
    }
    if (input) {
      assert.equal(operation.requestBody.required, true);
      assert.deepEqual(operation.requestBody.content["application/json"].schema, {
        $ref: `#/components/schemas/${input}`,
      });
    } else assert.equal(operation.requestBody, undefined);
  }
  for (const [key, name] of [
    ["ChildMonthlyReportId", "id"],
    ["ChildMonthlyRelationshipId", "relationshipId"],
  ]) {
    const parameter = document.components.parameters[key!];
    assert.equal(parameter.in, "path");
    assert.equal(parameter.name, name);
    assert.equal(parameter.required, true);
    assert.equal(parameter.schema.format, "uuid");
  }
});

test("OpenAPI child monthly inputs require strict fields and both acknowledgement versions", () => {
  const { schemas } = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")).components;
  const fields = {
    ChildMonthlyCreateInput: ["studentId", "month", "supplements"],
    ChildMonthlyEditInput: ["version", "supplements"],
    ChildMonthlyVersionInput: ["version"],
    ChildMonthlyReviewInput: ["version", "action"],
    ChildMonthlyAcknowledgeInput: ["publicationVersion", "relationshipVersion"],
  };
  for (const [name, keys] of Object.entries(fields)) {
    const schema = schemas[name];
    assert.ok(schema, `${name} must exist`);
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), [...keys].sort());
    assert.deepEqual(Object.keys(schema.properties).sort(), [...keys].sort());
    for (const key of keys.filter((key) => /version/iu.test(key))) {
      assert.equal(schema.properties[key].type, "integer");
      assert.equal(schema.properties[key].minimum, 1);
      assert.equal(schema.properties[key].maximum, Number.MAX_SAFE_INTEGER);
    }
  }
  const create = schemas.ChildMonthlyCreateInput.properties;
  assert.equal(create.studentId.format, "uuid");
  const uuidPattern = new RegExp(create.studentId.pattern, "u");
  assert.ok(uuidPattern.test("00000000-0000-4000-8000-000000000001"));
  assert.equal(uuidPattern.test("not-a-student-id"), false);
  const monthPattern = new RegExp(create.month.pattern, "u");
  for (const value of ["1900-01", "2026-10", "2199-12"]) assert.ok(monthPattern.test(value));
  for (const value of ["1899-12", "2200-01", "2026-00", "2026-13", "2026-1", "2026-01x"])
    assert.equal(monthPattern.test(value), false);
  for (const name of ["ChildMonthlyCreateInput", "ChildMonthlyEditInput"])
    assert.equal(
      schemas[name].properties.supplements.$ref,
      "#/components/schemas/MonthlyFeedbackSupplements",
    );
  assert.deepEqual(schemas.ChildMonthlyReviewInput.properties.action.enum, ["CONFIRM", "RETURN"]);
});

test("OpenAPI child monthly responses restrict parent summaries to child publications", () => {
  const { schemas } = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")).components;
  const expected = {
    ChildMonthlyStaffReport: [
      "id",
      "studentId",
      "studentLabel",
      "classRef",
      "month",
      "status",
      "version",
      "sourceVersion",
      "publicationVersion",
      "supplements",
      "sourceCounts",
      "actions",
    ],
    ChildMonthlyParentSummary: [
      "id",
      "studentId",
      "studentLabel",
      "month",
      "publicationVersion",
      "relationshipVersion",
      "supplements",
      "sourceCounts",
      "acknowledged",
    ],
    ChildMonthlySourceCounts: ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW"],
    ChildMonthlyStudentOption: ["id", "displayRef", "classRef"],
    ChildMonthlyStaffList: ["records", "students"],
    ChildMonthlyParentList: ["records"],
    ChildMonthlyAcknowledgement: ["acknowledged"],
  };
  for (const [name, fields] of Object.entries(expected)) {
    const schema = schemas[name];
    assert.ok(schema, `${name} must exist`);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), [...fields].sort());
    assert.deepEqual(Object.keys(schema.properties).sort(), [...fields].sort());
  }
  for (const name of ["ChildMonthlyStaffReport", "ChildMonthlyParentSummary"]) {
    assert.equal(
      schemas[name].properties.supplements.$ref,
      "#/components/schemas/MonthlyFeedbackSupplements",
    );
    assert.equal(
      schemas[name].properties.sourceCounts.$ref,
      "#/components/schemas/ChildMonthlySourceCounts",
    );
  }
  for (const value of Object.values(schemas.ChildMonthlySourceCounts.properties) as {
    type: string;
    minimum: number;
  }[]) {
    assert.equal(value.type, "integer");
    assert.equal(value.minimum, 0);
  }
  assert.equal(schemas.ChildMonthlyStaffReport.properties.publicationVersion.minimum, 0);
  for (const name of ["publicationVersion", "relationshipVersion"])
    assert.equal(schemas.ChildMonthlyParentSummary.properties[name].minimum, 1);
  assert.deepEqual(schemas.ChildMonthlyStaffReport.properties.actions.items.enum, [
    "edit",
    "submit",
    "confirm",
    "return",
    "publish",
  ]);
  assert.equal(
    schemas.ChildMonthlyStaffList.properties.records.items.$ref,
    "#/components/schemas/ChildMonthlyStaffReport",
  );
  assert.equal(
    schemas.ChildMonthlyStaffList.properties.students.items.$ref,
    "#/components/schemas/ChildMonthlyStudentOption",
  );
  assert.equal(
    schemas.ChildMonthlyParentList.properties.records.items.$ref,
    "#/components/schemas/ChildMonthlyParentSummary",
  );
  assert.equal(schemas.ChildMonthlyAcknowledgement.properties.acknowledged.const, true);
  for (const name of ["StaffReport", "StaffList", "ParentList", "Acknowledgement"]) {
    const envelope = schemas[`ChildMonthly${name}Envelope`];
    assert.equal(envelope.additionalProperties, false);
    assert.deepEqual(envelope.required, ["data", "request_id"]);
    assert.deepEqual(Object.keys(envelope.properties), ["data", "request_id"]);
    assert.equal(envelope.properties.data.$ref, `#/components/schemas/ChildMonthly${name}`);
  }
});

type OpenApiSchema = {
  readonly additionalProperties?: boolean;
  readonly $ref?: string;
  readonly const?: unknown;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly items?: OpenApiSchema;
  readonly maximum?: number;
  readonly maxItems?: number;
  readonly minimum?: number;
  readonly properties?: Readonly<Record<string, OpenApiSchema>>;
  readonly required?: readonly string[];
  readonly type?: string | readonly string[];
  readonly uniqueItems?: boolean;
};

type OpenApiOperation = {
  readonly operationId?: string;
  readonly "x-auth-required"?: boolean;
  readonly "x-scope-required"?: boolean;
  readonly "x-required-capability"?: string;
  readonly requestBody?: {
    readonly content?: Readonly<Record<string, { readonly schema?: OpenApiSchema }>>;
  };
  readonly responses?: Readonly<
    Record<
      string,
      {
        readonly $ref?: string;
        readonly description?: string;
        readonly content?: Readonly<Record<string, { readonly schema?: OpenApiSchema }>>;
      }
    >
  >;
};

test("OpenAPI exposes exactly the seven trusted staff monthly feedback operations", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const expected = [
    ["/staff/monthly-feedback", "get", "listStaffMonthlyFeedback", "feedback:read", undefined],
    [
      "/staff/monthly-feedback",
      "post",
      "createStaffMonthlyFeedback",
      "feedback:create",
      "MonthlyFeedbackCreateInput",
    ],
    [
      "/staff/monthly-feedback/{id}",
      "patch",
      "editStaffMonthlyFeedback",
      "feedback:create",
      "MonthlyFeedbackEditInput",
    ],
    [
      "/staff/monthly-feedback/{id}/submit",
      "post",
      "submitStaffMonthlyFeedback",
      "feedback:submit",
      "MonthlyFeedbackVersionInput",
    ],
    ["/admin/monthly-feedback", "get", "listAdminMonthlyFeedback", "feedback:review", undefined],
    [
      "/admin/monthly-feedback/{id}/review",
      "post",
      "reviewAdminMonthlyFeedback",
      "feedback:review",
      "MonthlyFeedbackReviewInput",
    ],
    [
      "/admin/monthly-feedback/{id}/publish",
      "post",
      "publishAdminMonthlyFeedback",
      "feedback:publish",
      "MonthlyFeedbackVersionInput",
    ],
  ] as const;
  const actual = Object.entries(document.paths)
    .filter(([path]) => /^\/(?:staff|admin)\/monthly-feedback(?:\/|$)/u.test(path))
    .flatMap(([path, item]) => Object.keys(item as object).map((method) => `${method} ${path}`))
    .sort();
  assert.deepEqual(actual, expected.map(([path, method]) => `${method} ${path}`).sort());
  for (const [path, method, operationId, capability, input] of expected) {
    const operation = document.paths[path][method];
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], capability);
    assert.match(operation.description, /same active membership and campus scope/iu);
    assert.match(operation.description, /query parameters.*rejected/iu);
    assert.deepEqual(
      operation.parameters ?? [],
      path.includes("{id}") ? [{ $ref: "#/components/parameters/MonthlyFeedbackId" }] : [],
    );
    if (path === "/admin/monthly-feedback") {
      assert.deepEqual(operation["x-required-capabilities"], ["feedback:read", "feedback:review"]);
      assert.match(operation.description, /all required capabilities/iu);
    }
    const success = method === "post" && path === "/staff/monthly-feedback" ? "201" : "200";
    for (const status of [success, "400", "401", "403", "409"])
      assert.ok(operation.responses[status], `${method} ${path} needs ${status}`);
    if (path.includes("{id}")) assert.ok(operation.responses["404"]);
    assert.deepEqual(operation.responses[success].content["application/json"].schema, {
      $ref: `#/components/schemas/MonthlyFeedback${method === "get" ? "List" : "Record"}Envelope`,
    });
    if (input) {
      assert.equal(operation.requestBody.required, true);
      assert.deepEqual(operation.requestBody.content["application/json"].schema, {
        $ref: `#/components/schemas/${input}`,
      });
    } else assert.equal(operation.requestBody, undefined);
  }
  assert.equal(document.components.parameters.MonthlyFeedbackId.in, "path");
  assert.equal(document.components.parameters.MonthlyFeedbackId.name, "id");
  assert.equal(document.components.parameters.MonthlyFeedbackId.required, true);
  assert.equal(document.components.parameters.MonthlyFeedbackId.schema.format, "uuid");
});

test("OpenAPI monthly feedback inputs reject unknown fields and non-string supplement values", () => {
  const { schemas } = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")).components;
  const expectedFields = {
    MonthlyFeedbackCreateInput: ["month", "supplements"],
    MonthlyFeedbackEditInput: ["version", "supplements"],
    MonthlyFeedbackVersionInput: ["version"],
    MonthlyFeedbackReviewInput: ["version", "action"],
    MonthlyFeedbackSupplements: [
      "learningParticipation",
      "dailyHabits",
      "activityParticipation",
      "familySchoolCollaboration",
    ],
  };
  for (const [name, fields] of Object.entries(expectedFields)) {
    const schema = schemas[name];
    assert.ok(schema, `${name} must exist`);
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), [...fields].sort());
    assert.deepEqual(Object.keys(schema.properties).sort(), [...fields].sort());
  }
  const month = schemas.MonthlyFeedbackCreateInput.properties.month;
  assert.equal(month.type, "string");
  const monthPattern = new RegExp(month.pattern, "u");
  for (const value of ["1900-01", "2026-10", "2199-12"]) assert.ok(monthPattern.test(value));
  for (const value of ["1899-12", "2200-01", "2026-00", "2026-13", "2026-1", "2026-01x"])
    assert.equal(monthPattern.test(value), false);
  for (const name of [
    "MonthlyFeedbackEditInput",
    "MonthlyFeedbackVersionInput",
    "MonthlyFeedbackReviewInput",
  ]) {
    assert.equal(schemas[name].properties.version.type, "integer");
    assert.equal(schemas[name].properties.version.minimum, 1);
    assert.equal(schemas[name].properties.version.maximum, Number.MAX_SAFE_INTEGER);
  }
  for (const field of expectedFields.MonthlyFeedbackSupplements) {
    assert.equal(schemas.MonthlyFeedbackSupplements.properties[field].type, "string");
    assert.deepEqual(schemas.MonthlyFeedbackSupplements.properties[field].enum, [
      "KEEP_WATCHING",
      "PROGRESSING",
      "FOLLOW_UP",
    ]);
  }
  for (const name of ["MonthlyFeedbackCreateInput", "MonthlyFeedbackEditInput"])
    assert.equal(
      schemas[name].properties.supplements.$ref,
      "#/components/schemas/MonthlyFeedbackSupplements",
    );
  assert.equal(schemas.MonthlyFeedbackReviewInput.properties.action.type, "string");
  assert.deepEqual(schemas.MonthlyFeedbackReviewInput.properties.action.enum, [
    "CONFIRM",
    "RETURN",
  ]);
});

test("OpenAPI monthly feedback projects only the internal class summary and available actions", () => {
  const { schemas } = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")).components;
  const record = schemas.MonthlyFeedbackRecord;
  assert.ok(record, "The internal monthly report projection must exist");
  const fields = [
    "id",
    "version",
    "sourceVersion",
    "status",
    "month",
    "classRef",
    "audience",
    "supplements",
    "sourceCounts",
    "actions",
  ];
  assert.equal(record.additionalProperties, false);
  assert.deepEqual([...record.required].sort(), [...fields].sort());
  assert.deepEqual(Object.keys(record.properties).sort(), [...fields].sort());
  assert.equal(record.properties.audience.const, "STAFF_INTERNAL");
  assert.deepEqual(record.properties.status.enum, [
    "DRAFT",
    "SUBMITTED",
    "RETURNED",
    "CONFIRMED",
    "PUBLISHED",
    "REVIEW_REQUIRED",
  ]);
  assert.equal(
    record.properties.supplements.$ref,
    "#/components/schemas/MonthlyFeedbackSupplements",
  );
  assert.deepEqual(record.properties.actions.items.enum, [
    "edit",
    "submit",
    "confirm",
    "return",
    "publish",
  ]);
  const counts = record.properties.sourceCounts;
  assert.equal(counts.additionalProperties, false);
  const kinds = ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW", "STAFF_DAILY"];
  assert.deepEqual([...counts.required].sort(), [...kinds].sort());
  assert.deepEqual(Object.keys(counts.properties).sort(), [...kinds].sort());
  for (const kind of kinds) {
    assert.equal(counts.properties[kind].type, "integer");
    assert.equal(counts.properties[kind].minimum, 0);
  }
  assert.doesNotMatch(
    JSON.stringify(record),
    /tenantId|campusId|MembershipId|createdBy|reviewedBy|studentId|guardian|sourceRefs|parentAcknowledged/iu,
  );
  for (const name of ["MonthlyFeedbackRecordEnvelope", "MonthlyFeedbackListEnvelope"]) {
    assert.equal(schemas[name].additionalProperties, false);
    assert.deepEqual(schemas[name].required, ["data", "request_id"]);
    assert.deepEqual(Object.keys(schemas[name].properties), ["data", "request_id"]);
  }
  assert.equal(
    schemas.MonthlyFeedbackRecordEnvelope.properties.data.$ref,
    "#/components/schemas/MonthlyFeedbackRecord",
  );
  const list = schemas.MonthlyFeedbackListEnvelope.properties.data;
  assert.equal(list.additionalProperties, false);
  assert.deepEqual(list.required, ["records", "canCreate"]);
  assert.deepEqual(Object.keys(list.properties), ["records", "canCreate"]);
  assert.equal(list.properties.records.items.$ref, "#/components/schemas/MonthlyFeedbackRecord");
  assert.equal(list.properties.canCreate.type, "boolean");
});

test("OpenAPI describes assigned-class daily review with strict versioned actions", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  for (const [path, method] of [
    ["/admin/daily-reports", "get"],
    ["/admin/daily-reports/{reportId}/review", "post"],
    ["/admin/daily-reports/{reportId}/withdraw", "post"],
  ]) {
    const operation = document.paths[path!]?.[method!];
    assert.equal(operation?.["x-required-capability"], "daily:review");
    assert.equal(operation?.["x-auth-required"], true);
    assert.equal(operation?.["x-scope-required"], true);
    for (const status of ["200", "400", "401", "403"]) assert.ok(operation.responses[status]);
    if (method === "post") {
      assert.ok(operation.responses["404"]);
      assert.ok(operation.responses["409"]);
    }
  }
  const schemas = document.components.schemas;
  assert.ok(schemas.StaffDailyReviewRecord.required.includes("authorLabel"));
  assert.equal(schemas.StaffDailyReviewRecord.properties.authorLabel.maxLength, 120);
  assert.equal(schemas.StaffDailyReviewInput.additionalProperties, false);
  assert.deepEqual(schemas.StaffDailyReviewInput.required, ["version", "action"]);
  assert.deepEqual(schemas.StaffDailyReviewInput.properties.action.enum, ["CONFIRM", "RETURN"]);
  assert.equal(schemas.StaffDailyReviewInput.properties.version.minimum, 1);
  assert.deepEqual(schemas.StaffDailyWithdrawInput.required, ["version"]);
  assert.doesNotMatch(
    JSON.stringify(schemas.StaffDailyReviewRecord),
    /tenantId|campusId|classRef|MembershipId|createdBy|sourceRefs/,
  );
});

test("OpenAPI documents the trusted versioned admin meal workflow without private scope fields", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const operations = [
    ["/admin/meals", "get", "listAdminMeals", "content:write"],
    ["/admin/meals/{mealId}/draft", "post", "createAdminMealDraft", "content:write"],
    ["/admin/meals/{mealId}/draft", "put", "updateAdminMealDraft", "content:write"],
    ["/admin/meals/{mealId}/publish", "post", "publishAdminMeal", "content:publish"],
    ["/admin/meals/{mealId}/unpublish", "post", "unpublishAdminMeal", "content:publish"],
  ];
  for (const [path, method, operationId, capability] of operations) {
    const operation = document.paths[path!]?.[method!];
    assert.ok(operation, `${method} ${path} must exist`);
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], capability);
    assert.ok(operation.responses["401"]);
    assert.ok(operation.responses["403"]);
  }
  const meal = document.components.schemas.AdminMeal;
  assert.equal(meal.additionalProperties, false);
  assert.deepEqual(meal.required, [
    "id",
    "meal_date",
    "meal_type",
    "items",
    "notes",
    "status",
    "version",
    "published_at",
    "updated_at",
    "actions",
  ]);
  for (const key of [
    "tenant_id",
    "campus_id",
    "updated_by",
    "private_notes",
    "media_ref",
    "synthetic_data",
  ]) {
    assert.equal(key in meal.properties, false);
  }
  const draft = document.components.schemas.AdminMealDraftPayload;
  assert.equal(draft.additionalProperties, false);
  assert.deepEqual(draft.required, ["meal_date", "meal_type", "items", "notes"]);
  assert.equal(draft.properties.items.minItems, 1);
  assert.equal(draft.properties.items.maxItems, 12);
  assert.equal(
    document.components.schemas.AdminMealVersionRequest.properties.expected_version.minimum,
    1,
  );
  assert.equal(document.components.parameters.MealId.schema.format, "uuid");
});

test("parent binding candidates require invited scope and expose only the minimal option", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const route = document.paths["/parent/student-options"].get;
  assert.equal(route["x-auth-required"], true);
  assert.equal(route["x-scope-required"], true);
  assert.equal(route["x-required-capability"], "binding:apply");
  assert.deepEqual(Object.keys(route.responses).sort(), ["200", "400", "401", "403"]);
  const option = document.components.schemas.GuardianBindingStudentOption;
  assert.equal(option.additionalProperties, false);
  assert.deepEqual(Object.keys(option.properties).sort(), ["alias", "id", "label"]);
  assert.deepEqual([...option.required].sort(), ["alias", "id", "label"]);
});

test("contracts exports stable values", () => {
  assert.deepEqual(CONTENT_TYPES, [
    "INSTITUTION",
    "HOME_BLOCK",
    "PUBLIC_TEACHER",
    "ACTIVITY",
    "MEAL",
    "GUIDE",
    "RESOURCE",
    "PARTNER_LINK",
  ]);
  assert.deepEqual(CONTENT_STATUSES, ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]);
  assert.deepEqual(CONTENT_VISIBILITIES, ["PUBLIC", "MEMBERS", "STAFF", "ADMIN"]);
  assert.deepEqual(BLOCK_KINDS, ["TEXT", "HEADING", "IMAGE_REF", "LINK_REF", "LIST"]);
  assert.equal(ERROR_CODES.length, 16);
  assert.deepEqual(PARTNER_LINK_PUBLICATION_STATUSES, ["DRAFT", "PUBLISHED", "UNPUBLISHED"]);
  assert.deepEqual(PARTNER_LINK_ENABLED_STATUSES, ["ENABLED", "DISABLED"]);
  assert.deepEqual(ERROR_CODES, [
    "UNAUTHENTICATED",
    "FORBIDDEN_ROLE",
    "FORBIDDEN_SCOPE",
    "NOT_FOUND_SCOPED",
    "VALIDATION_FAILED",
    "CONSENT_REQUIRED",
    "CONFLICT_STATE",
    "VERSION_MISMATCH",
    "IDEMPOTENCY_REPLAY_MISMATCH",
    "RATE_LIMITED",
    "FILE_TYPE_REJECTED",
    "FILE_SCAN_PENDING",
    "AI_SAFETY_BLOCKED",
    "PROVIDER_UNAVAILABLE",
    "DELETION_PENDING",
    "INTERNAL_ERROR",
  ]);
});

test("contracts expose source-supported readonly shapes", () => {
  const item = {
    id: "00000000-0000-4000-8000-000000000001",
    tenant_id: "00000000-0000-4000-8000-000000000002",
    type: "INSTITUTION",
    status: "DRAFT",
    title: "模拟内容",
    version: 1,
    visibility: "PUBLIC",
    body: { summary: "模拟摘要", blocks: [] },
    synthetic_data: true,
  } as const satisfies ContentItem;
  const success = {
    data: item,
    request_id: "req-synthetic-001",
  } satisfies SuccessEnvelope<ContentItem>;
  const error = {
    error: { code: "VALIDATION_FAILED", message: "Invalid input" },
    request_id: "req-synthetic-002",
  } satisfies ErrorEnvelope;

  assert.equal(success.data.synthetic_data, true);
  assert.equal(error.error.code, "VALIDATION_FAILED");
});

test("partner-link shared projections include only the safe synthetic fields", () => {
  const projection = {
    id: "partner-link-synthetic",
    title: "模拟伙伴入口",
    description: "只用于本机演示。",
    symbolicDestination: "PARTNER_CLOUD_SYNTHETIC_WORKSPACE",
    normalizedHost: "synthetic.partner.invalid",
    normalizedPath: "/approved/workspace",
    publicationStatus: "PUBLISHED",
    enabledStatus: "ENABLED",
    policyVersion: "policy-v1",
    version: 1,
  } as const satisfies PartnerLinkProjectionDto;
  const entry = {
    ...projection,
    handoffToken: "handoff:partner-link-synthetic:1",
    expiresAt: "2026-10-16T08:05:00.000Z",
  } satisfies PartnerLinkEntryProjectionDto;

  assert.equal(projection.normalizedHost, "synthetic.partner.invalid");
  assert.equal(typeof entry.handoffToken, "string");
});

test("OpenAPI document matches the shared identity and error enums", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    openapi: string;
    paths: Record<string, Record<string, OpenApiOperation>>;
    components: { schemas: Record<string, OpenApiSchema> };
  };

  assert.equal(document.openapi, "3.1.0");
  assert.deepEqual(Object.keys(document.paths).sort(), [
    "/admin/audit-logs",
    "/admin/child-monthly-reports",
    "/admin/child-monthly-reports/{id}/publish",
    "/admin/child-monthly-reports/{id}/review",
    "/admin/daily-reports",
    "/admin/daily-reports/{reportId}/review",
    "/admin/daily-reports/{reportId}/withdraw",
    "/admin/fees",
    "/admin/fees/{feeId}/revoke",
    "/admin/institution/{kind}/{contentKey}/draft",
    "/admin/institution/{kind}/{contentKey}/publish",
    "/admin/institution/{kind}/{contentKey}/unpublish",
    "/admin/learning-institution-setting",
    "/admin/meals",
    "/admin/meals/{mealId}/draft",
    "/admin/meals/{mealId}/publish",
    "/admin/meals/{mealId}/unpublish",
    "/admin/monthly-feedback",
    "/admin/monthly-feedback/{id}/publish",
    "/admin/monthly-feedback/{id}/review",
    "/admin/student-transfers",
    "/admin/student-transfers/{id}/review",
    "/admin/tasks",
    "/admin/tasks/{taskId}/cancel",
    "/admin/tasks/{taskId}/check",
    "/files/intents",
    "/files/{fileId}/complete",
    "/files/{fileId}/read",
    "/files/{fileId}/read-link",
    "/guardian-binding/applications",
    "/guardian-relationships",
    "/guardian-relationships/{relationshipId}/release",
    "/health",
    "/identity/login",
    "/identity/logout",
    "/me",
    "/memberships",
    "/parent/attendance-records",
    "/parent/attendance-records/{recordId}",
    "/parent/care-records",
    "/parent/care-records/{recordId}",
    "/parent/care-records/{recordId}/receipt",
    "/parent/fees",
    "/parent/health-incidents",
    "/parent/health-incidents/{incidentId}/ack",
    "/parent/health-incidents/{incidentId}/read",
    "/parent/learning",
    "/parent/learning-sessions/{sessionId}",
    "/parent/learning-sessions/{sessionId}/answer",
    "/parent/learning-sessions/{sessionId}/close",
    "/parent/learning-sessions/{sessionId}/hint",
    "/parent/learning/{studentId}/contact",
    "/parent/learning/{studentId}/controls",
    "/parent/leave-requests",
    "/parent/leave-requests/{requestId}/acknowledge",
    "/parent/leave-requests/{requestId}/resubmit",
    "/parent/leave-requests/{requestId}/withdraw",
    "/parent/notices",
    "/parent/notices/{noticeId}/ack",
    "/parent/notices/{noticeId}/read",
    "/parent/pickup",
    "/parent/pickup/authorizations",
    "/parent/pickup/authorizations/{authorizationId}/activate",
    "/parent/pickup/authorizations/{authorizationId}/credential",
    "/parent/pickup/authorizations/{authorizationId}/revoke",
    "/parent/relationships/{relationshipId}/monthly-reports",
    "/parent/relationships/{relationshipId}/monthly-reports/{id}/ack",
    "/parent/student-options",
    "/parent/students/{studentId}/learning-sessions",
    "/public-content/{contentKey}",
    "/public/activities",
    "/public/institution/{kind}/{contentKey}",
    "/public/meals",
    "/public/teachers/{profileId}",
    "/staff/attendance-records",
    "/staff/attendance-records/{recordId}",
    "/staff/attendance-records/{recordId}/arrive",
    "/staff/attendance-records/{recordId}/correction",
    "/staff/attendance-records/{recordId}/depart",
    "/staff/attendance-records/{recordId}/review",
    "/staff/attendance-students",
    "/staff/care-record-students",
    "/staff/care-records",
    "/staff/care-records/{recordId}",
    "/staff/care-records/{recordId}/publish",
    "/staff/care-records/{recordId}/resubmit",
    "/staff/care-records/{recordId}/review",
    "/staff/care-records/{recordId}/revoke-publication",
    "/staff/care-records/{recordId}/submit",
    "/staff/care-records/{recordId}/withdraw",
    "/staff/child-monthly-reports",
    "/staff/child-monthly-reports/{id}",
    "/staff/child-monthly-reports/{id}/submit",
    "/staff/guardian-binding/applications",
    "/staff/guardian-binding/applications/{applicationId}/review",
    "/staff/guides",
    "/staff/guides/{guideId}",
    "/staff/health-incidents",
    "/staff/health-incidents/students",
    "/staff/health-incidents/{incidentId}/publish",
    "/staff/health-incidents/{incidentId}/review",
    "/staff/health-incidents/{incidentId}/revoke",
    "/staff/health-incidents/{incidentId}/submit",
    "/staff/health-incidents/{incidentId}/supplement",
    "/staff/learning-summaries",
    "/staff/leave-requests",
    "/staff/leave-requests/{requestId}/review",
    "/staff/monthly-feedback",
    "/staff/monthly-feedback/{id}",
    "/staff/monthly-feedback/{id}/submit",
    "/staff/notices",
    "/staff/notices/review",
    "/staff/notices/{noticeId}/publish",
    "/staff/notices/{noticeId}/review",
    "/staff/notices/{noticeId}/revoke",
    "/staff/notices/{noticeId}/submit",
    "/staff/partner-cloud-links",
    "/staff/partner-cloud-links/{linkId}/entry-check",
    "/staff/pickup/credentials/confirm",
    "/staff/pickup/credentials/preview",
    "/staff/resources",
    "/staff/resources/{resourceId}",
    "/staff/tasks",
    "/staff/tasks/{taskId}/claim",
    "/staff/tasks/{taskId}/complete",
    "/staff/tasks/{taskId}/start",
  ]);
  assert.deepEqual(document.components.schemas.MembershipStatus?.enum, MEMBERSHIP_STATUSES);
  assert.deepEqual(document.components.schemas.IdentityCapability?.enum, IDENTITY_CAPABILITIES);

  const parentLearning = document.paths["/parent/learning"]?.get;
  assert.equal(parentLearning?.["x-required-capability"], "binding:read");
  assert.equal(
    parentLearning?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/ParentLearningEnvelope",
  );
  const parentLearningProjection = document.components.schemas.ParentLearningProjection;
  assert.deepEqual(parentLearningProjection?.required, [
    "approvedStudents",
    "parentControls",
    "parentSummary",
    "parentSummaryUpdatedAt",
  ]);
  assert.deepEqual(Object.keys(parentLearningProjection?.properties ?? {}).sort(), [
    "approvedStudents",
    "parentControls",
    "parentSummary",
    "parentSummaryUpdatedAt",
  ]);

  const learningSessionOperations = [
    ["/parent/students/{studentId}/learning-sessions", "get"],
    ["/parent/students/{studentId}/learning-sessions", "post"],
    ["/parent/learning-sessions/{sessionId}", "get"],
    ["/parent/learning-sessions/{sessionId}/answer", "post"],
    ["/parent/learning-sessions/{sessionId}/hint", "post"],
    ["/parent/learning-sessions/{sessionId}/close", "post"],
  ] as const;
  for (const [path, method] of learningSessionOperations) {
    const operation = document.paths[path]?.[method];
    assert.equal(operation?.["x-auth-required"], true);
    assert.equal(operation?.["x-scope-required"], true);
    assert.equal(operation?.["x-required-capability"], "binding:read");
  }
  const learningSessionProjection = document.components.schemas.ParentLearningSessionProjection;
  assert.equal(learningSessionProjection?.additionalProperties, false);
  assert.equal(learningSessionProjection?.properties?.guidanceMode?.const, "FIXED_LOCAL");
  assert.equal("tenantId" in (learningSessionProjection?.properties ?? {}), false);
  assert.equal("campusId" in (learningSessionProjection?.properties ?? {}), false);
  assert.equal("consentId" in (learningSessionProjection?.properties ?? {}), false);
  assert.equal(
    document.components.schemas.ParentLearningSessionAnswerRequest?.additionalProperties,
    false,
  );
  assert.deepEqual(
    document.components.schemas.ParentLearningSessionAnswerRequest?.properties?.choice?.enum,
    ["A", "B", "C"],
  );

  const submitLearningSummary = document.paths["/staff/learning-summaries"]?.post;
  assert.equal(submitLearningSummary?.["x-required-capability"], "learning:summary");
  assert.equal(
    submitLearningSummary?.requestBody?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/StaffLearningSummaryRequest",
  );
  assert.equal(
    submitLearningSummary?.responses?.["201"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/StaffLearningSummaryEnvelope",
  );
  const staffKnowledgePoint = document.components.schemas.StaffLearningKnowledgePointInput;
  const parentKnowledgePoint = document.components.schemas.ParentLearningKnowledgePointSummary;
  assert.equal(staffKnowledgePoint?.properties?.sessionCount?.maximum, 100);
  assert.equal(parentKnowledgePoint?.properties?.sessionCount?.maximum, undefined);
  assert.equal(parentKnowledgePoint?.properties?.completedSessions?.maximum, undefined);
  assert.match(String(staffKnowledgePoint?.description), /unique/iu);
  assert.equal(
    document.components.schemas.StaffLearningSummaryRequest?.properties?.knowledgePoints
      ?.uniqueItems,
    undefined,
  );

  const create = document.paths["/staff/health-incidents"]?.post;
  assert.equal(create?.operationId, "createStaffHealthIncidentDraft");
  assert.equal(create?.["x-required-capability"], "health:create");
  assert.equal(
    create?.requestBody?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/HealthIncidentCreateRequest",
  );
  assert.equal(
    create?.responses?.["201"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/HealthIncidentStaffEnvelope",
  );
  assert.equal(
    create?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/ErrorEnvelope",
  );

  const students = document.paths["/staff/health-incidents/students"]?.get;
  assert.equal(students?.operationId, "listStaffHealthIncidentStudents");
  assert.equal(students?.["x-required-capability"], "health:create");
  assert.equal(
    students?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/HealthIncidentStudentListEnvelope",
  );
  assert.deepEqual(document.components.schemas.HealthIncidentStudentOption?.required, [
    "id",
    "studentLabel",
  ]);
  assert.equal(
    document.components.schemas.HealthIncidentStudentOption?.additionalProperties,
    false,
  );

  const submit = document.paths["/staff/health-incidents/{incidentId}/submit"]?.post;
  assert.equal(submit?.operationId, "submitStaffHealthIncident");
  assert.equal(submit?.["x-required-capability"], "health:submit");
  assert.equal(
    submit?.requestBody?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/HealthIncidentVersionRequest",
  );
  assert.equal(
    submit?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/ErrorEnvelope",
  );

  const parentHealthRoutes = [
    {
      path: "/parent/health-incidents",
      method: "get",
      operationId: "listParentHealthIncidents",
      response: "#/components/schemas/HealthIncidentParentListEnvelope",
    },
    {
      path: "/parent/health-incidents/{incidentId}/read",
      method: "post",
      operationId: "readParentHealthIncident",
      response: "#/components/schemas/HealthIncidentParentEnvelope",
    },
    {
      path: "/parent/health-incidents/{incidentId}/ack",
      method: "post",
      operationId: "acknowledgeParentHealthIncident",
      response: "#/components/schemas/HealthIncidentParentEnvelope",
    },
  ] as const;
  for (const route of parentHealthRoutes) {
    const operation = document.paths[route.path]?.[route.method];
    assert.equal(operation?.operationId, route.operationId);
    assert.equal(operation?.["x-required-capability"], "binding:read");
    assert.equal(
      operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
      route.response,
    );
  }
  assert.equal(
    document.paths["/parent/health-incidents/{incidentId}/read"]?.post?.requestBody?.content?.[
      "application/json"
    ]?.schema?.$ref,
    "#/components/schemas/HealthIncidentVersionRequest",
  );
  assert.equal(
    document.paths["/parent/health-incidents/{incidentId}/ack"]?.post?.requestBody?.content?.[
      "application/json"
    ]?.schema?.$ref,
    "#/components/schemas/HealthIncidentVersionRequest",
  );
  for (const path of [
    "/parent/health-incidents/{incidentId}/read",
    "/parent/health-incidents/{incidentId}/ack",
  ]) {
    assert.equal(
      document.paths[path]?.post?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref,
      "#/components/schemas/ErrorEnvelope",
    );
  }

  assert.deepEqual(
    Object.keys(document.components.schemas.HealthIncidentStaffProjection?.properties ?? {}).sort(),
    [
      "bindingId",
      "bindingVersion",
      "campusId",
      "classId",
      "createdByLabel",
      "dispositionCode",
      "dispositionLabel",
      "id",
      "observationCode",
      "observationLabel",
      "published",
      "reviewedBy",
      "status",
      "statusLabel",
      "studentId",
      "studentLabel",
      "summaryCode",
      "synthetic",
      "tenantId",
      "updatedAt",
      "version",
    ],
  );
  assert.deepEqual(
    document.components.schemas.HealthIncidentStaffProjection?.required?.slice().sort(),
    Object.keys(document.components.schemas.HealthIncidentStaffProjection?.properties ?? {}).sort(),
  );
  assert.equal(
    document.components.schemas.HealthIncidentStaffProjection?.additionalProperties,
    false,
  );
  assert.deepEqual(
    Object.keys(
      document.components.schemas.HealthIncidentParentProjection?.properties ?? {},
    ).sort(),
    [
      "id",
      "parentSummary",
      "receiptStatus",
      "status",
      "studentLabel",
      "synthetic",
      "updatedAt",
      "version",
    ],
  );
  assert.deepEqual(
    document.components.schemas.HealthIncidentParentProjection?.required?.slice().sort(),
    Object.keys(
      document.components.schemas.HealthIncidentParentProjection?.properties ?? {},
    ).sort(),
  );
  assert.equal(
    document.components.schemas.HealthIncidentParentProjection?.additionalProperties,
    false,
  );
  assert.equal(
    document.components.schemas.HealthIncidentParentProjection?.properties?.synthetic?.const,
    true,
  );
  assert.equal(
    document.components.schemas.HealthIncidentCreateRequest?.additionalProperties,
    false,
  );
  assert.deepEqual(
    Object.keys(document.components.schemas.HealthIncidentCreateRequest?.properties ?? {}).sort(),
    ["dispositionCode", "observationCode", "studentId"],
  );
  assert.equal(
    document.components.schemas.HealthIncidentVersionRequest?.additionalProperties,
    false,
  );
  assert.deepEqual(
    Object.keys(document.components.schemas.HealthIncidentVersionRequest?.properties ?? {}).sort(),
    ["version"],
  );
  assert.deepEqual(document.components.schemas.CareRecordStatus?.enum, CARE_RECORD_STATUSES);
  assert.deepEqual(document.components.schemas.AttendanceStatus?.enum, ATTENDANCE_STATUSES);
  assert.deepEqual(
    document.components.schemas.AttendanceCorrectionStatus?.enum,
    ATTENDANCE_CORRECTION_STATUSES,
  );
  assert.deepEqual(
    document.components.schemas.AttendanceCorrectionReason?.enum,
    ATTENDANCE_CORRECTION_REASONS,
  );
  assert.deepEqual(
    document.components.schemas.AttendanceRevisionAction?.enum,
    ATTENDANCE_REVISION_ACTIONS,
  );
  assert.deepEqual(document.components.schemas.CareArrival?.enum, CARE_ARRIVALS);
  assert.deepEqual(document.components.schemas.CareHomework?.enum, CARE_HOMEWORK);
  assert.deepEqual(document.components.schemas.CareMeal?.enum, CARE_MEALS);
  assert.deepEqual(document.components.schemas.CareRest?.enum, CARE_RESTS);
  assert.deepEqual(document.components.schemas.CareActivity?.enum, CARE_ACTIVITIES);
  assert.deepEqual(document.components.schemas.CareWellbeing?.enum, CARE_WELLBEING);
  assert.deepEqual(
    document.components.schemas.CareRecordReceiptStatus?.enum,
    CARE_RECORD_RECEIPT_STATUSES,
  );
  assert.deepEqual(document.components.schemas.ErrorCode?.enum, ERROR_CODES);
});

test("invite sign-in contract keeps credentials strict and scopes server-owned", () => {
  const loginInput = {
    username: "parent-demo",
    password: "Synthetic-only-password-73!",
  } satisfies InviteLoginRequest;
  const loginResponse = {
    access_token: "synthetic-bearer-token",
    token_type: "Bearer",
    expires_at: "2026-10-17T08:00:00.000Z",
  } satisfies InviteLoginResponse;
  const logoutResponse = { logged_out: true } satisfies InviteLogoutResponse;
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<string, Record<string, Record<string, unknown>>>;
    components: { schemas: Record<string, Record<string, unknown>> };
  };
  const login = document.paths["/identity/login"]?.post;
  const logout = document.paths["/identity/logout"]?.post;
  const loginSchema = document.components.schemas.InviteLoginRequest;

  assert.equal(login?.operationId, "loginInviteAccount");
  assert.equal(login?.["x-auth-required"], false);
  assert.deepEqual(loginSchema?.required, ["username", "password"]);
  assert.equal(loginSchema?.additionalProperties, false);
  assert.equal(logout?.operationId, "logoutInviteAccount");
  assert.equal(logout?.["x-auth-required"], true);
  assert.deepEqual(loginInput, {
    username: "parent-demo",
    password: "Synthetic-only-password-73!",
  });
  assert.equal(loginResponse.token_type, "Bearer");
  assert.deepEqual(logoutResponse, { logged_out: true });
});

test("OpenAPI documents scoped file upload and read-link lifecycle routes", () => {
  type Operation = {
    operationId?: string;
    "x-auth-required"?: boolean;
    "x-scope-required"?: boolean;
    "x-required-capability"?: string;
    parameters?: readonly { name?: string; in?: string }[];
    requestBody?: unknown;
    responses?: Record<string, unknown>;
  };
  type Schema = {
    additionalProperties?: boolean;
    enum?: readonly string[];
    required?: readonly string[];
    properties?: Record<string, unknown>;
  };
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<string, Partial<Record<"get" | "post", Operation>>>;
    components: { schemas: Record<string, Schema> };
  };
  const operations = [
    ["/files/intents", "post", "createFileUploadIntent", ["201", "400", "401", "403"]],
    [
      "/files/{fileId}/complete",
      "post",
      "completeFileUpload",
      ["200", "400", "401", "403", "404", "409", "410"],
    ],
    [
      "/files/{fileId}/read-link",
      "post",
      "createFileReadLink",
      ["200", "400", "401", "403", "404", "409"],
    ],
    ["/files/{fileId}/read", "get", "readFile", ["200", "400", "401", "403", "404", "409", "410"]],
  ] as const;

  for (const [path, method, operationId, responseCodes] of operations) {
    const operation = document.paths[path]?.[method];
    assert.ok(operation, path);
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], "content:write");
    assert.deepEqual(Object.keys(operation.responses ?? {}).sort(), responseCodes);
  }

  assert.ok(document.paths["/files/intents"]?.post?.requestBody);
  assert.ok(document.paths["/files/{fileId}/complete"]?.post?.requestBody);
  assert.deepEqual(document.paths["/files/{fileId}/read-link"]?.post?.parameters, [
    { $ref: "#/components/parameters/FileId" },
  ]);
  assert.deepEqual(document.paths["/files/{fileId}/read"]?.get?.parameters, [
    { $ref: "#/components/parameters/FileId" },
    { $ref: "#/components/parameters/ReadToken" },
  ]);
  for (const schemaName of [
    "FileUploadIntentRequest",
    "FileCompleteRequest",
    "FileRecordProjection",
    "FileReadLinkProjection",
    "FileReadProjection",
  ]) {
    assert.equal(document.components.schemas[schemaName]?.additionalProperties, false);
  }
  assert.deepEqual(document.components.schemas.FileErrorCode?.enum, [
    "FORBIDDEN_SCOPE",
    "NOT_FOUND_SCOPED",
    "VALIDATION_FAILED",
    "MIME_NOT_ALLOWED",
    "SIZE_NOT_ALLOWED",
    "CHECKSUM_MISMATCH",
    "MIME_MISMATCH",
    "UPLOAD_INTENT_INVALID",
    "UPLOAD_INTENT_EXPIRED",
    "UPLOAD_INTENT_CONSUMED",
    "READ_LINK_INVALID",
    "READ_LINK_EXPIRED",
    "UNSIGNED_ACCESS",
    "SCAN_NOT_APPROVED",
    "STORAGE_UNAVAILABLE",
  ]);
  assert.ok(document.components.schemas.FileUploadIntentRequest?.required?.includes("checksum"));
  assert.ok(document.components.schemas.FileCompleteRequest?.required?.includes("bytes_base64"));
});

test("OpenAPI documents public health and trusted-context identity routes", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<string, { get?: Record<string, unknown> }>;
  };

  assert.equal(document.paths["/health"]?.get?.["x-auth-required"], undefined);
  assert.equal(document.paths["/me"]?.get?.["x-auth-required"], true);
  assert.equal(document.paths["/me"]?.get?.["x-scope-required"], true);
  assert.equal(document.paths["/me"]?.get?.["x-required-capability"], "identity:read");
  assert.equal(document.paths["/memberships"]?.get?.["x-auth-required"], true);
  assert.equal(document.paths["/memberships"]?.get?.["x-scope-required"], true);
  assert.equal(document.paths["/memberships"]?.get?.["x-required-capability"], "memberships:read");
});

test("OpenAPI documents public activity reads without client-selected campus scope", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          parameters?: readonly { $ref?: string }[];
          responses?: Record<string, unknown>;
          [key: string]: unknown;
        };
      }
    >;
    components: {
      parameters: Record<string, { in?: string; required?: boolean; schema?: { format?: string } }>;
      schemas: Record<
        string,
        {
          additionalProperties?: boolean;
          required?: readonly string[];
          properties?: Record<string, unknown>;
        }
      >;
    };
  };
  const route = document.paths["/public/activities"]?.get;

  assert.equal(route?.operationId, "listPublicActivities");
  assert.equal(route?.["x-auth-required"], false);
  assert.equal(route?.["x-scope-required"], true);
  assert.deepEqual(route?.parameters, [{ $ref: "#/components/parameters/ActivityDate" }]);
  assert.equal(document.components.parameters.ActivityDate?.in, "query");
  assert.equal(document.components.parameters.ActivityDate?.required, true);
  assert.equal(document.components.parameters.ActivityDate?.schema?.format, "date");
  assert.ok(route?.responses?.["200"]);
  assert.ok(route?.responses?.["400"]);
  assert.ok(route?.responses?.["403"]);
  const activity = document.components.schemas.PublicActivity;
  assert.equal(activity?.additionalProperties, false);
  assert.deepEqual(activity?.required, [
    "id",
    "title",
    "summary",
    "start_date",
    "end_date",
    "location",
    "published_at",
  ]);
  assert.equal("tenant_id" in (activity?.properties ?? {}), false);
  assert.equal("campus_id" in (activity?.properties ?? {}), false);
  assert.equal("private_notes" in (activity?.properties ?? {}), false);
});

test("OpenAPI documents scoped public meal reads without internal fields", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          operationId?: string;
          description?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          parameters?: readonly { $ref?: string }[];
          responses?: Readonly<Record<string, unknown>>;
        };
      }
    >;
    components: {
      parameters: Record<
        string,
        {
          in?: string;
          required?: boolean;
          schema?: { format?: string; type?: string; maxLength?: number; pattern?: string };
        }
      >;
      schemas: Record<
        string,
        {
          enum?: readonly string[];
          additionalProperties?: boolean;
          required?: readonly string[];
          properties?: Record<string, unknown>;
        }
      >;
    };
  };
  const route = document.paths["/public/meals"]?.get;

  assert.equal(route?.operationId, "listPublicMeals");
  assert.equal(route?.["x-auth-required"], false);
  assert.equal(route?.["x-scope-required"], true);
  assert.deepEqual(route?.parameters, [
    { $ref: "#/components/parameters/MealDate" },
    { $ref: "#/components/parameters/PublicCampusReference" },
  ]);
  assert.match(route?.description ?? "", /public_ref/u);
  assert.equal(document.components.parameters.MealDate?.in, "query");
  assert.equal(document.components.parameters.MealDate?.required, true);
  assert.equal(document.components.parameters.MealDate?.schema?.format, "date");
  assert.equal(document.components.parameters.PublicCampusReference?.in, "query");
  assert.equal(document.components.parameters.PublicCampusReference?.required, true);
  assert.equal(document.components.parameters.PublicCampusReference?.schema?.type, "string");
  assert.equal(document.components.parameters.PublicCampusReference?.schema?.maxLength, 128);
  assert.equal(
    document.components.parameters.PublicCampusReference?.schema?.pattern,
    "^[A-Za-z0-9._~-]{1,128}$",
  );
  assert.deepEqual(Object.keys(route?.responses ?? {}).sort(), ["200", "400", "403"]);

  const mealType = document.components.schemas.MealType;
  assert.deepEqual(mealType?.enum, ["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
  const meal = document.components.schemas.PublicMeal;
  assert.equal(meal?.additionalProperties, false);
  assert.deepEqual(meal?.required, [
    "id",
    "meal_date",
    "meal_type",
    "items",
    "notes",
    "published_at",
  ]);
  for (const field of [
    "tenant_id",
    "campus_id",
    "version",
    "private_notes",
    "synthetic_data",
    "updated_by",
    "updated_at",
  ]) {
    assert.equal(field in (meal?.properties ?? {}), false, `${field} must remain private`);
  }
});

test("OpenAPI component references resolve within the shared document", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as Record<string, unknown>;
  const references: string[] = [];
  const collectReferences = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collectReferences);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.$ref === "string") references.push(record.$ref);
    Object.values(record).forEach(collectReferences);
  };

  collectReferences(document);
  assert.ok(references.length > 0);

  for (const reference of references) {
    assert.ok(reference.startsWith("#/"), reference);
    let target: unknown = document;
    for (const rawSegment of reference.slice(2).split("/")) {
      if (typeof target !== "object" || target === null) {
        target = undefined;
        break;
      }
      const segment = rawSegment.replace(/~1/g, "/").replace(/~0/g, "~");
      target = (target as Record<string, unknown>)[segment];
    }
    assert.notEqual(target, undefined, reference);
  }
});

test("OpenAPI describes the scoped public-content read contract", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          parameters?: readonly unknown[];
          responses?: Readonly<Record<string, unknown>>;
        };
      }
    >;
    components: {
      schemas: Record<
        string,
        {
          enum?: readonly string[];
          required?: readonly string[];
          properties?: Record<string, unknown>;
        }
      >;
    };
  };
  const operation = document.paths["/public-content/{contentKey}"]?.get;

  assert.ok(operation, "OpenAPI must describe the existing public-content route");
  assert.equal(operation["x-auth-required"], true);
  assert.equal(operation["x-scope-required"], true);
  const parameters = JSON.stringify(operation.parameters);
  assert.match(parameters, /ContentKey/u);
  assert.match(parameters, /TenantId/u);
  assert.match(parameters, /CampusId/u);
  assert.deepEqual(Object.keys(operation.responses ?? {}).sort(), [
    "200",
    "400",
    "401",
    "403",
    "404",
  ]);
  assert.deepEqual(document.components.schemas.ContentType?.enum, CONTENT_TYPES);
  assert.deepEqual(document.components.schemas.ContentVisibility?.enum, CONTENT_VISIBILITIES);
  assert.deepEqual(document.components.schemas.BlockKind?.enum, BLOCK_KINDS);
});

test("OpenAPI describes a server-scoped public teacher projection without private fields", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          parameters?: readonly {
            name?: string;
            in?: string;
            required?: boolean;
          }[];
          responses?: Readonly<Record<string, unknown>>;
        };
      }
    >;
    components: {
      parameters: Record<string, unknown>;
      schemas: Record<
        string,
        {
          properties?: Record<string, unknown>;
          required?: readonly string[];
        }
      >;
    };
  };
  const operation = document.paths["/public/teachers/{profileId}"]?.get;

  assert.ok(operation, "OpenAPI must describe the public teacher read route");
  assert.equal(operation["x-auth-required"], false);
  assert.equal(operation["x-scope-required"], true);
  assert.deepEqual(operation.parameters, [{ $ref: "#/components/parameters/ProfileId" }]);
  assert.deepEqual(document.components.parameters.ProfileId, {
    name: "profileId",
    in: "path",
    required: true,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9._:-]{1,128}$",
    },
  });
  assert.deepEqual(Object.keys(operation.responses ?? {}).sort(), ["200", "400", "403", "404"]);
  assert.match(JSON.stringify(operation.responses?.["200"]), /PublicTeacherEnvelope/u);

  const publicCard = document.components.schemas.PublicTeacherCard;
  assert.ok(publicCard, "OpenAPI must define the public teacher field allowlist");
  assert.deepEqual(Object.keys(publicCard.properties ?? {}).sort(), [
    "bio",
    "display_name",
    "headline",
    "id",
    "photo_ref",
    "published_at",
    "subjects",
  ]);
  assert.deepEqual(publicCard.required, [
    "id",
    "display_name",
    "headline",
    "subjects",
    "bio",
    "published_at",
  ]);
});

test("OpenAPI describes authenticated staff guide search and versioned detail projections", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          operationId?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          "x-required-capability"?: string;
          parameters?: readonly { $ref?: string }[];
          responses?: Readonly<Record<string, unknown>>;
        };
      }
    >;
    components: {
      parameters: Record<
        string,
        { in?: string; required?: boolean; schema?: Record<string, unknown> }
      >;
      schemas: Record<
        string,
        {
          enum?: readonly string[];
          additionalProperties?: boolean;
          required?: readonly string[];
          properties?: Record<string, unknown>;
        }
      >;
    };
  };
  const search = document.paths["/staff/guides"]?.get;
  const detail = document.paths["/staff/guides/{guideId}"]?.get;

  for (const operation of [search, detail]) {
    assert.equal(operation?.["x-auth-required"], true);
    assert.equal(operation?.["x-scope-required"], true);
    assert.equal(operation?.["x-required-capability"], "content:write");
  }
  assert.equal(search?.operationId, "searchStaffGuides");
  assert.deepEqual(search?.parameters, [
    { $ref: "#/components/parameters/GuideQuery" },
    { $ref: "#/components/parameters/GuideCategoryFilter" },
    { $ref: "#/components/parameters/GuideLimit" },
  ]);
  assert.deepEqual(Object.keys(search?.responses ?? {}).sort(), ["200", "400", "401", "403"]);
  assert.equal(detail?.operationId, "getStaffGuideDetail");
  assert.deepEqual(detail?.parameters, [
    { $ref: "#/components/parameters/StaffGuideId" },
    { $ref: "#/components/parameters/GuideVersion" },
  ]);
  assert.deepEqual(Object.keys(detail?.responses ?? {}).sort(), [
    "200",
    "400",
    "401",
    "403",
    "404",
  ]);
  assert.equal(document.components.parameters.GuideQuery?.required, true);
  assert.deepEqual(document.components.schemas.GuideCategory?.enum, [
    "ORIENTATION",
    "POLICY",
    "SAFETY",
  ]);

  const summary = document.components.schemas.GuideSearchProjection;
  assert.equal(summary?.additionalProperties, false);
  assert.deepEqual(Object.keys(summary?.properties ?? {}).sort(), [
    "category",
    "id",
    "summary",
    "tags",
    "title",
    "version",
  ]);
  const guide = document.components.schemas.GuideDetailProjection;
  assert.equal(guide?.additionalProperties, false);
  assert.deepEqual(Object.keys(guide?.properties ?? {}).sort(), [
    "body",
    "category",
    "file",
    "id",
    "summary",
    "tags",
    "title",
    "version",
  ]);
  assert.deepEqual(
    Object.keys(document.components.schemas.GuideFileProjection?.properties ?? {}).sort(),
    ["display_name", "reference"],
  );
});

test("OpenAPI describes scoped staff resource search and versioned detail projections", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          operationId?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          "x-required-capability"?: string;
          parameters?: readonly unknown[];
          responses?: Readonly<Record<string, unknown>>;
        };
      }
    >;
    components: {
      parameters: Record<string, unknown>;
      schemas: Record<
        string,
        {
          enum?: readonly string[];
          additionalProperties?: boolean;
          required?: readonly string[];
          properties?: Record<string, unknown>;
        }
      >;
    };
  };
  const search = document.paths["/staff/resources"]?.get;
  const detail = document.paths["/staff/resources/{resourceId}"]?.get;

  assert.equal(search?.operationId, "searchStaffResources");
  assert.equal(search?.["x-auth-required"], true);
  assert.equal(search?.["x-scope-required"], true);
  assert.equal(search?.["x-required-capability"], "content:write");
  assert.deepEqual(search?.parameters, [
    { $ref: "#/components/parameters/ResourceQuery" },
    { $ref: "#/components/parameters/ResourceCategoryFilter" },
    { $ref: "#/components/parameters/ResourceLimit" },
    { $ref: "#/components/parameters/ResourceCursor" },
  ]);
  assert.deepEqual(Object.keys(search?.responses ?? {}).sort(), [
    "200",
    "400",
    "401",
    "403",
    "409",
  ]);
  assert.deepEqual(search?.responses?.["409"], { $ref: "#/components/responses/ResourceConflict" });
  assert.equal(detail?.operationId, "readStaffResource");
  assert.deepEqual(detail?.parameters, [
    { $ref: "#/components/parameters/ResourceId" },
    { $ref: "#/components/parameters/ResourceVersion" },
  ]);
  assert.deepEqual(Object.keys(detail?.responses ?? {}).sort(), [
    "200",
    "400",
    "401",
    "403",
    "404",
    "409",
  ]);
  assert.deepEqual(document.components.schemas.ResourceCategory?.enum, [
    "LESSON",
    "EXERCISE",
    "READING",
    "REFERENCE",
    "WORKSHEET",
  ]);

  const searchProjection = document.components.schemas.ResourceSearchProjection;
  assert.equal(searchProjection?.additionalProperties, false);
  assert.deepEqual(Object.keys(searchProjection?.properties ?? {}).sort(), [
    "category",
    "id",
    "keywords",
    "summary",
    "title",
    "version",
  ]);
  const detailProjection = document.components.schemas.ResourceDetailProjection;
  assert.equal(detailProjection?.additionalProperties, false);
  assert.deepEqual(Object.keys(detailProjection?.properties ?? {}).sort(), [
    "body",
    "category",
    "file",
    "id",
    "keywords",
    "summary",
    "title",
    "version",
  ]);
  for (const field of ["tenant_id", "campus_id", "file_ref", "provider_url", "updated_by"]) {
    assert.equal(field in (detailProjection?.properties ?? {}), false);
  }
  const fileProjection = document.components.schemas.ResourceFileProjection;
  assert.equal(fileProjection?.additionalProperties, false);
  assert.deepEqual(Object.keys(fileProjection?.properties ?? {}).sort(), [
    "display_name",
    "expires_at",
    "read_intent",
    "reference",
  ]);
});

test("OpenAPI documents the server-scoped admin audit log read contract", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          operationId?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          "x-required-capability"?: string;
          parameters?: readonly { $ref?: string }[];
          responses?: Record<string, unknown>;
        };
      }
    >;
    components: {
      parameters: Record<string, { name?: string; in?: string; schema?: Record<string, unknown> }>;
      schemas: Record<
        string,
        {
          additionalProperties?: boolean;
          enum?: readonly string[];
          required?: readonly string[];
          properties?: Record<string, { const?: unknown; additionalProperties?: unknown }>;
        }
      >;
    };
  };
  const operation = document.paths["/admin/audit-logs"]?.get;
  assert.ok(operation, "OpenAPI must describe the existing Fastify audit route");
  assert.equal(operation.operationId, "listAdminAuditLogs");
  assert.equal(operation["x-auth-required"], true);
  assert.equal(operation["x-scope-required"], true);
  assert.equal(operation["x-required-capability"], "memberships:read");
  assert.deepEqual(operation.parameters, [
    { $ref: "#/components/parameters/AuditActionFilter" },
    { $ref: "#/components/parameters/AuditActorReference" },
    { $ref: "#/components/parameters/AuditTargetType" },
    { $ref: "#/components/parameters/AuditTargetReference" },
    { $ref: "#/components/parameters/AuditCorrelationId" },
    { $ref: "#/components/parameters/AuditTraceId" },
    { $ref: "#/components/parameters/AuditOccurredFrom" },
    { $ref: "#/components/parameters/AuditOccurredTo" },
    { $ref: "#/components/parameters/AuditLimit" },
  ]);
  assert.deepEqual(Object.keys(operation.responses ?? {}).sort(), ["200", "400", "401", "403"]);
  assert.deepEqual(operation.responses?.["200"], {
    description: "Audit events from the active server-resolved campus.",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/AdminAuditLogsEnvelope" } },
    },
  });

  const record = document.components.schemas.AdminAuditLogRecord;
  assert.equal(record?.additionalProperties, false);
  assert.deepEqual(record?.required?.slice().sort(), [
    "action",
    "actor_id",
    "campus_id",
    "correlation_id",
    "event_id",
    "metadata",
    "occurred_at",
    "synthetic_data",
    "target_id",
    "target_type",
    "tenant_id",
    "trace_id",
  ]);
  assert.deepEqual(document.components.schemas.AuditAction?.enum, [
    "CONTENT_DRAFT_CREATED",
    "CONTENT_DRAFT_UPDATED",
    "CONTENT_PUBLISHED",
    "CONTENT_UNPUBLISHED",
    "FILE_INTENT_CREATED",
    "PARTNER_LINK_HANDOFF_CREATED",
  ]);
  assert.equal(record?.properties?.synthetic_data?.const, true);

  const queryParameters = Object.values(document.components.parameters).filter(
    (parameter) => parameter.in === "query",
  );
  assert.equal(
    queryParameters.some((parameter) => parameter.name === "tenant_id"),
    true,
  );
  assert.equal(
    queryParameters.some((parameter) => parameter.name === "campus_id"),
    true,
  );
  for (const ref of operation.parameters ?? []) {
    const name = ref.$ref?.split("/").at(-1);
    assert.notEqual(name, "TenantId");
    assert.notEqual(name, "CampusId");
  }
});

test("OpenAPI documents public institution reads with server-owned scope", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          operationId?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          parameters?: readonly { $ref?: string }[];
          responses?: Record<string, unknown>;
        };
      }
    >;
    components: {
      parameters: Record<string, unknown>;
      schemas: Record<string, { enum?: readonly string[] }>;
    };
  };
  const operation = document.paths["/public/institution/{kind}/{contentKey}"]?.get;

  assert.ok(operation, "OpenAPI must describe the public institution read route");
  assert.equal(operation.operationId, "getPublicInstitutionContent");
  assert.equal(operation["x-auth-required"], false);
  assert.equal(operation["x-scope-required"], true);
  assert.deepEqual(operation.parameters, [
    { $ref: "#/components/parameters/PublicInstitutionKind" },
    { $ref: "#/components/parameters/ContentKey" },
  ]);
  assert.deepEqual(Object.keys(operation.responses ?? {}).sort(), ["200", "400", "403", "404"]);
  assert.match(JSON.stringify(operation.responses?.["200"]), /PublicContentEnvelope/u);
  assert.deepEqual(document.components.schemas.PublicInstitutionRouteKind?.enum, [
    "profile",
    "home",
  ]);
  assert.equal("tenant_id" in document.components.parameters, false);
  assert.equal("campus_id" in document.components.parameters, false);
});

test("OpenAPI documents trusted institution draft and publication operations", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      {
        get?: {
          operationId?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          "x-required-capability"?: string;
          parameters?: readonly { $ref?: string }[];
          responses?: Record<string, unknown>;
        };
        post?: {
          operationId?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          "x-required-capability"?: string;
          parameters?: readonly { $ref?: string }[];
          requestBody?: unknown;
          responses?: Record<string, unknown>;
        };
        put?: {
          operationId?: string;
          "x-auth-required"?: boolean;
          "x-scope-required"?: boolean;
          "x-required-capability"?: string;
          parameters?: readonly { $ref?: string }[];
          requestBody?: unknown;
          responses?: Record<string, unknown>;
        };
      }
    >;
    components: {
      parameters: Record<string, unknown>;
      schemas: Record<
        string,
        {
          enum?: readonly string[];
          required?: readonly string[];
          additionalProperties?: boolean;
          properties?: Record<string, unknown>;
        }
      >;
    };
  };
  const draftPath = "/admin/institution/{kind}/{contentKey}/draft";
  const publishPath = "/admin/institution/{kind}/{contentKey}/publish";
  const unpublishPath = "/admin/institution/{kind}/{contentKey}/unpublish";
  const pathParameters = [
    { $ref: "#/components/parameters/PublicInstitutionKind" },
    { $ref: "#/components/parameters/ContentKey" },
    { $ref: "#/components/parameters/TenantId" },
    { $ref: "#/components/parameters/CampusId" },
  ];

  const readDraft = document.paths[draftPath]?.get;
  assert.ok(readDraft);
  assert.equal(readDraft.operationId, "readInstitutionDraft");
  assert.equal(readDraft["x-auth-required"], true);
  assert.equal(readDraft["x-scope-required"], true);
  assert.equal(readDraft["x-required-capability"], "content:write");
  assert.deepEqual(readDraft.parameters, pathParameters);
  assert.deepEqual(Object.keys(readDraft.responses ?? {}).sort(), ["200", "401", "403", "404"]);

  const create = document.paths[draftPath]?.post;
  assert.ok(create);
  assert.equal(create.operationId, "createInstitutionDraft");
  assert.equal(create["x-auth-required"], true);
  assert.equal(create["x-scope-required"], true);
  assert.equal(create["x-required-capability"], "content:write");
  assert.deepEqual(create.parameters, pathParameters);
  assert.ok(create.requestBody);
  assert.deepEqual(Object.keys(create.responses ?? {}).sort(), [
    "201",
    "400",
    "401",
    "403",
    "404",
    "409",
  ]);

  const update = document.paths[draftPath]?.put;
  assert.ok(update);
  assert.equal(update.operationId, "updateInstitutionDraft");
  assert.equal(update["x-required-capability"], "content:write");
  assert.deepEqual(update.parameters, pathParameters);
  assert.ok(update.requestBody);
  assert.deepEqual(Object.keys(update.responses ?? {}).sort(), [
    "200",
    "400",
    "401",
    "403",
    "404",
    "409",
  ]);

  for (const [path, operation, id] of [
    [publishPath, document.paths[publishPath]?.post, "publishInstitutionContent"],
    [unpublishPath, document.paths[unpublishPath]?.post, "unpublishInstitutionContent"],
  ] as const) {
    assert.ok(operation, path);
    assert.equal(operation.operationId, id);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], "content:publish");
    assert.deepEqual(operation.parameters, pathParameters);
    assert.ok(operation.requestBody);
    assert.deepEqual(Object.keys(operation.responses ?? {}).sort(), [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
    ]);
  }

  assert.deepEqual(document.components.schemas.PublicInstitutionRouteKind?.enum, [
    "profile",
    "home",
  ]);
  assert.ok(document.components.schemas.InstitutionDraftRequest?.required?.includes("payload"));
  assert.ok(
    document.components.schemas.InstitutionDraftUpdateRequest?.required?.includes(
      "expected_version",
    ),
  );
  const record = document.components.schemas.InstitutionAdminContentRecord;
  assert.equal(record?.additionalProperties, false);
  assert.ok(record?.properties?.editor_note);
  assert.ok(record?.properties?.moderation_state);
  assert.ok(record?.properties?.tenant_admin_note);
  assert.ok(record?.properties?.campus_admin_note);
});

test("OpenAPI describes scoped staff partner-link search and local entry checks", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<string, Record<string, Record<string, unknown>>>;
    components: {
      schemas: Record<
        string,
        {
          additionalProperties?: boolean;
          properties?: Record<string, unknown>;
          required?: string[];
        }
      >;
    };
  };
  const search = document.paths["/staff/partner-cloud-links"]?.get;
  const entry = document.paths["/staff/partner-cloud-links/{linkId}/entry-check"]?.get;

  assert.ok(search);
  assert.equal(search.operationId, "searchStaffPartnerLinks");
  assert.equal(search["x-auth-required"], true);
  assert.equal(search["x-scope-required"], true);
  assert.equal(search["x-required-capability"], "content:write");
  assert.deepEqual(
    (search.parameters as { name: string; in: string }[]).map(({ name, in: location }) => [
      location,
      name,
    ]),
    [
      ["query", "query"],
      ["query", "limit"],
    ],
  );
  assert.deepEqual(Object.keys(search.responses as object).sort(), ["200", "400", "401", "403"]);

  assert.ok(entry);
  assert.equal(entry.operationId, "issueStaffPartnerLinkEntry");
  assert.equal(entry["x-auth-required"], true);
  assert.equal(entry["x-scope-required"], true);
  assert.equal(entry["x-required-capability"], "content:write");
  assert.deepEqual(
    (entry.parameters as { name: string; in: string }[]).map(({ name, in: location }) => [
      location,
      name,
    ]),
    [["path", "linkId"]],
  );
  assert.deepEqual(Object.keys(entry.responses as object).sort(), [
    "200",
    "400",
    "401",
    "403",
    "404",
  ]);

  const projection = document.components.schemas.PartnerLinkProjection;
  const entryProjection = document.components.schemas.PartnerLinkEntryProjection;
  assert.equal(projection?.additionalProperties, false);
  assert.equal(entryProjection?.additionalProperties, false);
  assert.deepEqual(Object.keys(projection?.properties ?? {}).sort(), [
    "description",
    "enabledStatus",
    "id",
    "normalizedHost",
    "normalizedPath",
    "policyVersion",
    "publicationStatus",
    "symbolicDestination",
    "title",
    "version",
  ]);
  assert.ok(entryProjection?.required?.includes("handoffToken"));
  assert.ok(entryProjection?.required?.includes("expiresAt"));
});

test("guardian binding contracts use server-owned scope and versioned review", () => {
  const applicationInput = {
    student_candidate_ref: "00000000-0000-4000-8000-000000000010",
    relationship: "GUARDIAN",
    consent: true,
  } satisfies GuardianBindingApplicationInput;
  const reviewInput = {
    version: 1,
    action: "approve",
  } satisfies GuardianBindingApplicationReviewInput;
  const application = {
    id: "00000000-0000-4000-8000-000000000011",
    student_candidate_ref: applicationInput.student_candidate_ref,
    relationship: applicationInput.relationship,
    status: "PENDING",
    version: 1,
    submitted_at: "2026-10-17T09:00:00.000Z",
    reviewed_at: null,
  } satisfies GuardianBindingApplicationProjection;
  const relationship = {
    id: "00000000-0000-4000-8000-000000000012",
    student_id: applicationInput.student_candidate_ref,
    relationship: "GUARDIAN",
    status: "ACTIVE",
    source_application_id: application.id,
    version: 2,
    approved_at: "2026-10-17T09:05:00.000Z",
  } satisfies GuardianRelationshipProjection;
  const releaseInput = { version: 2 } satisfies GuardianRelationshipReleaseInput;
  assert.equal(application.status, "PENDING");
  assert.equal(reviewInput.version, 1);
  assert.equal(relationship.status, "ACTIVE");
  assert.equal(releaseInput.version, 2);

  type Operation = {
    operationId?: string;
    "x-auth-required"?: boolean;
    "x-scope-required"?: boolean;
    "x-required-capability"?: string;
    parameters?: readonly { $ref?: string }[];
    requestBody?: {
      content?: Record<string, { schema?: { $ref?: string } }>;
    };
    responses?: Record<string, unknown>;
  };
  type Schema = {
    additionalProperties?: boolean;
    enum?: readonly string[];
    required?: readonly string[];
    properties?: Record<string, unknown>;
  };
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<string, Partial<Record<"get" | "post", Operation>>>;
    components: { schemas: Record<string, Schema> };
  };
  const operations = [
    [
      "/guardian-binding/applications",
      "post",
      "createGuardianBindingApplication",
      "binding:apply",
      ["201", "400", "401", "403", "404", "409"],
    ],
    [
      "/guardian-binding/applications",
      "get",
      "listGuardianBindingApplications",
      "binding:read",
      ["200", "400", "401", "403"],
    ],
    [
      "/guardian-relationships",
      "get",
      "listGuardianRelationships",
      "binding:read",
      ["200", "400", "401", "403"],
    ],
    [
      "/guardian-relationships/{relationshipId}/release",
      "post",
      "releaseGuardianRelationship",
      "binding:apply",
      ["200", "400", "401", "403", "404", "409"],
    ],
    [
      "/staff/guardian-binding/applications",
      "get",
      "listStaffGuardianBindingApplications",
      "binding:review",
      ["200", "400", "401", "403"],
    ],
    [
      "/staff/guardian-binding/applications/{applicationId}/review",
      "post",
      "reviewGuardianBindingApplication",
      "binding:review",
      ["200", "400", "401", "403", "404", "409"],
    ],
  ] as const;

  for (const [path, method, operationId, capability, responseCodes] of operations) {
    const operation = document.paths[path]?.[method];
    assert.ok(operation, `${method.toUpperCase()} ${path} must be described`);
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], capability);
    assert.deepEqual(Object.keys(operation.responses ?? {}).sort(), responseCodes);
    assert.deepEqual(
      operation.parameters ?? [],
      path === "/staff/guardian-binding/applications/{applicationId}/review"
        ? [{ $ref: "#/components/parameters/GuardianBindingApplicationId" }]
        : path === "/guardian-relationships/{relationshipId}/release"
          ? [{ $ref: "#/components/parameters/GuardianRelationshipId" }]
          : [],
    );
  }

  assert.equal(
    document.paths["/guardian-binding/applications"]?.post?.requestBody?.content?.[
      "application/json"
    ]?.schema?.$ref,
    "#/components/schemas/GuardianBindingApplicationInput",
  );
  assert.deepEqual(
    document.paths["/staff/guardian-binding/applications/{applicationId}/review"]?.post?.parameters,
    [{ $ref: "#/components/parameters/GuardianBindingApplicationId" }],
  );
  assert.equal(
    document.paths["/staff/guardian-binding/applications/{applicationId}/review"]?.post?.requestBody
      ?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/GuardianBindingApplicationReviewInput",
  );
  assert.deepEqual(
    document.paths["/guardian-relationships/{relationshipId}/release"]?.post?.parameters,
    [{ $ref: "#/components/parameters/GuardianRelationshipId" }],
  );
  assert.equal(
    document.paths["/guardian-relationships/{relationshipId}/release"]?.post?.requestBody
      ?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/GuardianRelationshipReleaseInput",
  );

  const applicationInputSchema = document.components.schemas.GuardianBindingApplicationInput;
  assert.equal(applicationInputSchema?.additionalProperties, false);
  assert.deepEqual(applicationInputSchema?.required, [
    "student_candidate_ref",
    "relationship",
    "consent",
  ]);
  for (const schema of [
    "GuardianBindingApplicationReviewInput",
    "GuardianRelationshipReleaseInput",
    "GuardianBindingApplicationProjection",
    "GuardianBindingApplicationsEnvelope",
    "GuardianBindingApplicationEnvelope",
    "GuardianRelationshipProjection",
    "GuardianRelationshipsEnvelope",
    "GuardianRelationshipEnvelope",
  ]) {
    assert.equal(document.components.schemas[schema]?.additionalProperties, false, schema);
  }
  assert.deepEqual(
    Object.keys(
      document.components.schemas.GuardianBindingApplicationReviewInput?.properties ?? {},
    ).sort(),
    ["action", "version"],
  );
  assert.deepEqual(
    Object.keys(
      document.components.schemas.GuardianRelationshipReleaseInput?.properties ?? {},
    ).sort(),
    ["version"],
  );
  assert.deepEqual(document.components.schemas.GuardianBindingApplicationStatus?.enum, [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "WITHDRAWN",
    "EXPIRED",
  ]);
  assert.deepEqual(document.components.schemas.GuardianRelationshipStatus?.enum, [
    "ACTIVE",
    "RELEASED",
  ]);
  assert.deepEqual(
    document.components.schemas.GuardianRelationshipKind?.enum,
    GUARDIAN_RELATIONSHIPS,
  );
  assert.deepEqual(
    document.components.schemas.GuardianBindingApplicationStatus?.enum,
    GUARDIAN_BINDING_APPLICATION_STATUSES,
  );
  assert.deepEqual(
    document.components.schemas.GuardianRelationshipStatus?.enum,
    GUARDIAN_RELATIONSHIP_STATUSES,
  );
  assert.deepEqual(Object.keys(applicationInputSchema?.properties ?? {}).sort(), [
    "consent",
    "relationship",
    "student_candidate_ref",
  ]);
  assert.deepEqual(
    Object.keys(
      document.components.schemas.GuardianBindingApplicationProjection?.properties ?? {},
    ).sort(),
    [
      "id",
      "relationship",
      "reviewed_at",
      "status",
      "student_candidate_ref",
      "submitted_at",
      "version",
    ],
  );
  assert.deepEqual(
    Object.keys(
      document.components.schemas.GuardianRelationshipProjection?.properties ?? {},
    ).sort(),
    [
      "approved_at",
      "id",
      "relationship",
      "source_application_id",
      "status",
      "student_id",
      "version",
    ],
  );
  for (const schemaName of [
    "GuardianBindingApplicationInput",
    "GuardianBindingApplicationReviewInput",
    "GuardianBindingApplicationProjection",
    "GuardianRelationshipProjection",
  ]) {
    const properties = document.components.schemas[schemaName]?.properties ?? {};
    for (const forbiddenField of [
      "tenant_id",
      "campus_id",
      "actor_id",
      "user_id",
      "guardian_user_id",
      "name",
      "display_name",
      "phone",
      "government_id",
      "notes",
      "reason",
      "free_text",
    ]) {
      assert.equal(
        forbiddenField in properties,
        false,
        `${schemaName} must not expose ${forbiddenField}`,
      );
    }
  }
});

test("OpenAPI describes the trusted staff notice lifecycle and parent receipts", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8")) as {
    paths: Record<
      string,
      Partial<Record<"get" | "post", { operationId?: string; "x-required-capability"?: string }>>
    >;
    components: {
      schemas: Record<
        string,
        {
          enum?: readonly string[];
          required?: readonly string[];
          properties?: Record<string, unknown>;
        }
      >;
    };
  };
  const expected = [
    ["/staff/notices", "post", "createStaffNotice", "notice:create"],
    ["/staff/notices", "get", "listStaffNotices", "notice:create"],
    ["/staff/notices/review", "get", "listStaffNoticesForReview", "notice:review"],
    ["/staff/notices/{noticeId}/submit", "post", "submitStaffNotice", "notice:submit"],
    ["/staff/notices/{noticeId}/review", "post", "reviewStaffNotice", "notice:review"],
    ["/staff/notices/{noticeId}/publish", "post", "publishStaffNotice", "notice:publish"],
    ["/staff/notices/{noticeId}/revoke", "post", "revokeStaffNotice", "notice:revoke"],
    ["/parent/notices", "get", "listParentNotices", "binding:read"],
    ["/parent/notices/{noticeId}/read", "post", "readParentNotice", "binding:read"],
    ["/parent/notices/{noticeId}/ack", "post", "acknowledgeParentNotice", "binding:read"],
  ] as const;

  for (const [path, method, operationId, capability] of expected) {
    const operation = document.paths[path]?.[method];
    assert.ok(operation, `${method.toUpperCase()} ${path} must be described`);
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-required-capability"], capability);
  }
  assert.ok(document.components.schemas.IdentityCapability?.enum?.includes("notice:create"));
  assert.ok(document.components.schemas.IdentityCapability?.enum?.includes("notice:revoke"));
  const staffNotice = document.components.schemas.StaffNoticeDto;
  assert.ok(staffNotice?.required?.includes("title"));
  assert.ok(staffNotice?.required?.includes("body"));
  assert.equal("classRef" in (staffNotice?.properties ?? {}), false);
});

test("OpenAPI institution learning setting uses trusted scope and strict versioned input", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const path = document.paths["/admin/learning-institution-setting"];
  for (const method of ["get", "post"]) {
    const operation = path[method];
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], "learning:institution-setting");
    for (const status of ["200", "400", "401", "403", "409"])
      assert.ok(operation.responses[status]);
  }
  const schemas = document.components.schemas;
  assert.ok(schemas.IdentityCapability.enum.includes("learning:institution-setting"));
  const request = schemas.LearningInstitutionSettingRequest;
  assert.equal(request.additionalProperties, false);
  assert.deepEqual(request.required, ["enabled", "expectedVersion"]);
  assert.deepEqual(Object.keys(request.properties), ["enabled", "expectedVersion"]);
  assert.equal(request.properties.enabled.type, "boolean");
  assert.equal(request.properties.expectedVersion.minimum, 0);
  assert.equal(request.properties.expectedVersion.maximum, 2147483646);
  assert.deepEqual(Object.keys(schemas.LearningInstitutionSetting.properties), [
    "enabled",
    "version",
  ]);
});

test("OpenAPI task lifecycle uses safe views, strict assignment and versioned trusted operations", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const schemas = document.components.schemas;
  assert.equal(schemas.StaffTaskCreateInput.additionalProperties, false);
  assert.deepEqual(schemas.StaffTaskCheckInput.properties.action.enum, ["CONFIRM", "RETURN"]);
  assert.deepEqual(schemas.StaffTaskCompleteInput.properties.result.enum, [
    "COMPLETED_AS_PLANNED",
    "FOLLOW_UP_REQUIRED",
    "BLOCKED",
  ]);
  assert.ok(schemas.InvitedStaffTaskView.required.includes("actions"));
  assert.doesNotMatch(
    JSON.stringify(schemas.InvitedStaffTaskView),
    /tenantId|campusId|classRef|MembershipId|createdBy|assigneeId|synthetic/,
  );
  for (const [path, method] of [
    ["/staff/tasks", "get"],
    ["/staff/tasks/{taskId}/claim", "post"],
    ["/staff/tasks/{taskId}/start", "post"],
    ["/staff/tasks/{taskId}/complete", "post"],
    ["/admin/tasks", "get"],
    ["/admin/tasks", "post"],
    ["/admin/tasks/{taskId}/check", "post"],
    ["/admin/tasks/{taskId}/cancel", "post"],
  ]) {
    const operation = document.paths[path!][method!];
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.ok(operation.responses["401"]);
    assert.ok(operation.responses["403"]);
  }
});

test("OpenAPI describes parent pickup authorization persistence under trusted scope", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const expected = [
    ["/parent/pickup", "get", "listParentPickup", "binding:read"],
    ["/parent/pickup/authorizations", "post", "createParentPickupAuthorization", "binding:apply"],
    [
      "/parent/pickup/authorizations/{authorizationId}/activate",
      "post",
      "activateParentPickupAuthorization",
      "binding:apply",
    ],
    [
      "/parent/pickup/authorizations/{authorizationId}/revoke",
      "post",
      "revokeParentPickupAuthorization",
      "binding:apply",
    ],
  ] as const;

  for (const [path, method, operationId, capability] of expected) {
    const operation = document.paths[path]?.[method];
    assert.ok(operation, `${method.toUpperCase()} ${path} must be described`);
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], capability);
    assert.deepEqual(operation["x-required-capabilities"], ["binding:read", "binding:apply"]);
    for (const status of ["400", "401", "403", "404", "409"])
      assert.ok(operation.responses[status], `${method.toUpperCase()} ${path} needs ${status}`);
  }
});

test("OpenAPI keeps pickup credential issuance and staff verification scoped", () => {
  const document = JSON.parse(readFileSync(openApiDocumentUrl, "utf8"));
  const expected = [
    [
      "/parent/pickup/authorizations/{authorizationId}/credential",
      "issueParentPickupCredential",
      "binding:apply",
      ["binding:read", "binding:apply"],
    ],
    [
      "/staff/pickup/credentials/preview",
      "previewStaffPickupCredential",
      "attendance:write",
      ["attendance:write"],
    ],
    [
      "/staff/pickup/credentials/confirm",
      "confirmStaffPickupCredential",
      "attendance:write",
      ["attendance:write"],
    ],
  ] as const;

  for (const [path, operationId, capability, capabilities] of expected) {
    const operation = document.paths[path]?.post;
    assert.ok(operation, `POST ${path} must be described`);
    assert.equal(operation.operationId, operationId);
    assert.equal(operation["x-auth-required"], true);
    assert.equal(operation["x-scope-required"], true);
    assert.equal(operation["x-required-capability"], capability);
    assert.deepEqual(operation["x-required-capabilities"], capabilities);
    for (const status of ["400", "401", "403", "404", "409"])
      assert.ok(operation.responses[status], `POST ${path} needs ${status}`);
  }
});
