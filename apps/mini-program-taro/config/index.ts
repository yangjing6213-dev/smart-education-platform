const environment =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const config = {
  projectName: "student-care-mini-taro",
  date: "2026-10-20",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot: environment.TARO_APP_OUTPUT_ROOT ?? "dist",
  framework: "react",
  compiler: "webpack5",
  defineConstants: {
    __TARO_API_BASE_URL__: JSON.stringify(environment.TARO_APP_API_BASE_URL ?? ""),
    __TARO_PUBLIC_REFERENCE__: JSON.stringify(environment.TARO_APP_PUBLIC_REFERENCE ?? ""),
    __TARO_ALLOW_LOCAL_HTTP__: JSON.stringify(environment.TARO_APP_ALLOW_LOCAL_HTTP === "true"),
  },
  cache: {
    enable: false,
  },
  mini: {
    postcss: {
      autoprefixer: {
        enable: true,
      },
      pxtransform: {
        enable: true,
      },
    },
  },
  h5: {},
};

export default config;
