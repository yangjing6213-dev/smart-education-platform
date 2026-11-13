/// <reference types="@tarojs/taro" />

declare module "*.css";

declare module "*.jpg" {
  const assetPath: string;
  export default assetPath;
}

declare const __TARO_API_BASE_URL__: string;
declare const __TARO_PUBLIC_REFERENCE__: string;
declare const __TARO_ALLOW_LOCAL_HTTP__: boolean;
