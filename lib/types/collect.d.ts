/**
 * Host-side collection: one bounded bash command samples everything the
 * overlay needs, and a pure parser turns its five output lines into a
 * {@link SysInfo}. Parsing is kept free of I/O so tests can pin it.
 */
import type { SysInfo } from './protocol.ts';
/**
 * One-shot collection command: two `/proc/stat` `cpu` samples 150ms apart for
 * the busy delta, then the logical core count, memory totals (kB) and root
 * filesystem block counts; prints one value per line so the host parses them
 * positionally.
 */
export declare const COLLECT_COMMAND: string;
/**
 * Parse the five lines printed by {@link COLLECT_COMMAND} into a
 * {@link SysInfo}. Returns null when the output is malformed.
 * @param stdout - the command's captured stdout.
 */
export declare function parseSysInfoOutput(stdout: string): SysInfo | null;
