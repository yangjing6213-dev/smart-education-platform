export interface StorageScope {
  readonly tenantId: string;
  readonly campusId: string;
}

export interface StorageObjectInput {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly checksum: string;
}

export interface StoredObject {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly checksum: string;
}

export type StorageScanResult = "APPROVED" | "REJECTED";

export interface CosStoragePort {
  put(scope: StorageScope, fileId: string, object: StorageObjectInput): StorageScanResult;
  read(scope: StorageScope, fileId: string): StoredObject | undefined;
}

export interface InMemoryCosStorageOptions {
  readonly scan?: (object: StorageObjectInput) => StorageScanResult;
}

function storageKey(scope: StorageScope, fileId: string): string {
  return JSON.stringify([scope.tenantId, scope.campusId, fileId]);
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function cloneObject(object: StorageObjectInput | StoredObject): StoredObject {
  return {
    bytes: cloneBytes(object.bytes),
    mimeType: object.mimeType,
    checksum: object.checksum,
  };
}

/** Deterministic provider fake; provider URLs, keys, and credentials stay private. */
export class InMemoryCosStorage implements CosStoragePort {
  private readonly objects = new Map<string, StoredObject>();
  private readonly scan: (object: StorageObjectInput) => StorageScanResult;

  public constructor(options: InMemoryCosStorageOptions = {}) {
    this.scan = options.scan ?? (() => "APPROVED");
  }

  public put(scope: StorageScope, fileId: string, object: StorageObjectInput): StorageScanResult {
    const isolatedObject = cloneObject(object);
    const scanResult = this.scan(isolatedObject);
    if (scanResult === "APPROVED") {
      this.objects.set(storageKey(scope, fileId), isolatedObject);
    }
    return scanResult;
  }

  public read(scope: StorageScope, fileId: string): StoredObject | undefined {
    const object = this.objects.get(storageKey(scope, fileId));
    return object === undefined ? undefined : cloneObject(object);
  }
}
