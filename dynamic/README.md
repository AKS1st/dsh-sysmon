/**
 * 当前正在运行的动态插件 `sysmon-1/pkg-2` 的逐字函数体归档。
 *
 * 这两个文件是 cordis_define 收到的 `code.host` / `code.client` 原文
 * （纯 JavaScript，无 import/JSX），可直接原样贴回 cordis_define 重新加载。
 * 它们与本仓库 `src/` 下规范包源码在功能上等价：
 *
 * - 传输层不同：动态形态用 `harness.handle` / `host.call` 包私有 RPC；
 *   `src/` 包形态用 `ctx.webServer` HTTP 路由 + 浏览器 fetch（可安装挂载）。
 * - 采样架构不同：动态形态每次请求实时采样；`src/` 包形态已按代码审查修复为
 *   Host 后台采样器 + 内存缓存（路由零子进程开销）并加了 GET/同源校验。
 * - 采集与解析逻辑、显示规格、阈值规则一致（见 `src/collect.ts`）。
 *
 * 动态形态是进程内的临时插件；要获得可安装、可随 dsh web 重启恢复的形态，
 * 使用本仓库 `src/` 的包源码（`npm run build` 后 `dsh plugin --profile web add .`）。
 */
