import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region lib/types/collect.js
/**
* Host-side collection: one bounded bash command samples everything the
* overlay needs, and a pure parser turns its five output lines into a
* {@link SysInfo}. Parsing is kept free of I/O so tests can pin it.
*/
/**
* One-shot collection command: two `/proc/stat` `cpu` samples 150ms apart for
* the busy delta, then the logical core count, memory totals (kB) and root
* filesystem block counts; prints one value per line so the host parses them
* positionally.
*/
const COLLECT_COMMAND = [
	"s1=$(awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;i=$5;print t\" \"i}' /proc/stat)",
	"sleep 0.15",
	"s2=$(awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;i=$5;print t\" \"i}' /proc/stat)",
	"cores=$(nproc)",
	"mem=$(awk '/^MemTotal/{T=$2}/^MemAvailable/{A=$2}END{print T\" \"A}' /proc/meminfo)",
	"disk=$(df -P / | awk 'NR==2{print $2\" \"$3}')",
	"printf '%s\\n%s\\n%s\\n%s\\n%s' \"$s1\" \"$s2\" \"$cores\" \"$mem\" \"$disk\""
].join("; ");
/**
* Parse the five lines printed by {@link COLLECT_COMMAND} into a
* {@link SysInfo}. Returns null when the output is malformed.
* @param stdout - the command's captured stdout.
*/
function parseSysInfoOutput(stdout) {
	const lines = stdout.trim().split("\n");
	if (lines.length < 5) return null;
	const first = lines[0].split(" ").map(Number);
	const second = lines[1].split(" ").map(Number);
	const cores = Number(lines[2]) || 1;
	const mem = lines[3].split(" ").map(Number);
	const disk = lines[4].split(" ").map(Number);
	if (first.length < 2 || second.length < 2 || mem.length < 2 || disk.length < 2) return null;
	const delta = second[0] - first[0];
	return {
		cpu: delta > 0 ? Math.max(0, Math.round((delta - (second[1] - first[1])) / delta * cores * 100)) : 0,
		cores,
		mem: mem[0] > 0 ? Math.round((mem[0] - mem[1]) / mem[0] * 100) : 0,
		disk: disk[0] > 0 ? Math.round(disk[1] / disk[0] * 100) : 0
	};
}
//#endregion
//#region lib/types/protocol.js
/**
* Shared wire contract between the host API route and the browser overlay:
* the route path, the sample payload, and the warn-level rules both sides
* agree on. Pure helpers live here so tests can pin them without a runtime.
*/
/** Host API route the browser overlay polls once per second. */
const SYSINFO_ROUTE = "/dsh-sysmon/api";
//#endregion
//#region lib/types/index.js
/**
* System Monitor host half: registers one `GET` route that samples the system
* once per request. The browser overlay polls it every second. The route
* carries no session state, so any origin request gets the same fresh sample.
* @module @dsh-external/dsh-sysmon
*/
const execFileAsync = promisify(execFile);
const inject = ["webServer"];
/** Write one JSON envelope with a no-store policy. */
function json(res, status, body) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(body));
}
function apply(ctx) {
	ctx.effect(() => {
		const disposeRoute = ctx.webServer.register({
			kind: "exact",
			path: SYSINFO_ROUTE,
			handler: async (_req, res) => {
				try {
					const { stdout } = await execFileAsync("/bin/bash", ["-lc", COLLECT_COMMAND], {
						timeout: 5e3,
						maxBuffer: 65536
					});
					const info = parseSysInfoOutput(stdout);
					if (info === null) return json(res, 500, {
						ok: false,
						error: "unable to parse system stats"
					});
					return json(res, 200, {
						ok: true,
						info
					});
				} catch (error) {
					return json(res, 500, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
		});
		return () => {
			disposeRoute();
		};
	}, "sysmon: system-status API");
}
//#endregion
export { apply, inject, parseSysInfoOutput };
