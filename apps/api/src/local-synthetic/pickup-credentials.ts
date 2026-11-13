import { createHash, randomBytes, randomUUID } from "node:crypto";

export interface PickupCredentialIssue {
  authorizationId: string;
  authorizationVersion: number;
  guardianId: string;
  studentId: string;
  expiresAt: number;
}

export interface PickupCredentialView {
  credential: string;
  authorizationId: string;
  authorizationVersion: number;
  expiresAt: string;
}

export interface PickupCredentialRecord extends PickupCredentialIssue {
  hash: string;
  used: boolean;
}

export interface PickupVerificationStep {
  id: string;
  version: number;
  actorId: string;
  authorizationId: string;
  authorizationVersion: number;
  guardianId: string;
  studentId: string;
  attendanceId: string;
  attendanceVersion: number;
  credentialHash: string;
  expiresAt: number;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * In-memory only credential and verification-step store for the local demo.
 * Raw credentials are returned exactly once and are never retained or logged.
 */
export class PickupCredentialStore {
  readonly #credentials = new Map<string, PickupCredentialRecord>();
  readonly #steps = new Map<string, PickupVerificationStep>();
  constructor(private readonly now: () => number = Date.now) {}

  issue(input: PickupCredentialIssue): PickupCredentialView {
    for (const authorizationId of this.#credentials.keys())
      if (authorizationId === input.authorizationId) this.#credentials.delete(authorizationId);
    for (const [stepId, step] of this.#steps)
      if (step.authorizationId === input.authorizationId) this.#steps.delete(stepId);
    const credential = randomBytes(32).toString("base64url");
    this.#credentials.set(input.authorizationId, {
      ...input,
      hash: hash(credential),
      used: false,
    });
    return {
      credential,
      authorizationId: input.authorizationId,
      authorizationVersion: input.authorizationVersion,
      expiresAt: new Date(input.expiresAt).toISOString(),
    };
  }

  find(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return undefined;
    const digest = hash(value);
    for (const record of this.#credentials.values()) {
      if (record.hash === digest) {
        if (record.used || record.expiresAt <= this.now()) return undefined;
        return structuredClone(record);
      }
    }
    return undefined;
  }

  createStep(
    credential: PickupCredentialRecord,
    actorId: string,
    attendanceId: string,
    attendanceVersion: number,
  ) {
    const expiresAt = Math.min(credential.expiresAt, this.now() + 2 * 60 * 1000);
    const step: PickupVerificationStep = {
      id: randomUUID(),
      version: 1,
      actorId,
      authorizationId: credential.authorizationId,
      authorizationVersion: credential.authorizationVersion,
      guardianId: credential.guardianId,
      studentId: credential.studentId,
      attendanceId,
      attendanceVersion,
      credentialHash: credential.hash,
      expiresAt,
    };
    this.#steps.set(step.id, structuredClone(step));
    return structuredClone(step);
  }

  getStep(id: string) {
    const step = this.#steps.get(id);
    if (!step || step.expiresAt <= this.now()) return undefined;
    return structuredClone(step);
  }

  credentialForStep(step: PickupVerificationStep) {
    for (const record of this.#credentials.values())
      if (record.hash === step.credentialHash && !record.used && record.expiresAt > this.now())
        return structuredClone(record);
    return undefined;
  }

  reserve(stepId: string) {
    const step = this.#steps.get(stepId);
    if (!step) return false;
    const record = [...this.#credentials.values()].find(
      (item) => item.hash === step.credentialHash,
    );
    if (!record || record.used || record.expiresAt <= this.now()) return false;
    record.used = true;
    return true;
  }

  release(stepId: string) {
    const step = this.#steps.get(stepId);
    if (!step) return;
    const record = [...this.#credentials.values()].find(
      (item) => item.hash === step.credentialHash,
    );
    if (record) record.used = false;
  }

  finalize(stepId: string) {
    return this.#steps.delete(stepId);
  }

  revokeAuthorization(authorizationId: string) {
    this.#credentials.delete(authorizationId);
    for (const [stepId, step] of this.#steps)
      if (step.authorizationId === authorizationId) this.#steps.delete(stepId);
  }

  clear() {
    this.#credentials.clear();
    this.#steps.clear();
  }
}
