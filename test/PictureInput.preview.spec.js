import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { findButton, flushAsync, mountPictureInput, selectFile } from './helpers/component.js'
import { imageData, makeFile } from './helpers/fixtures.js'

describe('preview geometry and aspect ratio', () => {
  const browser = useBrowserMocks()

  it.each([
    [true, 400, 200, -100, 0, 400, 200],
    [true, 200, 400, 0, -100, 200, 400],
    [true, 200, 200, 0, 0, 200, 200],
    [false, 400, 200, 0, 50, 200, 100],
    [false, 200, 400, 50, 0, 100, 200],
    [false, 200, 200, 0, 0, 200, 200]
  ])('centers crop=%s for a %sx%s image', async (crop, width, height, x, y, drawnWidth, drawnHeight) => {
    const wrapper = mountPictureInput({ crop, width: 200, height: 200 })
    const file = makeFile()
    await selectFile(wrapper, file)
    const image = browser.finishLoading({ width, height })

    expect(browser.context.drawImage).toHaveBeenLastCalledWith(image, x, y, drawnWidth, drawnHeight)
    expect(wrapper.vm.file).toBe(file)
    expect(file.size).toBe(4)
    expect(wrapper.vm.image).toBe(imageData)
    expect(wrapper.emitted('change')).toEqual([[imageData]])
  })

  it.each([
    [true, 800, 200, -200, 0, 800, 200],
    [true, 200, 400, 0, -300, 400, 800],
    [false, 800, 200, 0, 50, 400, 100],
    [false, 200, 400, 150, 0, 100, 200]
  ])('centers crop=%s for a %sx%s image in a 400x200 preview', async (crop, width, height, x, y, drawnWidth, drawnHeight) => {
    const wrapper = mountPictureInput({ crop, width: 400, height: 200 })
    const file = makeFile()
    await selectFile(wrapper, file)
    const image = browser.finishLoading({ width, height })

    expect(browser.context.drawImage).toHaveBeenLastCalledWith(image, x, y, drawnWidth, drawnHeight)
    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.vm.image).toBe(imageData)
    expect(wrapper.emitted('change')).toEqual([[imageData]])
  })

  it('defaults to a square preview as wide as the container', async () => {
    const wrapper = mountPictureInput()
    await nextTick()
    expect(wrapper.vm.canvasWidth).toBe(640)
    expect(wrapper.vm.canvasHeight).toBe(640)
    expect(wrapper.vm.previewWidth).toBe(640)
    expect(wrapper.vm.previewHeight).toBe(640)
  })

  it('defaults height to an explicitly specified width', async () => {
    const wrapper = mountPictureInput({ width: 320 })
    await nextTick()
    expect(wrapper.vm.previewWidth).toBe(320)
    expect(wrapper.vm.previewHeight).toBe(320)
  })

  it('accepts numeric strings for dimensions and margins', async () => {
    browser.containerWidth = 300
    const wrapper = mountPictureInput({ width: '400', height: '200', margin: '10' })
    await nextTick()
    expect(wrapper.vm.previewWidth).toBe(280)
    expect(wrapper.vm.previewHeight).toBe(140)
  })

  it('uses the container width when only height is specified', async () => {
    browser.containerWidth = 300
    const wrapper = mountPictureInput({ height: 150 })
    await nextTick()
    expect(wrapper.vm.previewWidth).toBe(300)
    expect(wrapper.vm.previewHeight).toBe(150)
  })

  it('respects margins and maximum dimensions on resize without changing the file', async () => {
    browser.containerWidth = 300
    const wrapper = mountPictureInput({ width: 400, height: 200, margin: 10 })
    const file = makeFile()
    await selectFile(wrapper, file)
    browser.finishLoading()
    expect(wrapper.vm.previewWidth).toBe(280)
    expect(wrapper.vm.previewHeight).toBe(140)

    browser.containerWidth = 200
    window.dispatchEvent(new Event('resize'))
    expect(wrapper.vm.previewWidth).toBe(180)
    expect(wrapper.vm.previewHeight).toBe(90)

    browser.containerWidth = 800
    window.dispatchEvent(new Event('resize'))
    expect(wrapper.vm.previewWidth).toBe(400)
    expect(wrapper.vm.previewHeight).toBe(200)
    expect(browser.context.drawImage).toHaveBeenCalledTimes(3)
    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.vm.image).toBe(imageData)
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('keeps the previous dimensions when the container is temporarily hidden', async () => {
    const wrapper = mountPictureInput({ width: 400, height: 200 })
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    browser.context.drawImage.mockClear()
    browser.containerWidth = 0
    window.dispatchEvent(new Event('resize'))

    expect(wrapper.vm.previewWidth).toBe(400)
    expect(wrapper.vm.previewHeight).toBe(200)
    expect(browser.context.drawImage).not.toHaveBeenCalled()
  })

  it('scales the canvas backing buffer and drawing for high-density displays', async () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const wrapper = mountPictureInput({ width: 200, height: 200 })
    await selectFile(wrapper, makeFile())
    const image = browser.finishLoading()

    expect(browser.context.scale).toHaveBeenCalledWith(2, 2)
    expect(wrapper.find('canvas').element.width).toBe(400)
    expect(wrapper.find('canvas').element.height).toBe(400)
    expect(browser.context.drawImage).toHaveBeenLastCalledWith(image, -200, 0, 800, 400)
  })

  it.each([
    [false, 400, 200, false],
    [true, 400, 200, true],
    [true, 400, 400, false],
    [true, 400, '400', false],
    [true, 400, undefined, false]
  ])('shows aspect controls with toggle=%s and dimensions %sx%s: %s', async (toggleAspectRatio, width, height, visible) => {
    const wrapper = mountPictureInput({ toggleAspectRatio, width, height })
    expect(findButton(wrapper, 'Landscape/Portrait')).toBeUndefined()
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    await flushAsync()
    expect(Boolean(findButton(wrapper, 'Landscape/Portrait'))).toBe(visible)
  })

  it('toggles the canvas aspect ratio without changing the underlying image', async () => {
    const wrapper = mountPictureInput({ width: 400, height: 200, toggleAspectRatio: true })
    const file = makeFile()
    await selectFile(wrapper, file)
    browser.finishLoading()
    await flushAsync()
    await findButton(wrapper, 'Landscape/Portrait').trigger('click')

    expect(wrapper.vm.canvasWidth).toBe(200)
    expect(wrapper.vm.canvasHeight).toBe(400)
    expect(wrapper.vm.previewWidth).toBe(200)
    expect(wrapper.vm.previewHeight).toBe(400)
    expect(wrapper.emitted('aspectratiochange')).toEqual([['portrait']])
    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.vm.image).toBe(imageData)
    expect(wrapper.emitted('change')).toHaveLength(1)

    await findButton(wrapper, 'Landscape/Portrait').trigger('click')
    expect(wrapper.vm.canvasWidth).toBe(400)
    expect(wrapper.vm.canvasHeight).toBe(200)
    expect(wrapper.emitted('aspectratiochange')).toEqual([['portrait'], ['landscape']])
    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it.each([
    [false, 200, 400, 400, 200],
    [true, 400, 200, 400, 200],
    [true, 200, 400, 200, 400]
  ])('autoToggle=%s handles a %sx%s image', async (autoToggleAspectRatio, width, height, expectedWidth, expectedHeight) => {
    const wrapper = mountPictureInput({ width: 400, height: 200, autoToggleAspectRatio })
    await selectFile(wrapper, makeFile())
    browser.finishLoading({ width, height })

    expect(wrapper.vm.canvasWidth).toBe(expectedWidth)
    expect(wrapper.vm.canvasHeight).toBe(expectedHeight)
    expect(wrapper.emitted('change')).toEqual([[imageData]])
    expect(wrapper.emitted('aspectratiochange')).toBeUndefined()
  })

  it('compares numeric-string dimensions numerically when matching image orientation', async () => {
    const wrapper = mountPictureInput({ width: '800', height: '1000', autoToggleAspectRatio: true })
    await selectFile(wrapper, makeFile())
    browser.finishLoading({ width: 800, height: 1000 })

    expect(wrapper.vm.canvasWidth).toBe(800)
    expect(wrapper.vm.canvasHeight).toBe(1000)
    expect(wrapper.emitted('change')).toEqual([[imageData]])
  })
})
