import { describe, expect, it } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { mountPictureInput, selectFile } from './helpers/component.js'
import { imageData, jpegWithExif, jpegWithoutExif, makeFile, pngBytes } from './helpers/fixtures.js'

describe('EXIF orientation', () => {
  const browser = useBrowserMocks()

  it.each([
    [1, true], [3, true], [6, true], [8, true],
    [1, false], [3, false], [6, false], [8, false]
  ])('reads orientation %s with littleEndian=%s', async (orientation, littleEndian) => {
    const wrapper = mountPictureInput()
    const file = new File([jpegWithExif(orientation, littleEndian)], 'photo.jpeg', { type: 'image/jpeg' })
    await selectFile(wrapper, file)
    browser.finishEXIF(jpegWithExif(orientation, littleEndian))

    const expectedRotation = { 1: false, 3: -Math.PI, 6: Math.PI / 2, 8: -Math.PI / 2 }
    expect(wrapper.vm.rotate).toBe(expectedRotation[orientation])
    browser.finishDataURL()
    browser.images[0].finish()
    expect(wrapper.emitted('change')).toEqual([[imageData]])
  })

  it.each([
    ['PNG', () => pngBytes.buffer, 'image/png'],
    ['JPEG without EXIF', () => jpegWithoutExif, 'image/jpeg'],
    ['EXIF without an orientation tag', () => jpegWithExif(1, true, 0x0100), 'image/jpeg']
  ])('loads %s without rotation', async (kind, source, type) => {
    const buffer = source()
    const wrapper = mountPictureInput()
    await selectFile(wrapper, new File([buffer], 'photo', { type }))
    browser.finishLoading({ buffer })

    expect(wrapper.vm.rotate).toBe(false)
    expect(browser.context.rotate).not.toHaveBeenCalled()
    expect(wrapper.emitted('change')).toEqual([[imageData]])
  })

  it.each([false, true])('avoids double rotation when native image orientation is supported: %s', async nativeOrientation => {
    const wrapper = mountPictureInput({ width: 400, height: 200 })
    await selectFile(wrapper, makeFile({ name: 'photo.jpeg', type: 'image/jpeg' }))
    browser.finishEXIF(jpegWithExif(6))
    browser.finishDataURL()
    if (nativeOrientation) browser.images[0].style.imageOrientation = 'from-image'
    browser.images[0].finish()

    if (nativeOrientation) {
      expect(browser.context.rotate).not.toHaveBeenCalled()
    } else {
      expect(browser.context.rotate).toHaveBeenCalledExactlyOnceWith(Math.PI / 2)
      expect(browser.context.translate).toHaveBeenCalledTimes(2)
    }
    expect(wrapper.emitted('change')).toEqual([[imageData]])
  })

  it('limits the EXIF read to the first 64 KiB', async () => {
    const wrapper = mountPictureInput()
    await selectFile(wrapper, makeFile({ size: 1024 * 1024 }))
    expect(browser.readers[0].kind).toBe('arrayBuffer')
    expect(browser.readers[0].blob.size).toBe(65536)
  })
})
