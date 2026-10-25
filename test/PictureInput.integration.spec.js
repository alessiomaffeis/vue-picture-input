import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import {
  findButton, flushAsync, mountPictureInput, mountWithParent, selectFile, unmount
} from './helpers/component.js'
import { imageData, makeFile, otherImageData } from './helpers/fixtures.js'

describe('mounted parent integration', () => {
  const browser = useBrowserMocks()

  it('delivers one decoded image per selection and exposes the matching refs', async () => {
    const change = vi.fn()
    const parent = mountWithParent({}, { change })
    const file = makeFile()
    await selectFile(parent, file)

    expect(change).not.toHaveBeenCalled()
    browser.finishEXIF()
    browser.finishDataURL()
    expect(change).not.toHaveBeenCalled()
    browser.images[0].finish()

    expect(change).toHaveBeenCalledExactlyOnceWith(imageData)
    expect(parent.vm.$refs.pictureInput.image).toBe(imageData)
    expect(parent.vm.$refs.pictureInput.file).toBe(file)

    const replacement = makeFile({ name: 'replacement.png' })
    await selectFile(parent, replacement)
    expect(change).toHaveBeenCalledTimes(1)
    browser.finishLoading({ data: otherImageData })

    expect(change.mock.calls).toEqual([[imageData], [otherImageData]])
    expect(parent.vm.$refs.pictureInput.image).toBe(otherImageData)
    expect(parent.vm.$refs.pictureInput.file).toBe(replacement)
  })

  it('does not leak the native input change event to ancestor listeners', async () => {
    const change = vi.fn()
    const nativeChange = vi.fn()
    const parent = mountWithParent({}, { change })
    parent.element.addEventListener('change', nativeChange)

    await selectFile(parent, makeFile())
    browser.finishLoading()

    expect(nativeChange).not.toHaveBeenCalled()
    expect(change).toHaveBeenCalledExactlyOnceWith(imageData)
    parent.element.removeEventListener('change', nativeChange)
  })

  it('emits prefill, not change, to a parent during default-image loading', async () => {
    const prefill = vi.fn()
    const change = vi.fn()
    const parent = mountWithParent({ prefill: makeFile() }, { prefill, change })
    await nextTick()
    browser.finishLoading()

    expect(prefill).toHaveBeenCalledExactlyOnceWith()
    expect(change).not.toHaveBeenCalled()
    expect(parent.vm.$refs.pictureInput.image).toBe(imageData)
  })

  it('delivers remove and error once to the parent without extra changes', async () => {
    const remove = vi.fn()
    const error = vi.fn()
    const change = vi.fn()
    const parent = mountWithParent({ removable: true, alertOnError: false }, { remove, error, change })
    await selectFile(parent, makeFile())
    browser.finishLoading()
    await flushAsync()
    await findButton(parent, 'Remove Photo').trigger('click')
    await selectFile(parent, makeFile({ name: 'bad.txt', type: 'text/plain' }))

    expect(remove).toHaveBeenCalledExactlyOnceWith()
    expect(error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      type: 'fileType', message: expect.any(String)
    }))
    expect(change).toHaveBeenCalledExactlyOnceWith(imageData)
    expect(parent.vm.$refs.pictureInput.file).toBeNull()
  })

  it('delivers a picture click once, rather than both native and component events', async () => {
    const click = vi.fn()
    const parent = mountWithParent({ changeOnClick: false }, { click })
    await selectFile(parent, makeFile())
    browser.finishLoading()
    await parent.find('canvas').trigger('click')

    expect(click).toHaveBeenCalledExactlyOnceWith()
  })

  it('cleans up the resize subscription when unmounted', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountPictureInput()
    await nextTick()
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    const resizeCalls = addListener.mock.calls.filter(([event]) => event === 'resize')
    expect(resizeCalls).toHaveLength(1)
    const listener = resizeCalls[0][1]

    unmount(wrapper)
    expect(removeListener).toHaveBeenCalledWith('resize', listener)
    browser.context.drawImage.mockClear()
    browser.containerWidth = 320
    window.dispatchEvent(new Event('resize'))
    expect(browser.context.drawImage).not.toHaveBeenCalled()
  })

  it('loads a real FileReader result before notifying the parent', async () => {
    vi.stubGlobal('FileReader', browser.NativeFileReader)
    const change = vi.fn()
    const parent = mountWithParent({}, { change })
    await selectFile(parent, makeFile())

    await vi.waitFor(() => expect(browser.images).toHaveLength(1))
    expect(change).not.toHaveBeenCalled()
    expect(browser.images[0].src).toBe(imageData)
    browser.images[0].finish()
    expect(change).toHaveBeenCalledExactlyOnceWith(imageData)
  })
})
