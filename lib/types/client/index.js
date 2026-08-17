/**
 * System Monitor browser half: a fixed bottom-right overlay that polls the
 * host route once per second and repaints one monospace line:
 *
 *     CPU 39%/16    MEM 46%    DISK 22%
 *
 * Default color is a quiet light gray; memory/disk above 80% turn orange and
 * above 90% red, CPU follows the lenient total-capacity scale (>=90% of all
 * cores orange, >=98% red). The overlay is click-through and never blocks the
 * app underneath; repaints update only the three value nodes.
 * @module dsh-sysmon/client
 */
import { SYSINFO_ROUTE, cpuWarnLevel, warnLevel } from "../protocol.js";
export const inject = [];
const CSS = `
#dsh-sysmon{position:fixed;right:14px;bottom:12px;z-index:100000;font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:rgba(145,145,145,.78);text-align:right;white-space:nowrap;pointer-events:none;user-select:none;letter-spacing:.02em}
#dsh-sysmon .sm-group{margin-left:14px}
#dsh-sysmon .sm-group:first-child{margin-left:0}
#dsh-sysmon .sm-label{opacity:.75}
#dsh-sysmon .sm-warn{color:#e67e22}
#dsh-sysmon .sm-critical{color:#e74c3c}
`;
const LEVEL_CLASS = { normal: '', warn: 'sm-warn', critical: 'sm-critical' };
function span(className, ...children) {
    const el = document.createElement('span');
    if (className !== '')
        el.className = className;
    for (const child of children)
        el.append(child);
    return el;
}
export function apply(ctx) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    const root = document.createElement('div');
    root.id = 'dsh-sysmon';
    const cpuValue = span('', '--%/--');
    const memValue = span('', '--%');
    const diskValue = span('', '--%');
    root.append(span('sm-group', span('sm-label', 'CPU '), cpuValue), span('sm-group', span('sm-label', 'MEM '), memValue), span('sm-group', span('sm-label', 'DISK '), diskValue));
    document.body.append(root);
    /** Diff-style repaint: only the three value nodes change. */
    const render = (info) => {
        cpuValue.textContent = info === null ? '--%/--' : `${info.cpu}%/${info.cores}`;
        memValue.textContent = info === null ? '--%' : `${info.mem}%`;
        diskValue.textContent = info === null ? '--%' : `${info.disk}%`;
        const cpuLevel = info === null ? 'normal' : cpuWarnLevel(info.cpu, info.cores);
        const memLevel = info === null ? 'normal' : warnLevel(info.mem);
        const diskLevel = info === null ? 'normal' : warnLevel(info.disk);
        cpuValue.className = LEVEL_CLASS[cpuLevel];
        memValue.className = LEVEL_CLASS[memLevel];
        diskValue.className = LEVEL_CLASS[diskLevel];
    };
    render(null);
    let disposed = false;
    let inflight = false;
    const tick = async () => {
        if (disposed || inflight)
            return;
        inflight = true;
        try {
            const response = await fetch(SYSINFO_ROUTE, { cache: 'no-store' });
            const body = await response.json();
            if (!disposed && body.ok)
                render(body.info);
        }
        catch {
            // A transient route error keeps the last sample on screen.
        }
        finally {
            inflight = false;
        }
    };
    void tick();
    const timer = window.setInterval(() => { void tick(); }, 1000);
    ctx.effect(() => () => {
        disposed = true;
        window.clearInterval(timer);
        root.remove();
        style.remove();
    }, 'sysmon: bottom-right status overlay');
}
