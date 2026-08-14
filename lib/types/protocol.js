/**
 * Shared wire contract between the host API route and the browser overlay:
 * the route path, the sample payload, and the warn-level rules both sides
 * agree on. Pure helpers live here so tests can pin them without a runtime.
 */
/** Host API route the browser overlay polls once per second. */
export const SYSINFO_ROUTE = '/dsh-sysmon/api';
/**
 * Memory/disk warn level: usage above 80% is orange (`warn`), above 90% is
 * red (`critical`).
 * @param value - usage percent (0..100).
 */
export function warnLevel(value) {
    if (value > 90)
        return 'critical';
    if (value > 80)
        return 'warn';
    return 'normal';
}
/**
 * CPU warn level on the lenient total-capacity scale: the summed core usage
 * reaching 90% of all cores is orange (`warn`), 98% is red (`critical`).
 * Short high-CPU bursts are expected, so the thresholds sit at the very top
 * of the range.
 * @param cpu - summed core usage, in percent (0..cores*100).
 * @param cores - total logical core count.
 */
export function cpuWarnLevel(cpu, cores) {
    if (cores <= 0)
        return 'normal';
    if (cpu >= cores * 98)
        return 'critical';
    if (cpu >= cores * 90)
        return 'warn';
    return 'normal';
}
