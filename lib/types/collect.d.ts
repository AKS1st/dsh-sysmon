/**
 * Host-side collection: one bounded bash command samples everything the
 * overlay needs in a single pass (no sleep), and pure functions turn the
 * output into a {@link SysInfo}. Parsing and the CPU delta are free of I/O
 * so tests can pin them.
 */
import type { SysInfo } from './protocol.ts';
/**
 * One-pass collection command: the current `/proc/stat` `cpu` line, the
 * logical core count, memory totals (kB) and root-filesystem block counts;
 * prints one value per line so the host parses them positionally.
 *
 * COMPILE-TIME CONSTANT — never interpolate runtime input into this string;
 * the executor passes it as an argument, not a shell string.
 */
export declare const COLLECT_COMMAND: string;
/** The current `/proc/stat` `cpu` line, in ticks. */
export interface RawCpu {
    /** Sum of the cpu-line fields except guest/guest_nice (includes steal). */
    total: number;
    /** Idle ticks. */
    idle: number;
}
/** One parsed pass of {@link COLLECT_COMMAND} output. */
export interface RawSample extends RawCpu {
    /** Logical core count. */
    cores: number;
    /** MemTotal / MemAvailable in kB. */
    memTotal: number;
    memAvailable: number;
    /** Root filesystem 1024-blocks: total / used. */
    diskTotal: number;
    diskUsed: number;
}
/**
 * Parse the four lines printed by {@link COLLECT_COMMAND} into a
 * {@link RawSample}. Returns null when the output is malformed.
 * @param stdout - the command's captured stdout.
 */
export declare function parseSysInfoOutput(stdout: string): RawSample | null;
/**
 * Fold one fresh sample against the previous pass's cpu line into a
 * {@link SysInfo}. The CPU percentage is the busy share of the delta between
 * the two passes, scaled by the core count — the sum of all core usages
 * (0..cores*100); the first pass has no predecessor and reports 0.
 * @param prev - the previous pass's cpu line, or null on the first pass.
 * @param raw - the freshly parsed sample.
 */
export declare function toSysInfo(prev: RawCpu | null, raw: RawSample): SysInfo;
