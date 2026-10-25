import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { findButton, flushAsync, mountPictureInput, selectFile, setFiles } from './helpers/component.js'
import { imageData, makeFile } from './helpers/fixtures.js'

describe('picker and drag-and-drop interactions', () => {
  const browser = useBrowserMocks()

  it.each([true, false])('opens the picker on an empty preview with changeOnClick=%s', async changeOnClick => {
    const wrapper = mountPictureInput({ changeOnClick })
    const openPicker = vi.spyOn(wrapper.find('input').element, 'click').mockImplementation(() => {})
    await wrapper.find('canvas').trigger('click')

    expect(openPicker).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each([true, false])('honors changeOnClick=%s on a selected image', async changeOnClick => {
    const wrapper = mountPictureInput({ changeOnClick })
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    const openPicker = vi.spyOn(wrapper.find('input').element, 'click').mockImplementation(() => {})
    await wrapper.find('canvas').trigger('click')

    expect(openPicker).toHaveBeenCalledTimes(changeOnClick ? 1 : 0)
    expect(wrapper.emitted('click')).toEqual([[]])
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it.each([true, false])('honors changeOnClick=%s on a prefilled image', async changeOnClick => {
    const wrapper = mountPictureInput({ prefill: makeFile(), changeOnClick })
    browser.finishLoading()
    const openPicker = vi.spyOn(wrapper.find('input').element, 'click').mockImplementation(() => {})
    await wrapper.find('canvas').trigger('click')

    expect(openPicker).toHaveBeenCalledTimes(changeOnClick ? 1 : 0)
    expect(wrapper.emitted('click')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('supports selecting with the Enter key', async () => {
    const wrapper = mountPictureInput()
    const openPicker = vi.spyOn(wrapper.find('input').element, 'click').mockImplementation(() => {})
    await wrapper.find('canvas').trigger('keyup', { key: 'Enter', keyCode: 13 })
    expect(openPicker).toHaveBeenCalledTimes(1)
  })

  it.each([true, false])('opens the change button picker with clicks disabled and preview=%s', async preview => {
    if (!preview) vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({ changeOnClick: false })
    await selectFile(wrapper, makeFile())
    if (preview) browser.finishLoading()
    await flushAsync()
    const openPicker = vi.spyOn(wrapper.find('input').element, 'click').mockImplementation(() => {})
    await findButton(wrapper, 'Change Photo').trigger('click')
    expect(openPicker).toHaveBeenCalledTimes(1)
  })

  it('highlights supported drag targets and clears the highlight on leaving', async () => {
    const wrapper = mountPictureInput({}, { supportsDragAndDrop: () => true })
    await wrapper.find('canvas').trigger('dragenter')
    expect(wrapper.find('canvas').classes()).toContain('dragging-over')
    await wrapper.find('canvas').trigger('dragleave')
    expect(wrapper.find('canvas').classes()).not.toContain('dragging-over')
  })

  it('does not highlight drag targets when drag-and-drop is unsupported', async () => {
    const wrapper = mountPictureInput({}, { supportsDragAndDrop: () => false })
    await wrapper.find('canvas').trigger('dragenter')
    expect(wrapper.vm.draggingOver).toBe(false)
    expect(wrapper.find('canvas').classes()).not.toContain('dragging-over')
  })

  it('prevents the browser default dragover action', () => {
    const wrapper = mountPictureInput()
    const event = new Event('dragover', { bubbles: true, cancelable: true })
    wrapper.find('canvas').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('loads dropped files through the same decoded change path', async () => {
    const wrapper = mountPictureInput({}, { supportsDragAndDrop: () => true })
    const file = makeFile()
    const files = [file]
    const input = wrapper.find('input').element
    setFiles(input, [])
    await wrapper.find('canvas').trigger('dragenter')
    await wrapper.find('canvas').trigger('drop', { dataTransfer: { files } })

    expect(input.files).toBe(files)
    expect(wrapper.vm.draggingOver).toBe(false)
    expect(wrapper.emitted('change')).toBeUndefined()
    browser.finishLoading()

    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.emitted('change')).toEqual([[imageData]])
    expect(wrapper.emitted('prefill')).toBeUndefined()
  })

  it.each(['fileType', 'fileSize'])('validates dropped files for %s', async errorType => {
    const wrapper = mountPictureInput({ size: 1, alertOnError: false })
    const file = errorType === 'fileType'
      ? makeFile({ name: 'bad.txt', type: 'text/plain' })
      : makeFile({ size: 1024 * 1024 + 1 })
    setFiles(wrapper.find('input').element, [])
    await wrapper.find('canvas').trigger('drop', { dataTransfer: { files: [file] } })

    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.emitted('error')[0][0].type).toBe(errorType)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(browser.readers).toHaveLength(0)
    expect(browser.alert).not.toHaveBeenCalled()
  })
})
