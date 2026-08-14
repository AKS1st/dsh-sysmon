import { describe, expect, it } from 'vitest'
import { parseSysInfoOutput } from '../src/collect.ts'
import { cpuWarnLevel, warnLevel } from '../src/protocol.ts'

describe('parseSysInfoOutput', () => {
  const sample = [
    '12640668170 11910699278', // first /proc/stat cpu sample: total, idle
    '12640668416 11910699518', // second sample 150ms later
    '16',                      // logical cores
    '16074980 8738116',        // MemTotal, MemAvailable (kB)
    '982292956 220498672',     // root fs 1024-blocks: total, used
  ].join('\n')

  it('computes summed CPU usage scaled by cores', () => {
    // Busy delta = 6 of 246 ticks over 16 cores → 39% summed.
    expect(parseSysInfoOutput(sample)).toEqual({ cpu: 39, cores: 16, mem: 46, disk: 22 })
  })

  it('returns null on malformed output', () => {
    expect(parseSysInfoOutput('')).toBeNull()
    expect(parseSysInfoOutput('garbage')).toBeNull()
    expect(parseSysInfoOutput('1 2\n3 4\n8')).toBeNull()
  })

  it('returns 0 usage when the delta is empty or totals are zero', () => {
    expect(parseSysInfoOutput('100 100\n100 100\n4\n100 0\n100 0')).toEqual({ cpu: 0, cores: 4, mem: 100, disk: 0 })
  })
})

describe('warn thresholds', () => {
  it('memory/disk: >80% orange, >90% red', () => {
    expect(warnLevel(80)).toBe('normal')
    expect(warnLevel(81)).toBe('warn')
    expect(warnLevel(90)).toBe('warn')
    expect(warnLevel(91)).toBe('critical')
  })

  it('cpu: >=90% of all cores orange, >=98% red', () => {
    expect(cpuWarnLevel(1439, 16)).toBe('normal')
    expect(cpuWarnLevel(1440, 16)).toBe('warn')
    expect(cpuWarnLevel(1567, 16)).toBe('warn')
    expect(cpuWarnLevel(1568, 16)).toBe('critical')
  })

  it('cpu: degenerate core count stays normal', () => {
    expect(cpuWarnLevel(9999, 0)).toBe('normal')
  })
})
