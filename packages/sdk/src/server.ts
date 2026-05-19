/**
 * @openclaw/sdk/server · 程序化启动 gateway server(in-process consumer 用)
 *
 * 灯塔助理(下游 Electron consumer)需要把 gateway 跑在 Electron main 进程内
 * 而不是 spawn `pnpm openclaw gateway run` 子进程 — 这样财务员工电脑无需 Node CLI。
 *
 * 用法:
 *   import { startGatewayServer } from "@openclaw/sdk/server";
 *   const server = await startGatewayServer(19789, { bind: "loopback" });
 *   // ... 后续走 GatewayClientTransport 连本机 ws://127.0.0.1:19789
 *   await server.stop?.();
 *
 * 类型说明:server.impl 的完整 GatewayServerOptions 通过类型链拉到 @google/genai
 *           会爆 dts bundling unresolved import,所以这里只暴露最小子集 stub。
 *           Consumer 想用高级选项可用 `Record<string, unknown> & GatewayServerOptionsBase`
 *           透传,运行时由 fork 内部 server.impl 校验。
 */

export type GatewayBindMode = "loopback" | "lan" | "auto" | "custom" | "tailnet";

export interface GatewayServerOptionsBase {
  /** 监听地址模式 · 默认 loopback(127.0.0.1) */
  bind?: GatewayBindMode;
  /** bind=custom 时的 host(否则忽略) */
  host?: string;
  /** 关掉 Control UI HTTP serve(in-process consumer 自己 serve UI 时用) */
  controlUiEnabled?: boolean;
  /** 其他字段透传给 fork 内部 · 不在此 SDK 维护 */
  [key: string]: unknown;
}

export interface GatewayServer {
  /** 实际监听端口(可能跟传入 port 不同,例如 0 = 随机) */
  port?: number;
  /** ws://host:port */
  url?: string;
  /** 优雅停 gateway,resolved 后所有连接已断、native 资源已释放 */
  stop?: () => Promise<void>;
  /** server.impl 还有其他字段 · 不在 SDK 公开维护 */
  [key: string]: unknown;
}

/**
 * 启动 gateway server。第一次调用时 dynamic import server.impl(冷启动 ~500ms)。
 *
 * 运行前应在 process.env 注入:
 *   - OPENCLAW_HOME      · profile 数据目录
 *   - OPENCLAW_PROFILE   · profile 名(灯塔约定 "lighthouse")
 */
export async function startGatewayServer(
  port: number,
  opts?: GatewayServerOptionsBase,
): Promise<GatewayServer> {
  // 通过 dynamic import 让 rolldown 静态发现 + 把 server.impl bundle 进 dist。
  // ts-expect-error:消费者(下游 client-ui)tsc 上下文里这条相对路径无效,
  // 但运行时 rolldown 已 inline server.impl-*.mjs 到同目录,实际 import 工作。
  // @ts-expect-error consumer ctx 路径不可解析,运行时由 rolldown 重写
  const mod = await import("../../../src/gateway/server.js");
  return (await mod.startGatewayServer(port, opts as never)) as unknown as GatewayServer;
}
