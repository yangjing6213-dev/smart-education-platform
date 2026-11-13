export interface LearningInstitutionSetting {
  readonly enabled: boolean;
  readonly version: number;
}

export interface LearningInstitutionSettingSnapshot {
  readonly status:
    "IDLE" | "CONNECTING" | "READY" | "BUSY" | "UNAUTHENTICATED" | "DENIED" | "ERROR" | "CONFLICT";
  readonly message: string;
  readonly setting: LearningInstitutionSetting | null;
}

const idle = (): LearningInstitutionSettingSnapshot => ({
  status: "IDLE",
  message: "准备读取本校区学习设置。",
  setting: null,
});
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function parseSetting(payload: unknown): LearningInstitutionSetting {
  const value = isObject(payload) ? payload.data : undefined;
  if (
    !isObject(value) ||
    Object.keys(value).length !== 2 ||
    typeof value.enabled !== "boolean" ||
    !Number.isInteger(value.version) ||
    Number(value.version) < 0 ||
    Number(value.version) > 2147483647 ||
    (value.version === 0 && value.enabled)
  )
    throw new Error("设置返回结果无效，请重新读取。");
  return { enabled: value.enabled, version: Number(value.version) };
}
class SettingRequestFailure extends Error {
  readonly status: LearningInstitutionSettingSnapshot["status"];
  constructor(status: LearningInstitutionSettingSnapshot["status"], message: string) {
    super(message);
    this.status = status;
  }
}

export class LearningInstitutionSettingAdminClient {
  readonly #fetcher: typeof fetch;
  #snapshot = idle();
  #generation = 0;

  constructor(fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.#fetcher = fetcher;
  }
  get snapshot(): LearningInstitutionSettingSnapshot {
    return this.#snapshot;
  }

  async connect(): Promise<void> {
    if (this.#snapshot.status === "BUSY") return;
    const generation = ++this.#generation;
    this.#snapshot = { ...idle(), status: "CONNECTING", message: "正在读取本校区学习设置…" };
    try {
      const setting = await this.#request();
      if (generation !== this.#generation) return;
      this.#snapshot = {
        status: "READY",
        message: setting.enabled ? "本校区已保存开启设置。" : "本校区已保存关闭设置。",
        setting,
      };
    } catch (error) {
      if (generation === this.#generation) this.#failed(error, null);
    }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const current = this.#snapshot.setting;
    if (!current || this.#snapshot.status !== "READY" || typeof enabled !== "boolean") return;
    const generation = this.#generation;
    this.#snapshot = { ...this.#snapshot, status: "BUSY", message: "正在保存本校区学习设置…" };
    try {
      const setting = await this.#request({ enabled, expectedVersion: current.version });
      if (generation !== this.#generation) return;
      if (setting.enabled !== enabled || setting.version !== current.version + 1)
        throw new Error("保存结果未确认，请重新读取。");
      this.#snapshot = {
        status: "READY",
        message: setting.enabled ? "本校区已保存开启设置。" : "本校区已保存关闭设置。",
        setting,
      };
    } catch (error) {
      if (generation === this.#generation) this.#failed(error, current);
    }
  }

  disconnect(): void {
    this.#generation++;
    this.#snapshot = idle();
  }

  #failed(error: unknown, previous: LearningInstitutionSetting | null) {
    const status = error instanceof SettingRequestFailure ? error.status : "ERROR";
    this.#snapshot = {
      status,
      message:
        error instanceof SettingRequestFailure
          ? error.message
          : "请求结果未确认，请重新读取后再操作。",
      setting: status === "UNAUTHENTICATED" || status === "DENIED" ? null : previous,
    };
  }

  async #request(body?: {
    enabled: boolean;
    expectedVersion: number;
  }): Promise<LearningInstitutionSetting> {
    const response = await this.#fetcher("/api/admin/learning-institution-setting", {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      if (response.status === 401)
        throw new SettingRequestFailure("UNAUTHENTICATED", "请先使用机构账号登录。");
      if (response.status === 403)
        throw new SettingRequestFailure("DENIED", "当前账号没有管理本校区学习设置的权限。");
      if (response.status === 409)
        throw new SettingRequestFailure("CONFLICT", "设置已被其他操作更新，请重新读取后再操作。");
      throw new SettingRequestFailure("ERROR", "服务暂时不可用，请重新读取后再操作。");
    }
    return parseSetting(await response.json());
  }
}
