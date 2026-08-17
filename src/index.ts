/**
 * System Monitor host half: a background sampler refreshes the cached system
 * snapshot once per second, and one `GET` route serves that cached value — no
 * per-request subprocess, so a flood of requests cannot amplify sampling. The
 * route rejects non-GET methods and cross-origin browsers, so a rogue page
 * cannot read host telemetry either.
 * @module dsh-sysmon
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { COLLECT_COMMAND, parseSysInfoOutput, toSysInfo, type RawCpu } from './collect.ts'
import { SYSINFO_ROUTE, type SysInfo, type SysInfoResponse } from './protocol.ts'

/** The subset of the Cordis host context this plugin reads. */
interface HostContext {
  webServer: {
    register(route: {
      kind: 'exact'
      path: string
      handler(req: IncomingMessage, res: ServerResponse): Promise<void> | void
    }): () => void
  }
  shell: {
    resolve(request: { command: string; timeoutMs?: number; stdoutMaxBytes?: number }): unknown
    run(spec: unknown): Promise<{ exitCode: number | null; stdout: { text: string } }>
  }
  effect(callback: () => (() => void), label?: string): void
}

export const inject = ['webServer', 'shell']

/** Sampler cadence; also the overlay's refresh period. */
const SAMPLER_INTERVAL_MS = 1000

/** Write one JSON envelope with a no-store policy. */
function json(res: ServerResponse, status: number, body: SysInfoResponse): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(body))
}

/**
 * Reject browsers whose Origin/Referer does not match the Host header, which
 * blocks cross-origin reads and DNS-rebinding abuse of the route. A request
 * with neither header (curl, same-origin navigation) is served: the route only
 * reads a cached snapshot and has no side effects.
 */
function sameOrigin(req: IncomingMessage): boolean {
  const host = req.headers.host
  if (host === undefined) return false
  const origin = req.headers.origin
  if (origin !== undefined) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  const referer = req.headers.referer
  if (referer !== undefined) {
    try {
      return new URL(referer).host === host
    } catch {
      return false
    }
  }
  return true
}

export function apply(ctx: HostContext): void {
  let cached: SysInfo | null = null
  let prevCpu: RawCpu | null = null
  let sampling = false
  const sample = async (): Promise<void> => {
    if (sampling) return
    sampling = true
    try {
      const spec = ctx.shell.resolve({ command: COLLECT_COMMAND, timeoutMs: 3000, stdoutMaxBytes: 4096 })
      const result = await ctx.shell.run(spec)
      if (result.exitCode !== 0) return
      const raw = parseSysInfoOutput(result.stdout.text)
      if (raw === null) return
      cached = toSysInfo(prevCpu, raw)
      prevCpu = { total: raw.total, idle: raw.idle }
    } catch (error) {
      // A transient sampler failure keeps the previous snapshot on screen.
      console.error('sysmon: sampler failed', error)
    } finally {
      sampling = false
    }
  }
  void sample()
  const timer = setInterval(() => { void sample() }, SAMPLER_INTERVAL_MS)
  ctx.effect(() => () => {
    clearInterval(timer)
  }, 'sysmon: background sampler')
  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: SYSINFO_ROUTE,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
        if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross-origin request rejected' })
        if (cached === null) return json(res, 503, { ok: false, error: 'no sample yet' })
        return json(res, 200, { ok: true, info: cached })
      },
    })
    return () => {
      disposeRoute()
    }
  }, 'sysmon: system-status API')
}
