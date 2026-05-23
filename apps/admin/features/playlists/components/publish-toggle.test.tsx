import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions/toggle-publish.action', () => ({
  togglePublishAction: vi.fn(),
}))

import { PublishToggle } from './publish-toggle'
import { togglePublishAction } from '../actions/toggle-publish.action'

describe('PublishToggle', () => {
  it('shows Published status and Unpublish button when published', () => {
    render(<PublishToggle playlistId="pl-1" initialStatus="published" />)
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unpublish/i })).toBeInTheDocument()
  })

  it('shows Draft status and Publish button when draft', () => {
    render(<PublishToggle playlistId="pl-1" initialStatus="draft" />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^publish playlist$/i })).toBeInTheDocument()
  })

  it('toggles to published when Publish is clicked', async () => {
    vi.mocked(togglePublishAction).mockResolvedValue({ status: 'published' })
    const user = userEvent.setup()

    render(<PublishToggle playlistId="pl-1" initialStatus="draft" />)
    await user.click(screen.getByRole('button', { name: /^publish playlist$/i }))

    expect(togglePublishAction).toHaveBeenCalledWith('pl-1', 'draft')
    expect(await screen.findByText('Published')).toBeInTheDocument()
  })

  it('toggles to draft when Unpublish is clicked', async () => {
    vi.mocked(togglePublishAction).mockResolvedValue({ status: 'draft' })
    const user = userEvent.setup()

    render(<PublishToggle playlistId="pl-1" initialStatus="published" />)
    await user.click(screen.getByRole('button', { name: /unpublish playlist/i }))

    expect(togglePublishAction).toHaveBeenCalledWith('pl-1', 'published')
    expect(await screen.findByText('Draft')).toBeInTheDocument()
  })

  it('shows error message when action fails', async () => {
    vi.mocked(togglePublishAction).mockResolvedValue({ error: 'Playlist not found' })
    const user = userEvent.setup()

    render(<PublishToggle playlistId="pl-1" initialStatus="draft" />)
    await user.click(screen.getByRole('button', { name: /^publish playlist$/i }))

    expect(await screen.findByText('Playlist not found')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })
})
