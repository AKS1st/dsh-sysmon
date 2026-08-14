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
export const COLLECT_COMMAND = [
    "s1=$(awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;i=$5;print t\" \"i}' /proc/stat)",
    'sleep 0.15',
    "s2=$(awk '/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;i=$5;print t\" \"i}' /proc/stat)",
    'cores=$(nproc)',
    "mem=$(awk '/^MemTotal/{T=$2}/^MemAvailable/{A=$2}END{print T\" \"A}' /proc/meminfo)",
    "disk=$(df -P / | awk 'NR==2{print $2\" \"$3}')",
    "printf '%s\\n%s\\n%s\\n%s\\n%s' \"$s1\" \"$s2\" \"$cores\" \"$mem\" \"$disk\"",
].join('; ');
/**
 * Parse the five lines printed by {@link COLLECT_COMMAND} into a
 * {@link SysInfo}. Returns null when the output is malformed.
 * @param stdout - the command's captured stdout.
 */
export function parseSysInfoOutput(stdout) {
    const lines = stdout.trim().split('\n');
    if (lines.length < 5)
        return null;
    const first = lines[0].split(' ').map(Number);
    const second = lines[1].split(' ').map(Number);
    const cores = Number(lines[2]) || 1;
    const mem = lines[3].split(' ').map(Number);
    const disk = lines[4].split(' ').map(Number);
    if (first.length < 2 || second.length < 2 || mem.length < 2 || disk.length < 2)
        return null;
    const delta = second[0] - first[0];
    // Sum of all core usages: the busy share of the whole delta, scaled by the
    // core count (0..cores*100).
    const cpu = delta > 0 ? Math.max(0, Math.round(((delta - (second[1] - first[1])) / delta) * cores * 100)) : 0;
    const memPercent = mem[0] > 0 ? Math.round(((mem[0] - mem[1]) / mem[0]) * 100) : 0;
    const diskPercent = disk[0] > 0 ? Math.round((disk[1] / disk[0]) * 100) : 0;
    return { cpu, cores, mem: memPercent, disk: diskPercent };
}
