/**
 * Shared wire contract between the host API route and the browser overlay:
 * the route path, the sample payload, and the warn-level rules both sides
 * agree on. Pure helpers live here so tests can pin them without a runtime.
 */

/** Host API route the browser overlay polls once per second. */
export const SYSINFO_ROUTE = '/dsh-sysmon/api'

/** One system-status sample, in display units. */
export interface SysInfo {
  /** Sum of all logical-core usages, in percent (0..cores*100). */
  cpu: number
  /** Total logical core count — the `y` in `x%/y`. */
  cores: number
  /** Memory usage percent (0..100). */
  mem: number
  /** Root-filesystem usage percent (0..100). */
  disk: number
}

/** The host route's response envelope. */
export type SysInfoResponse = { ok: true; info: SysInfo } | { ok: false; error: string }

/** Warn level of one usage value. */
export type WarnLevel = 'normal' | 'warn' | 'critical'

/**
 * Memory/disk warn level: usage above 80% is orange (`warn`), above 90% is
 * red (`critical`).
 * @param value - usage percent (0..100).
 */
export function warnLevel(value: number): WarnLevel {
  if (value > 90) return 'critical'
  if (value > 80) return 'warn'
  return 'normal'
}

/**
 * CPU warn level on the lenient total-capacity scale: the summed core usage
 * reaching 90% of all cores is orange (`warn`), 98% is red (`critical`).
 * Short high-CPU bursts are expected, so the thresholds sit at the very top
 * of the range.
 * @param cpu - summed core usage, in percent (0..cores*100).
 * @param cores - total logical core count.
 */
export function cpuWarnLevel(cpu: number, cores: number): WarnLevel {
  if (cores <= 0) return 'normal'
  if (cpu >= cores * 98) return 'critical'
  if (cpu >= cores * 90) return 'warn'
  return 'normal'
}
