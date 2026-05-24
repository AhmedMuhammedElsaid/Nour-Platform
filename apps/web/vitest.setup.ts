import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())

// @radix-ui/react-use-size (used by Slider) requires ResizeObserver.
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom doesn't implement HTMLMediaElement playback. Replace Audio with a
// minimal stub that correctly tracks paused state and fires play/pause events,
// so that PlayerProvider can run its effects without throwing.
class MockAudio extends EventTarget {
  paused = true
  src = ''
  currentTime = 0
  duration = 0
  preload = ''

  play = vi.fn((): Promise<void> => {
    this.paused = false
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })

  pause = vi.fn((): void => {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  })

  load = vi.fn((): void => {})

  removeAttribute = vi.fn((attr: string): void => {
    if (attr === 'src') this.src = ''
  })
}

if (typeof window !== 'undefined') {
  // Cast via `unknown` because MockAudio's `vi.fn()`-typed methods don't
  // overlap with the standard HTMLAudioElement signatures TS expects on
  // window.Audio. jsdom doesn't ship a real Audio so any cast is necessarily
  // an adapter boundary; this one narrows to a typed shape for the assignment.
  ;(window as unknown as { Audio: typeof MockAudio }).Audio = MockAudio
}
