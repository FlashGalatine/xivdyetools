/**
 * Unit tests for the AbortController-based fetch wrapper.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchWithTimeout } from './fetchWithTimeout'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fetchWithTimeout', () => {
  it('resolves with the fetch response on success', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const response = await fetchWithTimeout('http://example.test/')
    expect(response).toBe(mockResponse)
  })

  it('passes options through and attaches an abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)

    await fetchWithTimeout('http://example.test/', { method: 'POST' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://example.test/')
    expect(init.method).toBe('POST')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('converts an abort into a timeout error message', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      })
    )

    const promise = fetchWithTimeout('http://example.test/', {}, 50)
    const assertion = expect(promise).rejects.toThrow('Request timeout after 50ms')
    await vi.advanceTimersByTimeAsync(60)
    await assertion
  })

  it('re-throws non-abort errors unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))

    await expect(fetchWithTimeout('http://example.test/')).rejects.toThrow('network down')
  })
})
