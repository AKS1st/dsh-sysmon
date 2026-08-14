/**
 * System Monitor host half: registers one `GET` route that samples the system
 * once per request. The browser overlay polls it every second. The route
 * carries no session state, so any origin request gets the same fresh sample.
 * @module @dsh-external/dsh-sysmon
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { COLLECT_COMMAND, parseSysInfoOutput } from "./collect.js";
import { SYSINFO_ROUTE } from "./protocol.js";
const execFileAsync = promisify(execFile);
export const inject = ['webServer'];
/** Write one JSON envelope with a no-store policy. */
function json(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(body));
}
export function apply(ctx) {
    ctx.effect(() => {
        const disposeRoute = ctx.webServer.register({
            kind: 'exact',
            path: SYSINFO_ROUTE,
            handler: async (_req, res) => {
                try {
                    const { stdout } = await execFileAsync('/bin/bash', ['-lc', COLLECT_COMMAND], { timeout: 5000, maxBuffer: 64 * 1024 });
                    const info = parseSysInfoOutput(stdout);
                    if (info === null)
                        return json(res, 500, { ok: false, error: 'unable to parse system stats' });
                    return json(res, 200, { ok: true, info });
                }
                catch (error) {
                    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
                }
            },
        });
        return () => {
            disposeRoute();
        };
    }, 'sysmon: system-status API');
}
export { parseSysInfoOutput };
