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

从 git 仓库安装：

```sh
git clone <repo-url>
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
│ #dsh-sysmon 悬浮窗     │   fetch     │ GET /dsh-sysmon/api      │
│ setInterval 1s ───────┼────────────►│ execFile bash 采集        │
│ 阈值配色渲染            │   JSON      │ parseSysInfoOutput 解析   │
└──────────────────────┘             └──────────────────────────┘
```

- **Host**（`src/index.ts`）：通过 `ctx.webServer` 注册 `GET /dsh-sysmon/api`，
  用 `/bin/bash` 执行一次采样命令（`/proc/stat` 两次读数间隔 150ms 算 CPU 增量、
  `nproc`、`/proc/meminfo`、`df -P /`），解析后返回 JSON。
- **Client**（`src/client/index.ts`）：创建 `#dsh-sysmon` 固定定位元素，
  每 1 秒 `fetch` 一次路由并重绘，纯 DOM 实现、零运行时依赖。

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
包形态：采集/解析/显示逻辑完全一致，仅传输层不同——动态形态用包私有 RPC
（`harness.handle` / `host.call`），包形态用 `ctx.webServer` HTTP 路由 +
浏览器 `fetch`，因此可以 `dsh plugin` 安装、随 web 重启恢复。

## Model Experience

None, as this package renders a system-status overlay and never contributes to model requests.

#### KV Cache effect

Independent — the overlay never touches model request tokens, so it cannot invalidate prefix reuse.

## Known Limitations and Deferred Work

- **Linux-only collection** — the host collector reads `/proc/stat`, `/proc/meminfo`, and `df`; other platforms need a different collector.
- **Root filesystem only** — disk usage is reported for `/`; per-mount selection is deferred.
- **Process-local sample window** — the CPU percentage averages the 150ms sampling gap inside each request, not the full 1s poll interval.
