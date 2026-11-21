export interface LibraryContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly capabilities: readonly string[];
}

export type LibraryKind = "RESOURCE" | "GUIDE";

interface LibraryVisibility {
  readonly scope: "CAMPUS" | "CLASS";
  readonly classId: string | null;
  readonly expiresOn: string;
}

export interface LibraryCreate extends LibraryVisibility {
  readonly kind: LibraryKind;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly category: string;
  readonly grade: string;
  readonly subject: string;
  readonly tags: string[];
}

export interface LibraryUpdate extends LibraryVisibility {
  readonly version: number;
}

export interface StaffLibraryOperations {
  list(context: LibraryContext, kind: LibraryKind): Promise<unknown>;
  detail(context: LibraryContext, kind: LibraryKind, id: string): Promise<unknown>;
  favorite(
    context: LibraryContext,
    id: string,
    version: number,
    favorite: boolean,
  ): Promise<unknown>;
  use(context: LibraryContext, id: string, version: number): Promise<unknown>;
  managed(context: LibraryContext): Promise<unknown>;
  create(context: LibraryContext, input: LibraryCreate): Promise<unknown>;
  update(context: LibraryContext, id: string, input: LibraryUpdate): Promise<unknown>;
  revoke(context: LibraryContext, id: string, version: number): Promise<unknown>;
  summary(context: LibraryContext): Promise<unknown>;
}

export class LibraryError extends Error {
  public constructor(
    public readonly status: 400 | 403 | 404 | 409,
    public readonly code: string,
  ) {
    super(code);
  }
}
