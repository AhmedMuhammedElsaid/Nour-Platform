import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// next/link renders fine in the browser but needs the Next.js router context
// in tests. Stub it to a plain anchor to avoid that dependency.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

import { PlaylistsTable } from './playlists-table'
import type { SerializedPlaylist } from './playlists-table'

const rows: SerializedPlaylist[] = [
  {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    title: 'Quran Recitations',
    slug: 'quran-recitations',
    status: 'published',
    trackIds: [
      'bbbbbbbbbbbbbbbbbbbbbbbb',
      'cccccccccccccccccccccccc',
      'dddddddddddddddddddddddd',
    ],
    categoryIds: [],
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'eeeeeeeeeeeeeeeeeeeeeeee',
    title: 'Islamic Lectures',
    slug: 'islamic-lectures',
    status: 'draft',
    trackIds: ['ffffffffffffffffffffffff'],
    categoryIds: [],
    createdAt: '2024-02-20T00:00:00.000Z',
    updatedAt: '2024-02-20T00:00:00.000Z',
  },
]

describe('PlaylistsTable', () => {
  it('renders all rows when no filter applied', () => {
    render(<PlaylistsTable playlists={rows} />)
    expect(screen.getByText('Quran Recitations')).toBeInTheDocument()
    expect(screen.getByText('Islamic Lectures')).toBeInTheDocument()
  })

  it('shows empty state when no playlists provided', () => {
    render(<PlaylistsTable playlists={[]} />)
    expect(screen.getByText('No playlists found.')).toBeInTheDocument()
  })

  it('filters to draft rows only', async () => {
    const user = userEvent.setup()
    render(<PlaylistsTable playlists={rows} />)
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      'draft',
    )
    expect(screen.queryByText('Quran Recitations')).not.toBeInTheDocument()
    expect(screen.getByText('Islamic Lectures')).toBeInTheDocument()
  })

  it('filters to published rows only', async () => {
    const user = userEvent.setup()
    render(<PlaylistsTable playlists={rows} />)
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      'published',
    )
    expect(screen.getByText('Quran Recitations')).toBeInTheDocument()
    expect(screen.queryByText('Islamic Lectures')).not.toBeInTheDocument()
  })

  it('title cell links to the edit page', () => {
    render(<PlaylistsTable playlists={rows} />)
    const link = screen.getByRole('link', { name: 'Quran Recitations' })
    expect(link).toHaveAttribute(
      'href',
      '/playlists/aaaaaaaaaaaaaaaaaaaaaaaa/edit',
    )
  })

  it('shows track count per row', () => {
    render(<PlaylistsTable playlists={rows} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
