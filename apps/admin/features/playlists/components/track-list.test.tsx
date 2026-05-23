import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions/reorder-tracks.action', () => ({
  reorderTracksAction: vi.fn(),
}))

// dnd-kit requires pointer events and complex DOM APIs not available in jsdom.
// Mock the modules so we can test rendering logic without drag mechanics.
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  KeyboardSensor: class {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
  }),
  arrayMove: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

import { TrackList, type SerializedTrack } from './track-list'

const tracks: SerializedTrack[] = [
  { id: 'aaa', title: 'Opening Recitation', order: 0, durationSecs: 125 },
  { id: 'bbb', title: 'First Verse', order: 1 },
  { id: 'ccc', title: 'Second Verse', order: 2, durationSecs: 73 },
]

describe('TrackList', () => {
  it('renders all track titles', () => {
    render(<TrackList playlistId="pl-1" initialTracks={tracks} />)
    expect(screen.getByText('Opening Recitation')).toBeInTheDocument()
    expect(screen.getByText('First Verse')).toBeInTheDocument()
    expect(screen.getByText('Second Verse')).toBeInTheDocument()
  })

  it('shows empty state when no tracks', () => {
    render(<TrackList playlistId="pl-1" initialTracks={[]} />)
    expect(screen.getByText(/no tracks yet/i)).toBeInTheDocument()
  })

  it('displays formatted duration for tracks that have it', () => {
    render(<TrackList playlistId="pl-1" initialTracks={tracks} />)
    expect(screen.getByText('2:05')).toBeInTheDocument()
    expect(screen.getByText('1:13')).toBeInTheDocument()
  })

  it('omits duration for tracks without durationSecs', () => {
    render(<TrackList playlistId="pl-1" initialTracks={tracks} />)
    const items = screen.getAllByRole('listitem')
    // 'First Verse' has no duration — its row should not show a time string
    const firstVerseItem = items.find((el) =>
      el.textContent?.includes('First Verse'),
    )
    expect(firstVerseItem?.textContent).not.toMatch(/\d+:\d{2}/)
  })
})
