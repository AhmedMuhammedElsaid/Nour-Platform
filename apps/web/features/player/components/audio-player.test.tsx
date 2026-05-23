import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

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
  it('renders null when no queue is loaded', () => {
    const { container } = render(
      <PlayerProvider>
        <AudioPlayer />
      </PlayerProvider>,
    )
    expect(
      screen.queryByRole('region', { name: /audio player/i }),
    ).not.toBeInTheDocument()
    // No bar should be in the DOM at all when idle.
    expect(container.querySelector('section')).toBeNull()
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
})
