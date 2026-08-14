//#region lib/types/collect.js
/**
* Host-side collection: one bounded bash command samples everything the
* overlay needs in a single pass (no sleep), and pure functions turn the
* output into a {@link SysInfo}. Parsing and the CPU delta are free of I/O
* so tests can pin them.
*/
/**
* One-pass collection command: the current `/proc/stat` `cpu` line, the
* logical core count, memory totals (kB) and root-filesystem block counts;
* prints one value per line so the host parses them positionally.
*
* COMPILE-TIME CONSTANT — never interpolate runtime input into this string;
* the executor passes it as an argument, not a shell string.
*/
const COLLECT_COMMAND = [
	"awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8+$9;i=$5;print t\" \"i}' /proc/stat",
	"nproc",
	"awk '/^MemTotal/{T=$2}/^MemAvailable/{A=$2}END{print T\" \"A}' /proc/meminfo",
	"df -P / | awk 'NR==2{print $2\" \"$3}'"
].join("\n");
/**
* Parse the four lines printed by {@link COLLECT_COMMAND} into a
* {@link RawSample}. Returns null when the output is malformed.
* @param stdout - the command's captured stdout.
*/
function parseSysInfoOutput(stdout) {
	const lines = stdout.trim().split("\n");
	if (lines.length < 4) return null;
	const cpu = lines[0].split(" ").map(Number);
	const cores = Number(lines[1]) || 1;
	const mem = lines[2].split(" ").map(Number);
	const disk = lines[3].split(" ").map(Number);
	if (cpu.length < 2 || mem.length < 2 || disk.length < 2) return null;
	return {
		total: cpu[0],
		idle: cpu[1],
		cores,
		memTotal: mem[0],
		memAvailable: mem[1],
		diskTotal: disk[0],
		diskUsed: disk[1]
	};
}
/**
* Fold one fresh sample against the previous pass's cpu line into a
* {@link SysInfo}. The CPU percentage is the busy share of the delta between
* the two passes, scaled by the core count — the sum of all core usages
* (0..cores*100); the first pass has no predecessor and reports 0.
* @param prev - the previous pass's cpu line, or null on the first pass.
* @param raw - the freshly parsed sample.
*/
function toSysInfo(prev, raw) {
	const delta = raw.total - (prev?.total ?? raw.total);
	const idleDelta = raw.idle - (prev?.idle ?? raw.idle);
	const cpu = prev !== null && delta > 0 ? Math.max(0, Math.round((delta - idleDelta) / delta * raw.cores * 100)) : 0;
	const mem = raw.memTotal > 0 ? Math.round((raw.memTotal - raw.memAvailable) / raw.memTotal * 100) : 0;
	const disk = raw.diskTotal > 0 ? Math.round(raw.diskUsed / raw.diskTotal * 100) : 0;
	return {
		cpu,
		cores: raw.cores,
		mem,
		disk
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
* System Monitor host half: a background sampler refreshes the cached system
* snapshot once per second, and one `GET` route serves that cached value — no
* per-request subprocess, so a flood of requests cannot amplify sampling. The
* route rejects non-GET methods and cross-origin browsers, so a rogue page
* cannot read host telemetry either.
* @module @dsh-external/dsh-sysmon
*/
const inject = ["webServer", "shell"];
/** Sampler cadence; also the overlay's refresh period. */
const SAMPLER_INTERVAL_MS = 1e3;
/** Write one JSON envelope with a no-store policy. */
function json(res, status, body) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(body));
}
/**
* Reject browsers whose Origin/Referer does not match the Host header, which
* blocks cross-origin reads and DNS-rebinding abuse of the route. A request
* with neither header (curl, same-origin navigation) is served: the route only
* reads a cached snapshot and has no side effects.
*/
function sameOrigin(req) {
	const host = req.headers.host;
	if (host === void 0) return false;
	const origin = req.headers.origin;
	if (origin !== void 0) try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
	const referer = req.headers.referer;
	if (referer !== void 0) try {
		return new URL(referer).host === host;
	} catch {
		return false;
	}
	return true;
}
function apply(ctx) {
	let cached = null;
	let prevCpu = null;
	let sampling = false;
	const sample = async () => {
		if (sampling) return;
		sampling = true;
		try {
			const spec = ctx.shell.resolve({
				command: COLLECT_COMMAND,
				timeoutMs: 3e3,
				stdoutMaxBytes: 4096
			});
			const result = await ctx.shell.run(spec);
			if (result.exitCode !== 0) return;
			const raw = parseSysInfoOutput(result.stdout.text);
			if (raw === null) return;
			cached = toSysInfo(prevCpu, raw);
			prevCpu = {
				total: raw.total,
				idle: raw.idle
			};
		} catch (error) {
			console.error("sysmon: sampler failed", error);
		} finally {
			sampling = false;
		}
	};
	sample();
	const timer = setInterval(() => {
		sample();
	}, SAMPLER_INTERVAL_MS);
	ctx.effect(() => () => {
		clearInterval(timer);
	}, "sysmon: background sampler");
	ctx.effect(() => {
		const disposeRoute = ctx.webServer.register({
			kind: "exact",
			path: SYSINFO_ROUTE,
			handler: async (req, res) => {
				if (req.method !== "GET") return json(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				if (!sameOrigin(req)) return json(res, 403, {
					ok: false,
					error: "cross-origin request rejected"
				});
				if (cached === null) return json(res, 503, {
					ok: false,
					error: "no sample yet"
				});
				return json(res, 200, {
					ok: true,
					info: cached
				});
			}
		});
		return () => {
			disposeRoute();
		};
	}, "sysmon: system-status API");
}
//#endregion
export { apply, inject };
