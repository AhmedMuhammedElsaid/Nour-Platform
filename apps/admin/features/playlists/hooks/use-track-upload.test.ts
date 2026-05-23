import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../actions/create-track.action', () => ({
  createTrackAction: vi.fn(),
}))

import { useTrackUpload } from './use-track-upload'
import { createTrackAction } from '../actions/create-track.action'

// XHR stub — tracks the most-recent instance so tests can drive upload events
class MockXHR {
  static latest: MockXHR | null = null

  upload = { onprogress: null as ((e: ProgressEvent) => void) | null }
  onload: ((e: Event) => void) | null = null
  onerror: (() => void) | null = null
  status = 200

  open = vi.fn()
  setRequestHeader = vi.fn()
  send = vi.fn()

  constructor() {
    MockXHR.latest = this
  }

  simulateProgress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent)
  }
  simulateLoad(status = 200) {
    this.status = status
    this.onload?.(new Event('load'))
  }
  simulateError() {
    this.onerror?.()
  }
}

// Let all pending microtasks drain (one setTimeout tick)
function drain() {
  return new Promise<void>((r) => setTimeout(r, 0))
}

function makeFile(name = 'track.mp3') {
  return new File(['audio'], name, { type: 'audio/mpeg' })
}

describe('useTrackUpload', () => {
  beforeEach(() => {
    MockXHR.latest = null
    vi.stubGlobal('XMLHttpRequest', MockXHR)
    vi.mocked(createTrackAction).mockResolvedValue({ trackId: 'track-1' })
  })

  it('runs the full success flow: uploading → progress → done', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            presignedUrl: 'https://r2.test/put',
            mediaId: 'media-1',
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }),
    )

    const { result } = renderHook(() => useTrackUpload('pl-1'))

    await act(async () => {
      result.current.addFiles([makeFile()])
      await drain()
    })

    expect(result.current.items[0]!.status).toBe('uploading')
    expect(MockXHR.latest).not.toBeNull()

    await act(async () => {
      MockXHR.latest!.simulateProgress(512, 1024)
    })
    expect(result.current.items[0]!.progress).toBe(50)

    await act(async () => {
      MockXHR.latest!.simulateLoad()
      await drain()
    })

    expect(result.current.items[0]!.status).toBe('done')
    expect(result.current.items[0]!.trackId).toBe('track-1')
    expect(result.current.items[0]!.progress).toBe(100)
  })

  it('sets error when presign returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Storage unavailable' }),
    }))

    const { result } = renderHook(() => useTrackUpload('pl-1'))

    await act(async () => {
      result.current.addFiles([makeFile()])
      await drain()
    })

    expect(result.current.items[0]!.status).toBe('error')
    expect(result.current.items[0]!.error).toBe('Storage unavailable')
  })

  it('sets error when XHR network error fires', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        presignedUrl: 'https://r2.test/put',
        mediaId: 'media-1',
      }),
    }))

    const { result } = renderHook(() => useTrackUpload('pl-1'))

    await act(async () => {
      result.current.addFiles([makeFile()])
      await drain()
    })

    await act(async () => {
      MockXHR.latest!.simulateError()
      await drain()
    })

    expect(result.current.items[0]!.status).toBe('error')
    expect(result.current.items[0]!.error).toBe('Network error during upload.')
  })

  it('sets error when confirm returns non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            presignedUrl: 'https://r2.test/put',
            mediaId: 'media-1',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Object not found in bucket' }),
        }),
    )

    const { result } = renderHook(() => useTrackUpload('pl-1'))

    await act(async () => {
      result.current.addFiles([makeFile()])
      await drain()
    })

    await act(async () => {
      MockXHR.latest!.simulateLoad()
      await drain()
    })

    expect(result.current.items[0]!.status).toBe('error')
    expect(result.current.items[0]!.error).toBe('Object not found in bucket')
  })

  it('retry resets error item and re-runs upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'First attempt failed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            presignedUrl: 'https://r2.test/put',
            mediaId: 'media-2',
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }),
    )

    const { result } = renderHook(() => useTrackUpload('pl-1'))

    await act(async () => {
      result.current.addFiles([makeFile()])
      await drain()
    })

    expect(result.current.items[0]!.status).toBe('error')
    const id = result.current.items[0]!.id

    await act(async () => {
      result.current.retry(id)
      await drain()
    })

    expect(result.current.items[0]!.status).toBe('uploading')
  })
})
