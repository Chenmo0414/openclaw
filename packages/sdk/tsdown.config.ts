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
    // 强制 server entry single bundle · 消除 cross-chunk import 在 packaged
    // Electron 33 + asar 协议下的 ESM cycle bug(server.impl 的 var 在被 consumer
    // chunk live binding access 时是 undefined,触发 `__commonJSMin / require_lib
    // is not a function`)。详 docs/CLIENT-UI-ARCHITECTURE / lighthouse-assistant
    // utilityProcess.fork 验证记录。
    //
    // 副作用:server.mjs 体积合并(从分散 ~120 个 chunks 合到 1 个 ~37 MB 文件)
    outputOptions: {
      inlineDynamicImports: true,
    },
    // tsdown 默认把 SDK 自家 node_modules 的 npm 包当 external · prod 包没那些
    // 依赖装在 node_modules → 运行时 `Cannot find module 'undici' / 'better-sqlite3' / ...`
    // alwaysBundle 强制把所有 SDK 依赖(node:* 内置除外)inline 进 server.mjs
    noExternal: [/^(?!node:).*/],
  },
  // facade-activation-check.runtime · plugin-sdk 在 runtime 用 createRequire(import.meta.url)
  // 加载 `./facade-activation-check.runtime.js` 兄弟文件,不被 server.mjs single-bundle
  // 自动包含。必须单独 build 一个 sibling .js 文件到 dist/,createRequire 才能解析。
  // 用 .js 后缀(非 .mjs)是因为源码 candidate list 写死了 [.js, .ts]。
  {
    entry: { "facade-activation-check.runtime": "../../src/plugin-sdk/facade-activation-check.runtime.ts" },
    format: "cjs",
    platform: "node",
    dts: false,
    clean: false,
    outDir: "dist",
    outExtensions: () => ({ js: ".js" }),
    outputOptions: {
      inlineDynamicImports: true,
    },
    noExternal: [/^(?!node:).*/],
  },
]);
