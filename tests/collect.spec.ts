import { describe, expect, it } from 'vitest'
import { parseSysInfoOutput, toSysInfo } from '../src/collect.ts'
import { cpuWarnLevel, warnLevel } from '../src/protocol.ts'

describe('parseSysInfoOutput', () => {
  const pass = [
    '12640668416 11910699518', // cpu total, idle
    '16',                      // logical cores
    '16074980 8738116',        // MemTotal, MemAvailable (kB)
    '982292956 220498672',     // root fs 1024-blocks: total, used
  ].join('\n')

  it('parses a one-pass sample', () => {
    expect(parseSysInfoOutput(pass)).toEqual({
      total: 12640668416, idle: 11910699518, cores: 16,
      memTotal: 16074980, memAvailable: 8738116,
      diskTotal: 982292956, diskUsed: 220498672,
    })
  })

  it('returns null on malformed output', () => {
    expect(parseSysInfoOutput('')).toBeNull()
    expect(parseSysInfoOutput('garbage')).toBeNull()
    expect(parseSysInfoOutput('1 2\n3 4\n8')).toBeNull()
  })
})

describe('toSysInfo', () => {
  const prev = { total: 12640668170, idle: 11910699278 }
  const raw = {
    total: 12640668416, idle: 11910699518, cores: 16,
    memTotal: 16074980, memAvailable: 8738116,
    diskTotal: 982292956, diskUsed: 220498672,
  }

  it('computes summed CPU usage from the delta between passes', () => {
    // Busy delta = 6 of 246 ticks over 16 cores → 39% summed.
    expect(toSysInfo(prev, raw)).toEqual({ cpu: 39, cores: 16, mem: 46, disk: 22 })
  })

  it('reports 0 CPU on the first pass without a predecessor', () => {
    expect(toSysInfo(null, raw).cpu).toBe(0)
  })

  it('keeps CPU at 0 when the delta is empty', () => {
    expect(toSysInfo(raw, raw).cpu).toBe(0)
  })

  it('returns 0 usage when totals are zero', () => {
    const zero = { total: 0, idle: 0, cores: 4, memTotal: 0, memAvailable: 0, diskTotal: 0, diskUsed: 0 }
    expect(toSysInfo(prev, zero)).toEqual({ cpu: 0, cores: 4, mem: 0, disk: 0 })
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
