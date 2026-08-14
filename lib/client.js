window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-sysmon",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/protocol.ts
		/**
		* Shared wire contract between the host API route and the browser overlay:
		* the route path, the sample payload, and the warn-level rules both sides
		* agree on. Pure helpers live here so tests can pin them without a runtime.
		*/
		/** Host API route the browser overlay polls once per second. */
		const SYSINFO_ROUTE = "/dsh-sysmon/api";
		/**
		* Memory/disk warn level: usage above 80% is orange (`warn`), above 90% is
		* red (`critical`).
		* @param value - usage percent (0..100).
		*/
		function warnLevel(value) {
			if (value > 90) return "critical";
			if (value > 80) return "warn";
			return "normal";
		}
		/**
		* CPU warn level on the lenient total-capacity scale: the summed core usage
		* reaching 90% of all cores is orange (`warn`), 98% is red (`critical`).
		* Short high-CPU bursts are expected, so the thresholds sit at the very top
		* of the range.
		* @param cpu - summed core usage, in percent (0..cores*100).
		* @param cores - total logical core count.
		*/
		function cpuWarnLevel(cpu, cores) {
			if (cores <= 0) return "normal";
			if (cpu >= cores * 98) return "critical";
			if (cpu >= cores * 90) return "warn";
			return "normal";
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* System Monitor browser half: a fixed bottom-right overlay that polls the
		* host route once per second and repaints one monospace line:
		*
		*     CPU 39%/16    MEM 46%    DISK 22%
		*
		* Default color is a quiet light gray; memory/disk above 80% turn orange and
		* above 90% red, CPU follows the lenient total-capacity scale (>=90% of all
		* cores orange, >=98% red). The overlay is click-through and never blocks the
		* app underneath.
		* @module @dsh-external/dsh-sysmon/client
		*/
		const inject = [];
		const CSS = `
#dsh-sysmon{position:fixed;right:14px;bottom:12px;z-index:2147483000;font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:rgba(145,145,145,.78);text-align:right;white-space:nowrap;pointer-events:none;user-select:none;letter-spacing:.02em}
#dsh-sysmon .sm-group{margin-left:14px}
#dsh-sysmon .sm-label{opacity:.75}
#dsh-sysmon .sm-warn{color:#e67e22}
#dsh-sysmon .sm-critical{color:#e74c3c}
`;
		const LEVEL_CLASS = {
			normal: "",
			warn: "sm-warn",
			critical: "sm-critical"
		};
		function span(className, ...children) {
			const el = document.createElement("span");
			if (className !== "") el.className = className;
			for (const child of children) el.append(child);
			return el;
		}
		/** Repaint the overlay for one sample; null renders placeholder dashes. */
		function render(root, info) {
			const cpu = info === null ? "--%/--" : `${info.cpu}%/${info.cores}`;
			const mem = info === null ? "--%" : `${info.mem}%`;
			const disk = info === null ? "--%" : `${info.disk}%`;
			const cpuLevel = info === null ? "normal" : cpuWarnLevel(info.cpu, info.cores);
			const memLevel = info === null ? "normal" : warnLevel(info.mem);
			const diskLevel = info === null ? "normal" : warnLevel(info.disk);
			root.replaceChildren(span("sm-group", span("sm-label", "CPU "), span(LEVEL_CLASS[cpuLevel], cpu)), span("sm-group", span("sm-label", "MEM "), span(LEVEL_CLASS[memLevel], mem)), span("sm-group", span("sm-label", "DISK "), span(LEVEL_CLASS[diskLevel], disk)));
		}
		function apply(ctx) {
			const style = document.createElement("style");
			style.textContent = CSS;
			document.head.append(style);
			const root = document.createElement("div");
			root.id = "dsh-sysmon";
			document.body.append(root);
			render(root, null);
			let disposed = false;
			const tick = async () => {
				if (disposed) return;
				try {
					const body = await (await fetch(SYSINFO_ROUTE, { cache: "no-store" })).json();
					if (!disposed && body.ok) render(root, body.info);
				} catch {}
			};
			tick();
			const timer = window.setInterval(() => {
				tick();
			}, 1e3);
			ctx.effect(() => () => {
				disposed = true;
				window.clearInterval(timer);
				root.remove();
				style.remove();
			}, "sysmon: bottom-right status overlay");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map