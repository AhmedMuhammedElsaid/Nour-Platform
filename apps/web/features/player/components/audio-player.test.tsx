import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioPlayer } from '@repo/ui/blocks/audio-player'
import {
  PlayerProvider,
  usePlayer,
  type QueueTrack,
} from '@repo/ui/blocks/player-context'

const fixtureQueue: QueueTrack[] = [
  {
    id: 'track-1',
    title: 'Surah Al-Fatiha',
    mediaUrl: 'https://example.test/track-1.mp3',
    durationSecs: 90,
  },
  {
    id: 'track-2',
    title: 'Surah Al-Baqarah',
    mediaUrl: 'https://example.test/track-2.mp3',
    durationSecs: 120,
  },
]

// Test harness that exposes the player context to assertions and lets a test
// drive loadQueue without rendering a real consumer UI.
function Harness({ autoLoad }: { autoLoad?: boolean }) {
  const player = usePlayer()
  return (
    <div>
      <button
        type="button"
        data-testid="load"
        onClick={() => player.loadQueue(fixtureQueue, 0)}
      >
        load
      </button>
      {autoLoad ? <AutoLoad /> : null}
      <span data-testid="is-playing">{String(player.isPlaying)}</span>
      <span data-testid="current-index">{player.currentIndex}</span>
    </div>
  )
}

function AutoLoad() {
  const player = usePlayer()
  // Fire once on mount to put the player into the loaded-queue state without
  // simulating a user click — used by the "renders when queue loaded" test.
  if (player.queue.length === 0) {
    player.loadQueue(fixtureQueue, 0)
  }
  return null
}

