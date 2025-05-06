import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // 在生产环境中禁止日志输出
  compiler: {
    // 移除console.log语句
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"], // 保留console.error和console.warn
          }
        : false,
  },
};

export default nextConfig;
