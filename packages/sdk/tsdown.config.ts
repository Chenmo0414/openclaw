import { defineConfig } from "tsdown";

/**
 * 灯塔 fork build(rebased onto v2026.5.28)· 三 entry:
 *  - index.ts · 公开 SDK client API · 出 index.mjs + index.d.mts
 *  - server.ts · in-process gateway runtime · 出 server.mjs(single bundle)
 *  - facade-activation-check.runtime · plugin-sdk createRequire 的兄弟 CJS 文件
 *
 * 注:5.28 起 upstream 的 SDK build 改成内联 `tsdown src/index.ts --no-config`(单 entry、
 * 无 config 文件)。本文件恢复 config 模式以承载灯塔需要的 server / facade 两个额外 entry。
 *
 * server 的 .d.mts 由本配置 dts:false 跳过 — server.impl 的类型链拉到 @google/genai →
 * @types/node-fetch dts bundling 会爆 unresolved imports。server.ts 内手写 stub 类型已足够。
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
    // 强制 server entry single bundle · 消除 cross-chunk import 在 packaged Electron + asar
    // 协议下的 ESM cycle bug(server.impl 的 var 被 consumer chunk live binding access 时
    // 是 undefined,触发 `__commonJSMin / require_lib is not a function`)。
    // 副作用:server.mjs 体积合并(~120 chunks → 1 个 ~37 MB 文件)。
    // 注:此 single-bundle 为 Electron 33 时期引入;Electron ≥35(我们现在 35)asar ESM
    // resolver 已修,后续可评估回退 multi-chunk lazy 以瘦身,本次保守保留。
    outputOptions: {
      inlineDynamicImports: true,
    },
    // tsdown 默认把 SDK 自家 node_modules 的 npm 包当 external · prod 包没那些依赖装在
    // node_modules → 运行时 `Cannot find module 'undici' / 'better-sqlite3' / ...`。
    // 强制把所有 SDK 依赖(node:* 内置除外)inline 进 server.mjs。
    noExternal: [/^(?!node:).*/],
  },
  // facade-activation-check.runtime · plugin-sdk 在 runtime 用 createRequire(import.meta.url)
  // 加载 `./facade-activation-check.runtime.js` 兄弟文件,不被 server.mjs single-bundle
  // 自动包含。必须单独 build 一个 sibling .js 文件到 dist/,createRequire 才能解析。
  // 用 .js 后缀(非 .mjs)是因为源码 candidate list 写死了 [.js, .ts];format:cjs 配合
  // lighthouse-assistant 侧 patch-sdk-dist.mjs 写 dist/package.json {type:commonjs}。
  {
    entry: {
      "facade-activation-check.runtime": "../../src/plugin-sdk/facade-activation-check.runtime.ts",
    },
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