describe('AudioPlayer', () => {
  // Player prefs (speed/repeat/shuffle) persist to localStorage; isolate each
  // test so stored state from one doesn't leak into the next test's hydration.
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stays mounted but hidden when no queue is loaded', () => {
    const { container } = render(
      <PlayerProvider>
        <AudioPlayer />
      </PlayerProvider>,
    )
    // Hidden from the accessibility tree while idle…
    expect(
      screen.queryByRole('region', { name: /audio player/i }),
    ).not.toBeInTheDocument()
    // …but the bar stays in the DOM so it can slide out via CSS rather than
    // unmount (DESIGN.md §17.1/§17.5).
    const section = container.querySelector('section')
    expect(section).not.toBeNull()
    expect(section).toHaveClass('translate-y-full', 'pointer-events-none')
    expect(section).toHaveAttribute('aria-hidden', 'true')
    // No track content is rendered while idle.
    expect(screen.queryByText('Surah Al-Fatiha')).not.toBeInTheDocument()
  })

  it('exposes a mm:ss aria-valuetext on the seek slider', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )

    await user.click(screen.getByTestId('load'))

    // durationSecs 90 → "1:30"; currentTime starts at 0 → "0:00".
    expect(screen.getByRole('slider', { name: /seek/i })).toHaveAttribute(
      'aria-valuetext',
      '0:00 of 1:30',
    )
  })

  it('announces the current track in a polite live region', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )

    await user.click(screen.getByTestId('load'))

    expect(
      screen.getByText(/now playing: surah al-fatiha/i),
    ).toBeInTheDocument()
  })

  it('changes track with the n / p keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )

    await user.click(screen.getByTestId('load'))
    expect(screen.getByTestId('current-index')).toHaveTextContent('0')

    await act(async () => {
      await user.keyboard('n')
    })
    expect(screen.getByTestId('current-index')).toHaveTextContent('1')

    await act(async () => {
      await user.keyboard('p')
    })
    expect(screen.getByTestId('current-index')).toHaveTextContent('0')
  })

  it('renders the player bar after loadQueue is called', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )

    expect(
      screen.queryByRole('region', { name: /audio player/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByTestId('load'))

    expect(
      screen.getByRole('region', { name: /audio player/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Surah Al-Fatiha')).toBeInTheDocument()
    expect(screen.getByText('Track 1 / 2')).toBeInTheDocument()
  })

  it('toggles play/pause when the play button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )

    await user.click(screen.getByTestId('load'))

    // After loadQueue via a user click, auto-play fires because
    // hasInteracted is already true from the pointerdown event.
    // The button should advertise "Pause".
    const pauseButton = screen.getByRole('button', { name: /^pause$/i })
    expect(pauseButton).toBeInTheDocument()
    expect(screen.getByTestId('is-playing')).toHaveTextContent('true')

    await user.click(pauseButton)
    expect(screen.getByTestId('is-playing')).toHaveTextContent('false')
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^play$/i }))
    expect(screen.getByTestId('is-playing')).toHaveTextContent('true')
  })

  it('pauses the audio element on unmount to prevent double-play on locale switch', () => {
    // Locale switch remounts [locale]/layout.tsx, which remounts PlayerProvider.
    // Without the cleanup effect the orphaned HTMLAudioElement keeps playing
    // alongside the new provider's element.
    type AudioStub = { pause: ReturnType<typeof vi.fn> }
    let capturedPause: ReturnType<typeof vi.fn> | null = null
    const OrigAudio = (window as unknown as { Audio: new () => AudioStub }).Audio

    ;(window as unknown as { Audio: unknown }).Audio = function () {
      const inst = new OrigAudio()
      capturedPause = inst.pause
      return inst
    }

    try {
      const { unmount } = render(
        <PlayerProvider>
          <Harness />
        </PlayerProvider>,
      )

      expect(capturedPause).not.toBeNull()
      capturedPause!.mockClear() // discard calls from initial-render effects
      unmount()
      expect(capturedPause).toHaveBeenCalledOnce()
    } finally {
      ;(window as unknown as { Audio: unknown }).Audio = OrigAudio
    }
  })

  it('switches track from the queue sheet', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )

    await user.click(screen.getByTestId('load'))
    expect(screen.getByTestId('current-index')).toHaveTextContent('0')

    await user.click(screen.getByRole('button', { name: /queue/i }))

    // The sheet lists every track; pick the second one.
    await act(async () => {
      await user.click(
        screen.getByRole('button', { name: /surah al-baqarah/i }),
      )
    })

    expect(screen.getByTestId('current-index')).toHaveTextContent('1')
  })

  it('advances to the next track via the Next button', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )

    await user.click(screen.getByTestId('load'))
    expect(screen.getByText('Surah Al-Fatiha')).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /next track/i }))
    })

    expect(screen.getByText('Surah Al-Baqarah')).toBeInTheDocument()
    expect(screen.getByText('Track 2 / 2')).toBeInTheDocument()
    // Last track — Next button should be disabled.
    expect(screen.getByRole('button', { name: /next track/i })).toBeDisabled()
  })

  it('toggles shuffle via the shuffle button', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )
    await user.click(screen.getByTestId('load'))

    const shuffle = screen.getByRole('button', { name: /shuffle/i })
    expect(shuffle).toHaveAttribute('aria-pressed', 'false')
    await user.click(shuffle)
    expect(shuffle).toHaveAttribute('aria-pressed', 'true')
  })

  it('cycles repeat off → all → one with matching labels', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )
    await user.click(screen.getByTestId('load'))

    expect(
      screen.getByRole('button', { name: /repeat off/i }),
    ).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: /repeat off/i }))
    expect(
      screen.getByRole('button', { name: /repeat all/i }),
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /repeat all/i }))
    expect(
      screen.getByRole('button', { name: /repeat one/i }),
    ).toBeInTheDocument()
  })

  it('wraps past the last track when repeat-all is on', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )
    await user.click(screen.getByTestId('load'))

    // Enable repeat-all (off → all).
    await user.click(screen.getByRole('button', { name: /repeat off/i }))

    // Advance to the last track, then once more — should wrap to index 0.
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /next track/i }))
    })
    expect(screen.getByTestId('current-index')).toHaveTextContent('1')

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /next track/i }))
    })
    expect(screen.getByTestId('current-index')).toHaveTextContent('0')
  })

  it('sets the playback speed from the settings sheet', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )
    await user.click(screen.getByTestId('load'))

    await user.click(
      screen.getByRole('button', { name: /playback settings/i }),
    )
    const fast = screen.getByRole('button', { name: '1.5×' })
    await user.click(fast)
    expect(fast).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles the end-of-track sleep mode from the settings sheet', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <Harness />
        <AudioPlayer />
      </PlayerProvider>,
    )
    await user.click(screen.getByTestId('load'))

    await user.click(
      screen.getByRole('button', { name: /playback settings/i }),
    )
    const endOfTrack = screen.getByRole('button', { name: /end of track/i })
    expect(endOfTrack).toHaveAttribute('aria-pressed', 'false')

    await user.click(endOfTrack)
    expect(endOfTrack).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /^off$/i }))
    expect(endOfTrack).toHaveAttribute('aria-pressed', 'false')
  })

  it('publishes now-playing metadata to the Media Session API', async () => {
    type MediaSessionStub = {
      metadata: { title?: string } | null
      playbackState: string
      setActionHandler: ReturnType<typeof vi.fn>
      setPositionState: ReturnType<typeof vi.fn>
    }
    const stub: MediaSessionStub = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
    }
    ;(navigator as unknown as { mediaSession: MediaSessionStub }).mediaSession =
      stub
    ;(globalThis as unknown as { MediaMetadata: unknown }).MediaMetadata =
      class {
        title?: string
        constructor(init: { title?: string }) {
          this.title = init.title
        }
      }

    try {
      const user = userEvent.setup()
      render(
        <PlayerProvider>
          <Harness />
          <AudioPlayer />
        </PlayerProvider>,
      )
      await user.click(screen.getByTestId('load'))

      expect(stub.metadata?.title).toBe('Surah Al-Fatiha')
      expect(stub.setActionHandler).toHaveBeenCalled()
    } finally {
      delete (navigator as unknown as { mediaSession?: unknown }).mediaSession
      delete (globalThis as unknown as { MediaMetadata?: unknown })
        .MediaMetadata
    }
  })
})
