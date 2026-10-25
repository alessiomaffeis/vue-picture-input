import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { findButton, flushAsync, mountPictureInput, selectFile } from './helpers/component.js'
import { imageData, makeFile, otherImageData } from './helpers/fixtures.js'
import { nativeFiles } from './helpers/native-files.cjs'

describe('removal and reselection', () => {
  const browser = useBrowserMocks()

  it('clears a selected image and emits only remove', async () => {
    const wrapper = mountPictureInput({ removable: true })
    const file = makeFile()
    await selectFile(wrapper, file)
    browser.finishLoading()
    await flushAsync()
    const input = wrapper.find('input').element
    const clearInput = vi.spyOn(input, 'value', 'set')

    await findButton(wrapper, 'Remove Photo').trigger('click')

    expect(clearInput).toHaveBeenCalledWith('')
    expect(input.type).toBe('file')
    expect(input.value).toBe('')
    expect(wrapper.vm.file).toBeNull()
    expect(wrapper.vm.image).toBe('')
    expect(wrapper.vm.imageObject).toBeNull()
    expect(wrapper.vm.imageSelected).toBe(false)
    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.vm.fileName).toBe('')
    expect(wrapper.vm.fileType).toBe('')
    expect(wrapper.vm.fileSize).toBe(0)
    expect(wrapper.vm.fileModified).toBe(0)
    expect(wrapper.find('.picture-inner').exists()).toBe(true)
    expect(findButton(wrapper, 'Remove Photo')).toBeUndefined()
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.emitted('change')).toEqual([[imageData]])
    expect(wrapper.emitted('prefill')).toBeUndefined()
  })

  it('allows selecting the same file again after removal', async () => {
    const wrapper = mountPictureInput()
    const file = makeFile()
    await selectFile(wrapper, file)
    browser.finishLoading()
    wrapper.vm.removeImage()
    await selectFile(wrapper, file)
    browser.finishLoading()

    expect(wrapper.emitted('change')).toEqual([[imageData], [imageData]])
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.vm.imageSelected).toBe(true)
  })

  it('clears a prefilled image and restores its placeholder', async () => {
    const wrapper = mountPictureInput({ prefill: makeFile(), removable: true, changeOnClick: false })
    browser.finishLoading()
    await flushAsync()
    await findButton(wrapper, 'Remove Photo').trigger('click')

    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.vm.imageSelected).toBe(false)
    expect(wrapper.vm.image).toBe('')
    expect(wrapper.vm.file).toBeNull()
    expect(wrapper.find('.picture-inner').exists()).toBe(true)
    expect(wrapper.emitted('prefill')).toEqual([[]])
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each([
    [true, 'URL'], [true, 'File'], [false, 'URL'], [false, 'File']
  ])('explicit removal clears a selection retained under a prefill (preview=%s, source=%s)', async (preview, source) => {
    if (!preview) browser.disablePreview()
    const wrapper = mountPictureInput({ name: 'photo', removable: true, changeOnClick: false })
    const form = document.createElement('form')
    form.append(wrapper.element)
    const input = wrapper.find('input')
    const selected = makeFile()
    input.element.files = nativeFiles([selected])
    await input.trigger('change')
    if (preview) browser.finishLoading()

    await wrapper.setProps({
      prefill: source === 'URL' ? 'https://example.test/default.png' : makeFile({ name: 'default.png' })
    })
    await flushAsync()
    if (preview) browser.finishLoading({ data: otherImageData })
    await flushAsync()

    expect(input.element.files[0]).toBe(selected)
    expect(new FormData(form).get('photo').name).toBe(selected.name)
    if (preview) expect(wrapper.vm.image).toBe(otherImageData)

    await findButton(wrapper, 'Remove Photo').trigger('click')

    expect(input.element.files).toHaveLength(0)
    expect(input.element.value).toBe('')
    const submitted = new FormData(form).get('photo')
    if (submitted !== null) {
      expect(submitted.name).toBe('')
      expect(submitted.size).toBe(0)
    }
    expect(wrapper.vm.file).toBeNull()
    expect(wrapper.vm.image).toBe('')
    expect(wrapper.vm.imageObject).toBeNull()
    expect(wrapper.vm.imageSelected).toBe(false)
    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.emitted('change')).toHaveLength(1)
    expect(wrapper.emitted('prefill')).toHaveLength(1)
  })

  it('removes and reselects without preview support, emitting an empty image after removal', async () => {
    browser.disablePreview()
    const wrapper = mountPictureInput({ removable: true })
    const file = makeFile()
    await selectFile(wrapper, file)
    await findButton(wrapper, 'Remove Photo').trigger('click')

    expect(wrapper.vm.file).toBeNull()
    expect(wrapper.vm.image).toBe('')
    expect(findButton(wrapper, 'Select a Photo')).toBeDefined()
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.emitted('change')).toEqual([[undefined]])
    expect(browser.readers).toHaveLength(0)

    await selectFile(wrapper, file)

    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.vm.imageSelected).toBe(true)
    expect(wrapper.emitted('change')).toEqual([[undefined], ['']])
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(browser.readers).toHaveLength(0)
  })
})
