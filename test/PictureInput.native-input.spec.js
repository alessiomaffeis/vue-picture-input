import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { mountPictureInput } from './helpers/component.js'
import { imageData, makeFile } from './helpers/fixtures.js'
import { nativeFiles } from './helpers/native-files.js'

describe('rejected native form selections', () => {
  const browser = useBrowserMocks()

  it.each([
    [true, 'picker', 'fileType'], [true, 'picker', 'fileSize'],
    [false, 'picker', 'fileType'], [false, 'picker', 'fileSize'],
    [true, 'drop', 'fileType'], [true, 'drop', 'fileSize'],
    [false, 'drop', 'fileType'], [false, 'drop', 'fileSize']
  ])('clears rejected files with preview=%s, route=%s, error=%s', async (preview, route, errorType) => {
    if (!preview) vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({ name: 'photo', size: 1, alertOnError: false })
    const form = document.createElement('form')
    form.append(wrapper.element)
    const input = wrapper.find('input')
    const accepted = makeFile()
    input.element.files = nativeFiles([accepted])
    await input.trigger('change')
    if (preview) browser.finishLoading()
    expect(new FormData(form).get('photo').name).toBe(accepted.name)

    const rejected = errorType === 'fileType'
      ? makeFile({ name: 'rejected.txt', type: 'text/plain' })
      : makeFile({ name: 'too-large.png', size: 1024 * 1024 + 1 })
    const files = nativeFiles([rejected])
    if (route === 'drop') {
      // The no-preview branch has no drop target; use its same event handler.
      if (preview) await wrapper.find('canvas').trigger('drop', { dataTransfer: { files } })
      else wrapper.vm.onFileDrop({ target: {}, dataTransfer: { files } })
    } else {
      input.element.files = files
      await input.trigger('change')
    }

    expect(input.element.files).toHaveLength(0)
    expect(input.element.value).toBe('')
    const submitted = new FormData(form).get('photo')
    if (submitted !== null) {
      expect(submitted.name).toBe('')
      expect(submitted.size).toBe(0)
    }
    expect(wrapper.vm.file).toBe(accepted)
    if (preview) expect(wrapper.vm.image).toBe(imageData)
    expect(wrapper.emitted('error')[0][0].type).toBe(errorType)
    expect(wrapper.emitted('change')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toBeUndefined()

    input.element.files = nativeFiles([accepted])
    await input.trigger('change')
    expect(new FormData(form).get('photo').name).toBe(accepted.name)
  })

  it.each(['fileSize', 'fileType'])('leaves a native selection untouched on prefill %s rejection', async errorType => {
    const wrapper = mountPictureInput({ name: 'photo', size: 1, alertOnError: false })
    const input = wrapper.find('input')
    const accepted = makeFile()
    input.element.files = nativeFiles([accepted])
    await input.trigger('change')
    browser.finishLoading()

    const rejected = errorType === 'fileType'
      ? makeFile({ name: 'bad.txt', type: 'text/plain' })
      : makeFile({ size: 1024 * 1024 + 1 })
    wrapper.vm.onFileChange({ target: { files: [rejected] } }, true)

    expect(input.element.files[0]).toBe(accepted)
    expect(wrapper.vm.file).toBe(accepted)
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('error')[0][0].type).toBe(errorType)
  })
})
