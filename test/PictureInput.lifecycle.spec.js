import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { flushAsync, mountPictureInput, selectFile, unmount } from './helpers/component.js'
import { imageData, makeFile, pngBytes } from './helpers/fixtures.js'

function deferred () {
  let resolve, reject
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject })
  return { promise, resolve, reject }
}

describe('initialization and asynchronous cleanup', () => {
  const browser = useBrowserMocks()

  it('cannot attach a deferred resize subscription after immediate unmount', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountPictureInput()
    unmount(wrapper)
    await nextTick()
    const subscriptions = add.mock.calls.filter(([event]) => event === 'resize')
    expect(subscriptions).toHaveLength(1)
    expect(remove.mock.calls.filter(([event]) => event === 'resize')).toEqual(subscriptions)
    window.dispatchEvent(new Event('resize'))
    expect(browser.context.drawImage).not.toHaveBeenCalled()
  })

  it.each(['EXIF', 'data URI'])('aborts pending %s reads and ignores already queued callbacks', async stage => {
    const wrapper = mountPictureInput()
    const picture = wrapper.vm
    await selectFile(wrapper, makeFile())
    if (stage === 'data URI') browser.finishEXIF()
    const reader = browser.readers.at(-1)
    const queued = reader.onload
    const readerCount = browser.readers.length
    unmount(wrapper)
    expect(reader.abort).toHaveBeenCalledTimes(1)
    expect(reader.aborted).toBe(true)
    expect(reader.onload).toBeNull()
    reader.result = stage === 'EXIF' ? pngBytes.buffer : imageData
    queued({ target: reader })
    expect(browser.readers).toHaveLength(readerCount)
    expect(browser.images).toHaveLength(0)
    expect(picture.image).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(browser.context.drawImage).not.toHaveBeenCalled()
  })

  it('detaches image decoding and ignores an already queued decode callback', async () => {
    const wrapper = mountPictureInput()
    await selectFile(wrapper, makeFile())
    browser.finishEXIF()
    browser.finishDataURL()
    const image = browser.images[0]
    const queued = image.onload
    unmount(wrapper)
    expect(image.onload).toBeNull()
    expect(image.removeAttribute).toHaveBeenCalledWith('src')
    queued()
    image.finish()
    expect(browser.context.drawImage).not.toHaveBeenCalled()
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('error')).toBeUndefined()
  })

  it.each([true, false])('ignores queued fetch responses after unmount (AbortController=%s)', async abortable => {
    if (!abortable) vi.stubGlobal('AbortController', undefined)
    const request = deferred()
    browser.fetch.mockReturnValue(request.promise)
    const wrapper = mountPictureInput({ prefill: 'https://example.test/default.png' })
    const picture = wrapper.vm
    const signal = browser.fetch.mock.calls[0][1].signal
    unmount(wrapper)
    if (abortable) expect(signal.aborted).toBe(true)
    else expect(signal).toBeUndefined()
    const blob = vi.fn().mockResolvedValue(new Blob([pngBytes], { type: 'image/png' }))
    request.resolve({ ok: true, status: 200, blob })
    await flushAsync()
    expect(blob).not.toHaveBeenCalled()
    expect(browser.readers).toHaveLength(0)
    expect(picture.file).toBeUndefined()
    expect(wrapper.emitted()).toEqual({})
    expect(browser.alert).not.toHaveBeenCalled()
  })

  it('ignores a blob response that completes after unmount', async () => {
    const body = deferred()
    const blob = vi.fn().mockReturnValue(body.promise)
    browser.fetch.mockResolvedValue({ ok: true, status: 200, blob })
    const wrapper = mountPictureInput({ prefill: 'https://example.test/default.png' })
    const picture = wrapper.vm
    await flushAsync()
    expect(blob).toHaveBeenCalledTimes(1)
    unmount(wrapper)
    expect(browser.fetch.mock.calls[0][1].signal.aborted).toBe(true)
    body.resolve(new Blob([pngBytes], { type: 'image/png' }))
    await flushAsync()
    expect(picture.file).toBeUndefined()
    expect(browser.readers).toHaveLength(0)
    expect(wrapper.emitted()).toEqual({})
  })

  it('treats deliberate fetch cancellation as silent', async () => {
    browser.fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
    }))
    const wrapper = mountPictureInput({ prefill: 'https://example.test/default.png' })
    unmount(wrapper)
    await flushAsync()
    expect(wrapper.emitted()).toEqual({})
    expect(browser.alert).not.toHaveBeenCalled()
  })

  it('aborts only the unmounted instance’s pending fetch', async () => {
    const firstRequest = deferred()
    const secondRequest = deferred()
    browser.fetch.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise)
    const first = mountPictureInput({ prefill: 'https://example.test/first.png' })
    const second = mountPictureInput({ prefill: 'https://example.test/second.png' })
    const [firstSignal, secondSignal] = browser.fetch.mock.calls.map(([, options]) => options.signal)
    unmount(first)
    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(false)
    const response = { ok: true, status: 200, blob: async () => new Blob([pngBytes], { type: 'image/png' }) }
    firstRequest.resolve(response)
    secondRequest.resolve(response)
    await flushAsync()
    expect(browser.readers).toHaveLength(1)
    browser.finishLoading()
    expect(first.emitted()).toEqual({})
    expect(second.emitted('prefill')).toEqual([[]])
    expect(second.vm.image).toBe(imageData)
  })

  it.each(['missing', 'throwing'])('retains the %s File-constructor fallback', async kind => {
    vi.stubGlobal('File', kind === 'missing' ? undefined : class {
      constructor () { throw new TypeError('File is not constructible') }
    })
    const wrapper = mountPictureInput({
      prefill: 'https://example.test/default.png', prefillOptions: { fileName: 'fallback.png' }
    })
    await flushAsync()
    expect(wrapper.vm.file).toBeInstanceOf(Blob)
    expect(wrapper.vm.fileName).toBe('fallback.png')
    expect(wrapper.vm.fileModified).toBeTypeOf('number')
    expect(wrapper.vm.file.lastModifiedDate).toBeInstanceOf(Date)
    browser.finishLoading()
    expect(wrapper.emitted('prefill')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
