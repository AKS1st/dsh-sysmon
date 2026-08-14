/**
 * Host-side collection: one bounded bash command samples everything the
 * overlay needs in a single pass (no sleep), and pure functions turn the
 * output into a {@link SysInfo}. Parsing and the CPU delta are free of I/O
 * so tests can pin them.
 */

import type { SysInfo } from './protocol.ts'

/**
 * One-pass collection command: the current `/proc/stat` `cpu` line, the
 * logical core count, memory totals (kB) and root-filesystem block counts;
 * prints one value per line so the host parses them positionally.
 *
 * COMPILE-TIME CONSTANT — never interpolate runtime input into this string;
 * the executor passes it as an argument, not a shell string.
 */
export const COLLECT_COMMAND = [
  // steal ($9) counts toward busy: a virtualized tenant's CPU is being taken
  // by the hypervisor and is not idle time. guest/guest_nice are already
  // folded into user/nice and must not be added again.
  "awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8+$9;i=$5;print t\" \"i}' /proc/stat",
  'nproc',
  "awk '/^MemTotal/{T=$2}/^MemAvailable/{A=$2}END{print T\" \"A}' /proc/meminfo",
  "df -P / | awk 'NR==2{print $2\" \"$3}'",
].join('\n')

/** The current `/proc/stat` `cpu` line, in ticks. */
export interface RawCpu {
  /** Sum of the cpu-line fields except guest/guest_nice (includes steal). */
  total: number
  /** Idle ticks. */
  idle: number
}

/** One parsed pass of {@link COLLECT_COMMAND} output. */
export interface RawSample extends RawCpu {
  /** Logical core count. */
  cores: number
  /** MemTotal / MemAvailable in kB. */
  memTotal: number
  memAvailable: number
  /** Root filesystem 1024-blocks: total / used. */
  diskTotal: number
  diskUsed: number
}

/**
 * Parse the four lines printed by {@link COLLECT_COMMAND} into a
 * {@link RawSample}. Returns null when the output is malformed.
 * @param stdout - the command's captured stdout.
 */
export function parseSysInfoOutput(stdout: string): RawSample | null {
  const lines = stdout.trim().split('\n')
  if (lines.length < 4) return null
  const cpu = lines[0].split(' ').map(Number)
  const cores = Number(lines[1]) || 1
  const mem = lines[2].split(' ').map(Number)
  const disk = lines[3].split(' ').map(Number)
  if (cpu.length < 2 || mem.length < 2 || disk.length < 2) return null
  return {
    total: cpu[0], idle: cpu[1], cores,
    memTotal: mem[0], memAvailable: mem[1],
    diskTotal: disk[0], diskUsed: disk[1],
  }
}

/**
 * Fold one fresh sample against the previous pass's cpu line into a
 * {@link SysInfo}. The CPU percentage is the busy share of the delta between
 * the two passes, scaled by the core count — the sum of all core usages
 * (0..cores*100); the first pass has no predecessor and reports 0.
 * @param prev - the previous pass's cpu line, or null on the first pass.
 * @param raw - the freshly parsed sample.
 */
export function toSysInfo(prev: RawCpu | null, raw: RawSample): SysInfo {
  const delta = raw.total - (prev?.total ?? raw.total)
  const idleDelta = raw.idle - (prev?.idle ?? raw.idle)
  const cpu = prev !== null && delta > 0
    ? Math.max(0, Math.round(((delta - idleDelta) / delta) * raw.cores * 100))
    : 0
  const mem = raw.memTotal > 0 ? Math.round(((raw.memTotal - raw.memAvailable) / raw.memTotal) * 100) : 0
  const disk = raw.diskTotal > 0 ? Math.round((raw.diskUsed / raw.diskTotal) * 100) : 0
  return { cpu, cores: raw.cores, mem, disk }
}
