// 动态插件 sysmon-1/pkg-2 的 Host 半函数体（cordis_define 的 code.host 原文）。
// 采集：/proc/stat 两次采样计算 CPU 增量、nproc、/proc/meminfo、df -P /，
// 经 harness.handle('sysinfo') 暴露给客户端，客户端每 1s 拉取一次。
return {
  apply(ctx) {
    const shell = ctx.get('shell')
    if (shell === undefined) return
    // One-shot sample: two /proc/stat readings 150ms apart, core count,
    // memory totals (kB) and root-filesystem block counts.
    const command = [
      "s1=$(awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;i=$5;print t\" \"i}' /proc/stat)",
      'sleep 0.15',
      "s2=$(awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;i=$5;print t\" \"i}' /proc/stat)",
      'cores=$(nproc)',
      "mem=$(awk '/^MemTotal/{T=$2}/^MemAvailable/{A=$2}END{print T\" \"A}' /proc/meminfo)",
      "disk=$(df -P / | awk 'NR==2{print $2\" \"$3}')",
      "printf '%s\\n%s\\n%s\\n%s\\n%s' \"$s1\" \"$s2\" \"$cores\" \"$mem\" \"$disk\"",
    ].join('; ')
    ctx.effect(() => harness.handle('sysinfo', async () => {
      try {
        const spec = shell.resolve({ command, timeoutMs: 3000, stdoutMaxBytes: 4096 })
        const result = await shell.run(spec)
        if (result.exitCode !== 0) return null
        const lines = result.stdout.text.trim().split('\n')
        if (lines.length < 5) return null
        const first = lines[0].split(' ')
        const second = lines[1].split(' ')
        const t1 = Number(first[0]); const i1 = Number(first[1])
        const t2 = Number(second[0]); const i2 = Number(second[1])
        const cores = Number(lines[2]) || 1
        const memParts = lines[3].split(' ')
        const memTotal = Number(memParts[0]); const memAvail = Number(memParts[1])
        const diskParts = lines[4].split(' ')
        const diskTotal = Number(diskParts[0]); const diskUsed = Number(diskParts[1])
        const dt = t2 - t1
        // Sum of all core usages: fraction busy across the whole delta,
        // scaled by the number of cores (0..cores*100).
        const cpu = dt > 0 ? Math.max(0, Math.round(((dt - (i2 - i1)) / dt) * cores * 100)) : 0
        const mem = memTotal > 0 ? Math.round(((memTotal - memAvail) / memTotal) * 100) : 0
        const disk = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0
        return { cpu, cores, mem, disk }
      } catch (error) {
        console.error('sysinfo failed:', error)
        return null
      }
    }))
  },
}
