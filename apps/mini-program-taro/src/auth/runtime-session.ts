import Taro from "@tarojs/taro";
import { InviteSession } from "./invite-session";

const SESSION_STORAGE_KEY = "tongxin.invited-session.v1";

export const inviteSession = new InviteSession({
  baseUrl: __TARO_API_BASE_URL__,
  allowLocalHttp: __TARO_ALLOW_LOCAL_HTTP__,
  request: async (url, options) => {
    const response = await Taro.request({
      url,
      method: options.method,
      header: { ...options.headers },
      ...(options.data === undefined ? {} : { data: options.data }),
      timeout: 8000,
    });
    return { statusCode: response.statusCode, data: response.data };
  },
  sessionStore: {
    load: () => Taro.getStorageSync(SESSION_STORAGE_KEY),
    save: (session) => Taro.setStorageSync(SESSION_STORAGE_KEY, session),
    clear: () => Taro.removeStorageSync(SESSION_STORAGE_KEY),
  },
});
