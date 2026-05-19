import { defineConfig } from "tsdown";

/**
 * 双 entry build:
 *  - index.ts · 公开 SDK client API · 出 index.mjs + index.d.mts
 *  - server.ts · in-process gateway runtime · 出 server.mjs + server.d.mts
 *
 * server 的 .d.mts 由本配置 dts:false 跳过 — server.impl 的类型链
 * 拉到 @google/genai → @types/node-fetch dts bundling 会爆 unresolved imports
 * (101 errors)。server.ts 内手写 stub 类型已足够 consumer 调用。
 */
export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: "esm",
    platform: "node",
    dts: true,
    clean: true,
    outDir: "dist",
  },
  {
    entry: ["src/server.ts"],
    format: "esm",
    platform: "node",
    dts: false,
    clean: false,
    outDir: "dist",
  },
]);
