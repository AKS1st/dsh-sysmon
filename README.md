# dsh-sysmon

DSH Web 的系统状态悬浮窗：固定在页面右下角，每 1 秒刷新显示 CPU、内存、磁盘占用率。

```
CPU 39%/16    MEM 46%    DISK 22%
```

## 显示规格

- **位置**：右下角固定悬浮，`pointer-events: none`，不遮挡界面操作。
- **配色**：默认浅灰色小字（等宽字体、11px）。
- **刷新**：1 秒一次。

### 阈值规则

| 指标 | 默认（浅灰） | 橙色 | 红色 |
| ---- | ----------- | ---- | ---- |
| CPU（x%/y） | < 90%×核心数 | x ≥ 90%×核心数 | x ≥ 98%×核心数 |
| 内存 | ≤ 80% | > 80% | > 90% |
| 磁盘 | ≤ 80% | > 80% | > 90% |

- **CPU**：`x%` 为所有核心使用率之和（可超过 100%），`y` 为总核心数；阈值按总容量比例计算。
- **内存 / 磁盘**：超过 80% 橙色、超过 90% 红色。

## 安装

从 GitHub 仓库安装：

```sh
dsh plugin --profile web add github:AKS1st/dsh-sysmon
dsh web
```

或 clone 到本地后从本地目录安装：

```sh
git clone https://github.com/AKS1st/dsh-sysmon.git
cd dsh-sysmon
npm install
npm run build
dsh plugin --profile web add .
dsh web
```

## 工作方式

- **Host**（`src/index.ts`）：`ctx.effect` 挂一个每秒运行的后台采样器，经 `ctx.shell` 采样（`/proc/stat`、`nproc`、`/proc/meminfo`、`df -P /`），把最新快照写入内存缓存。路由 `GET /dsh-sysmon/api` 只返回缓存（亚毫秒、零子进程开销），并拒绝非 GET 方法与跨源浏览器请求。CPU 使用率为相邻两次采样之间的增量（窗口约 1 秒），首次采样显示 0。
- **Client**（`src/client/index.ts`）：创建 `#dsh-sysmon` 固定定位元素，每 1 秒 `fetch` 一次路由，带 in-flight 守卫避免请求重叠；重绘只更新三个数值节点（diff 式）。纯 DOM 实现、零运行时依赖。

## 已知限制

- **仅 Linux**——宿主采集器读取 `/proc/stat`、`/proc/meminfo` 与 `df`；其他平台需要不同的采集器。
- **仅根文件系统**——磁盘占用只报告 `/`，按挂载点选择暂缓。
- **采样窗口近似**——CPU 百分比是相邻两次采样（约 1 秒）间隔内忙时占比，窗口内瞬时突发被平均。
