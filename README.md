# dsh-sysmon

DSH Web 的系统状态悬浮窗：固定在页面右下角，每 1 秒刷新显示 CPU、内存、磁盘占用率。

```
CPU 39%/16    MEM 46%    DISK 22%
```

## 显示规格

- **位置**：右下角固定悬浮，`pointer-events: none`，完全不遮挡界面操作。
- **配色**：默认浅灰色小字（等宽字体、11px），低调不醒目。
- **刷新**：1 秒一次。

### 阈值规则

| 指标 | 默认（浅灰） | 橙色 | 红色 |
| ---- | ----------- | ---- | ---- |
| CPU（x%/y） | < 90%×核心数 | x ≥ 90%×核心数 | x ≥ 98%×核心数 |
| 内存 | ≤ 80% | > 80% | > 90% |
| 磁盘 | ≤ 80% | > 80% | > 90% |

- **CPU**：`x%` 为所有核心使用率之和（可超过 100%），`y` 为总核心数。阈值按
  总容量比例计算（16 核时 ≥ 1440% 变橙、≥ 1568% 变红），因为 CPU 瞬时占用高
  是正常的，只在接近满载时才警示。
- **内存 / 磁盘**：超过 80% 橙色、超过 90% 红色。

## 安装

从 GitHub 仓库安装：

```sh
dsh plugin --profile web add github:AKS1st/dsh-sysmon
dsh web
```

或者 clone 到本地后从本地目录安装：

```sh
git clone https://github.com/AKS1st/dsh-sysmon.git
cd dsh-sysmon
npm install
npm run build
dsh plugin --profile web add .
dsh web
```

## 架构

```
浏览器端 (src/client)                 Host 端 (src/index.ts)
┌──────────────────────┐             ┌──────────────────────────┐
│ #dsh-sysmon 悬浮窗     │   fetch     │ 后台采样器 setInterval 1s  │
│ setInterval 1s ───────┼────────────►│ ctx.shell 采样 → 内存缓存   │
│ in-flight 守卫          │   JSON      │ GET /dsh-sysmon/api       │
│ diff 式重绘             │   (缓存)    │ 仅返回缓存 · GET/同源校验   │
└──────────────────────┘             └──────────────────────────┘
```

- **Host**（`src/index.ts`）：`ctx.effect` 挂一个每秒运行的后台采样器，经
  `ctx.shell` 执行一次采样命令（`/proc/stat` cpu 行、`nproc`、`/proc/meminfo`、
  `df -P /`），把最新快照写入内存缓存。路由 `GET /dsh-sysmon/api` 只返回缓存
  （亚毫秒、零子进程开销），并拒绝非 GET 方法与跨源浏览器请求，因此请求洪泛
  无法放大采样、恶意页面无法读取宿主遥测。CPU 使用率为相邻两次采样之间的增量
  （窗口约 1 秒），首次采样显示 0。
- **Client**（`src/client/index.ts`）：创建 `#dsh-sysmon` 固定定位元素，每 1 秒
  `fetch` 一次路由，带 in-flight 守卫避免请求重叠；重绘只更新三个数值节点
  （diff 式）。纯 DOM 实现、零运行时依赖。

## 目录结构

```
dsh-sysmon/
├── package.json          # @dsh-external/dsh-sysmon 清单（dsh.client / dsh.bundle）
├── tsconfig.json         # 独立 TS 配置（NodeNext + DOM，输出 lib/types）
├── tsdown.config.mjs     # Host 端 ESM 打包 + Client 端 __ModuleLoader__ 打包
├── cordis.patch.yml      # 组合包挂载补丁（dsh plugin add 后插入 sysmon 行）
├── src/
│   ├── index.ts          # Host 半：webServer 路由 + 采样
│   ├── collect.ts        # 采样命令与输出解析（纯函数，可测）
│   ├── protocol.ts       # 共享类型、路由常量、阈值规则（纯函数，可测）
│   ├── client/index.ts   # 浏览器半：右下角悬浮窗
│   └── invariant.ts      # 无配套运行时不变式
├── dynamic/              # 当前动态插件 sysmon-1/pkg-2 的逐字函数体归档
└── tests/                # vitest 单元测试（解析与阈值）
```

## 开发

```sh
npm run check    # tsc --noEmit 类型检查
npm run test     # vitest 单元测试
npm run build    # tsc 产出 lib/types + tsdown 产出 lib/index.js 与 lib/client.js
```

## 与动态插件的对应关系

本插件最初以 DSH 动态插件（cordis 插件工具定义，进程内临时）形态运行，见
[`dynamic/`](./dynamic/README.md) 中的逐字函数体归档。本仓库 `src/` 是其规范
包形态：采集/解析/显示逻辑一致，但传输与采样架构不同——动态形态用包私有 RPC
（`harness.handle` / `host.call`）且每次请求实时采样；包形态用 `ctx.webServer`
HTTP 路由 + 浏览器 `fetch`、Host 后台采样器 + 缓存，并已按代码审查修复安全与
性能问题，因此可以 `dsh plugin` 安装、随 web 重启恢复。

## Model Experience

None, as this package renders a system-status overlay and never contributes to model requests.

#### KV Cache effect

Independent — the overlay never touches model request tokens, so it cannot invalidate prefix reuse.

## Known Limitations and Deferred Work

- **Linux-only collection** — the host collector reads `/proc/stat`, `/proc/meminfo`, and `df`; other platforms need a different collector.
- **Root filesystem only** — disk usage is reported for `/`; per-mount selection is deferred.
- **Sample-window approximation** — the CPU percentage is the busy share of the roughly one-second gap between consecutive sampler passes; short bursts inside that window are averaged.
- **Steal counts as busy** — the `cpu` line's steal ticks are included in busy time (a virtualized tenant's CPU is not idle), while guest/guest_nice are excluded because they are already folded into user/nice.
