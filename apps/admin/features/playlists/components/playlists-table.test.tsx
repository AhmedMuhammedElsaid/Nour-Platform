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
import type { PlaylistRow } from './playlists-table'

const rows: PlaylistRow[] = [
  {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    ar: { title: 'تلاوات قرآنية', slug: 'تلاوات-قرآنية' },
    en: { title: 'Quran Recitations', slug: 'quran-recitations' },
    status: 'published',
    categoryIds: [],
    order: 0,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'eeeeeeeeeeeeeeeeeeeeeeee',
    ar: { title: 'محاضرات إسلامية', slug: 'محاضرات-إسلامية' },
    en: { title: 'Islamic Lectures', slug: 'islamic-lectures' },
    status: 'draft',
    categoryIds: [],
    order: 1,
    createdAt: '2024-02-20T00:00:00.000Z',
    updatedAt: '2024-02-20T00:00:00.000Z',
  },
]

describe('PlaylistsTable', () => {
  it('renders all rows when no filter applied', () => {
    render(<PlaylistsTable playlists={rows} />)
    expect(screen.getByText('تلاوات قرآنية')).toBeInTheDocument()
    expect(screen.getByText('محاضرات إسلامية')).toBeInTheDocument()
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
    expect(screen.queryByText('تلاوات قرآنية')).not.toBeInTheDocument()
    expect(screen.getByText('محاضرات إسلامية')).toBeInTheDocument()
  })

  it('filters to published rows only', async () => {
    const user = userEvent.setup()
    render(<PlaylistsTable playlists={rows} />)
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      'published',
    )
    expect(screen.getByText('تلاوات قرآنية')).toBeInTheDocument()
    expect(screen.queryByText('محاضرات إسلامية')).not.toBeInTheDocument()
  })

  it('AR title cell links to the edit page', () => {
    render(<PlaylistsTable playlists={rows} />)
    const link = screen.getByRole('link', { name: 'تلاوات قرآنية' })
    expect(link).toHaveAttribute(
      'href',
      '/playlists/aaaaaaaaaaaaaaaaaaaaaaaa/edit',
    )
  })

  it('displays EN titles in the second column', () => {
    render(<PlaylistsTable playlists={rows} />)
    expect(screen.getByText('Quran Recitations')).toBeInTheDocument()
    expect(screen.getByText('Islamic Lectures')).toBeInTheDocument()
  })
})
