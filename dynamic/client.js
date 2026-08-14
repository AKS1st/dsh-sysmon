// 动态插件 sysmon-1/pkg-2 的 Client 半函数体（cordis_define 的 code.client 原文）。
// 单行显示：CPU x%/y    MEM z%    DISK w%；1s 轮询；
// CPU x>=90%*核心数 橙色、>=98%*核心数 红色；内存/磁盘 >80% 橙色、>90% 红色。
function SysStats(props) {
  const [stats, setStats] = React.useState(null)
  React.useEffect(() => {
    let alive = true
    const tick = () => {
      host.call('sysinfo').then((data) => {
        if (alive && data !== null) setStats(data)
      }).catch(() => {})
    }
    tick()
    const dispose = props.ctx.interval(tick, 1000)
    return () => {
      alive = false
      dispose()
    }
  }, [])
  const s = stats
  // MEM/DISK: >80% orange, >90% red.
  const warn = (v) => (v > 90 ? 'sysmon-red' : v > 80 ? 'sysmon-orange' : '')
  // CPU: lenient thresholds relative to total capacity — sum of core usages
  // x reaching 90% x cores orange, 98% x cores red (x is already in % units).
  const cpuWarn = (x, cores) => (cores > 0 && x >= cores * 98 ? 'sysmon-red' : cores > 0 && x >= cores * 90 ? 'sysmon-orange' : '')
  return React.createElement('div', { className: 'sysmon-root' },
    React.createElement('span', { className: 'sysmon-group' },
      React.createElement('span', { className: 'sysmon-label' }, 'CPU '),
      React.createElement('span', { className: s ? cpuWarn(s.cpu, s.cores) : '' }, s ? s.cpu + '%/' + s.cores : '--%/--'),
    ),
    React.createElement('span', { className: 'sysmon-group' },
      React.createElement('span', { className: 'sysmon-label' }, 'MEM '),
      React.createElement('span', { className: s ? warn(s.mem) : '' }, s ? s.mem + '%' : '--%'),
    ),
    React.createElement('span', { className: 'sysmon-group' },
      React.createElement('span', { className: 'sysmon-label' }, 'DISK '),
      React.createElement('span', { className: s ? warn(s.disk) : '' }, s ? s.disk + '%' : '--%'),
    ),
  )
}

return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    styles.insert([
      '.sysmon-root{position:fixed;right:14px;bottom:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.65;color:rgba(145,145,145,.78);text-align:right;pointer-events:none;user-select:none;letter-spacing:.02em;white-space:nowrap}',
      '.sysmon-group{margin-left:14px}',
      '.sysmon-group:first-child{margin-left:0}',
      '.sysmon-label{opacity:.75}',
      '.sysmon-orange{color:#e67e22}',
      '.sysmon-red{color:#e74c3c}',
    ].join('\n'))
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'sys-stats', order: 100, label: 'System Stats' },
      () => React.createElement(SysStats, { ctx }),
    ))
  },
}
