import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'

const sampleOutput = [
  '100 80',
  '4',
  '1000 400',
  '10000 2500',
].join('\n')

describe('host sampler lifecycle', () => {
  it('registers the sampler with Cordis interval', async () => {
    let tick: (() => void) | undefined
    const interval = vi.fn((callback: () => void, delay: number) => {
      tick = callback
      expect(delay).toBe(1000)
      return vi.fn()
    })
    const shell = {
      resolve: vi.fn(() => ({})),
      run: vi.fn(async () => ({ exitCode: 0, stdout: { text: sampleOutput } })),
    }
    const register = vi.fn(() => vi.fn())
    const ctx = {
      webServer: { register },
      shell,
      interval,
      effect: vi.fn((setup: () => (() => void)) => { setup() }),
    }

    apply(ctx)
    await Promise.resolve()
    expect(interval).toHaveBeenCalledOnce()
    expect(tick).toBeDefined()

    tick?.()
    await Promise.resolve()
    expect(shell.run).toHaveBeenCalledTimes(2)
  })

  it('clears the sampler timer when Cordis tears down the context', () => {
    const teardown: Array<() => void> = []
    const timerDisposer = vi.fn()
    const effect = vi.fn((setup: () => (() => void)) => {
      const dispose = setup()
      teardown.push(dispose)
      return dispose
    })
    const interval = vi.fn((callback: () => void, delay: number) => {
      expect(callback).toBeTypeOf('function')
      expect(delay).toBe(1000)
      return effect(() => timerDisposer)
    })
    const shell = {
      resolve: vi.fn(() => ({})),
      run: vi.fn(async () => ({ exitCode: 0, stdout: { text: sampleOutput } })),
    }
    const ctx = {
      webServer: { register: vi.fn(() => vi.fn()) },
      shell,
      interval,
      effect,
    }

    apply(ctx)
    expect(timerDisposer).not.toHaveBeenCalled()

    for (const dispose of teardown) dispose()

    expect(timerDisposer).toHaveBeenCalledOnce()
  })
})
