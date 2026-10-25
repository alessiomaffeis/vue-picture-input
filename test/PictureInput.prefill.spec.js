import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { flushAsync, mountPictureInput, selectFile } from './helpers/component.js'
import { imageData, makeFile, otherImageData, pngBytes } from './helpers/fixtures.js'
import { nativeFiles } from './helpers/native-files.js'

describe('prefill lifecycle', () => {
  const browser = useBrowserMocks()

  it.each([
    ['URL', () => 'https://example.test/photo.png'],
    ['data URI', () => imageData],
    ['File', () => makeFile()],
    ['Blob', () => new Blob([pngBytes], { type: 'image/png' })]
  ])('prefills from a %s without changing the native input', async (kind, source) => {
    const prefill = source()
    const wrapper = mountPictureInput({ prefill })
    await flushAsync()

    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
    browser.finishEXIF()
    browser.finishDataURL()
    expect(wrapper.emitted('prefill')).toBeUndefined()
    browser.images[0].finish()
    await flushAsync()

    expect(wrapper.emitted('prefill')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.vm.image).toBe(imageData)
    expect(wrapper.vm.imagePreloaded).toBe(true)
    expect(wrapper.vm.imageSelected).toBe(false)
    expect(wrapper.find('.picture-inner').exists()).toBe(false)
    expect(wrapper.find('input').element.value).toBe('')
    expect(wrapper.find('input').element.files).toHaveLength(0)

    if (typeof prefill === 'object') {
      expect(browser.fetch).not.toHaveBeenCalled()
    } else if (kind === 'data URI') {
      expect(browser.fetch.mock.calls[0][0]).toBe(prefill)
    } else {
      const [url, request] = browser.fetch.mock.calls[0]
      expect(url).toMatch(/^https:\/\/example\.test\/photo\.png\?/)
      expect(request.mode).toBe('cors')
      expect(request.headers.get('Accept')).toBe('image/*')
    }
  })

  it.each([
    [{ fileName: 'custom.gif' }, 'image/gif', 'custom.gif', 'image/gif'],
    [{ fileName: 'photo.dat', fileType: 'jpg' }, '', 'photo.dat', 'image/jpeg'],
    [{ fileName: 'photo.jpeg', mediaType: 'image/jpeg', fileType: 'gif' }, 'image/png', 'photo.jpeg', 'image/jpeg'],
    [{ fileName: 'drawing.svg', mediaType: 'image/svg+xml' }, '', 'drawing.svg', 'image/svg+xml'],
    [{ fileName: 'drawing.svg', mediaType: 'image/svg' }, '', 'drawing.svg', 'image/svg+xml']
  ])('honors prefillOptions %j', async (prefillOptions, type, name, expectedType) => {
    browser.fetch.mockResolvedValue({
      ok: true, status: 200, blob: async () => new Blob([pngBytes], { type })
    })
    const wrapper = mountPictureInput({ prefill: imageData, prefillOptions })
    await flushAsync()

    expect(wrapper.vm.file.name).toBe(name)
    expect(wrapper.vm.file.type).toBe(expectedType)
    browser.finishLoading()
    expect(wrapper.emitted('prefill')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(prefillOptions.fileName).toBe(name)
  })

  it('loads a new prefill when the prop changes', async () => {
    const wrapper = mountPictureInput({ prefill: 'https://example.test/first.png' })
    await flushAsync()
    browser.finishLoading()

    await wrapper.setProps({ prefill: 'https://example.test/second.png' })
    await flushAsync()
    browser.finishLoading({ data: otherImageData })

    expect(browser.fetch).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.image).toBe(otherImageData)
    expect(wrapper.emitted('prefill')).toHaveLength(2)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.find('input').element.files).toHaveLength(0)
  })

  const sources = [
    ['URL', () => 'https://example.test/default.png'],
    ['data URI', () => otherImageData],
    ['File', () => makeFile({ name: 'default.png', lastModified: 42 })],
    ['Blob', () => new Blob([pngBytes], { type: 'image/png' })]
  ]

  it.each([true, false].flatMap(preview => sources.map(([kind, source]) => [preview, kind, source])))(
    'exposes the prefill source while retaining the native selection (preview=%s, source=%s)',
    async (preview, kind, source) => {
      if (!preview) vi.stubGlobal('CanvasRenderingContext2D', undefined)
      const wrapper = mountPictureInput({
        name: 'photo',
        customStrings: { selected: '<strong class="selection-success">Selected</strong>' }
      })
      const form = document.createElement('form')
      form.append(wrapper.element)
      const input = wrapper.find('input')
      const selected = makeFile()
      input.element.files = nativeFiles([selected])
      await input.trigger('change')
      if (preview) browser.finishLoading()
      else expect(wrapper.find('.selection-success').exists()).toBe(true)
      const files = input.element.files
      const value = input.element.value

      const prefill = source()
      await wrapper.setProps({ prefill })
      await flushAsync()
      if (preview) browser.finishLoading({ data: otherImageData })
      await flushAsync()

      const exposed = wrapper.vm.file
      if (kind === 'File' || kind === 'Blob') expect(exposed).toBe(prefill)
      else expect(exposed).toBeInstanceOf(File)
      expect(exposed).not.toBe(selected)
      expect(wrapper.vm.fileName).toBe(exposed.name || '')
      expect(wrapper.vm.fileSize).toBe(exposed.size)
      expect(wrapper.vm.fileType).toBe(exposed.type.split(';')[0])
      expect(wrapper.vm.fileModified).toBe(exposed.lastModified || 0)
      expect(wrapper.vm.imageSelected).toBe(false)
      expect(wrapper.vm.imagePreloaded).toBe(true)
      if (preview) expect(wrapper.vm.image).toBe(otherImageData)
      else expect(wrapper.find('.selection-success').exists()).toBe(false)
      expect(input.element.files).toBe(files)
      expect(files[0]).toBe(selected)
      expect(input.element.value).toBe(value)
      const submitted = new FormData(form).get('photo')
      expect(submitted.name).toBe(selected.name)
      expect(submitted.size).toBe(selected.size)
      expect(wrapper.emitted('prefill')).toEqual([[]])
      expect(wrapper.emitted('change')).toEqual([[preview ? imageData : undefined]])
    }
  )

  it.each(['File', 'Blob'])('keeps the direct size/type validation bypass for a %s prefill', async kind => {
    const prefill = kind === 'File' ? makeFile() : new Blob([pngBytes], { type: 'image/png' })
    const wrapper = mountPictureInput({ prefill, accept: 'image/jpeg', size: 0, alertOnError: false })
    await flushAsync()
    browser.finishLoading()

    expect(wrapper.vm.file).toBe(prefill)
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(wrapper.emitted('prefill')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(browser.fetch).not.toHaveBeenCalled()
  })

  it.each([
    [true, 'network'], [true, 'HTTP'], [false, 'network'], [false, 'HTTP']
  ])('preserves an existing selection after a preload failure (preview=%s, failure=%s)', async (preview, failure) => {
    if (!preview) vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({ name: 'photo', alertOnError: false })
    const form = document.createElement('form')
    form.append(wrapper.element)
    const input = wrapper.find('input')
    const file = makeFile()
    input.element.files = nativeFiles([file])
    await input.trigger('change')
    if (preview) browser.finishLoading()
    const files = input.element.files
    const value = input.element.value
    const image = wrapper.vm.image
    const imageObject = wrapper.vm.imageObject

    if (failure === 'network') {
      browser.fetch.mockRejectedValue(new Error('Network unavailable'))
    } else {
      browser.fetch.mockResolvedValue({ ok: false, status: 404 })
    }

    await wrapper.setProps({ prefill: 'https://example.test/failed.png' })
    await flushAsync()

    expect(browser.fetch).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.emitted('error')[0][0]).toMatchObject({
      type: 'failedPrefill',
      message: expect.stringContaining(failure === 'network' ? 'Network unavailable' : '404')
    })
    expect(input.element.files).toBe(files)
    expect(files[0]).toBe(file)
    expect(input.element.value).toBe(value)
    const submitted = new FormData(form).get('photo')
    expect(submitted.name).toBe(file.name)
    expect(submitted.size).toBe(file.size)
    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.vm.fileName).toBe(file.name)
    expect(wrapper.vm.fileSize).toBe(file.size)
    expect(wrapper.vm.fileType).toBe(file.type)
    expect(wrapper.vm.fileModified).toBe(file.lastModified)
    expect(wrapper.vm.image).toBe(image)
    expect(wrapper.vm.imageObject).toBe(imageObject)
    expect(wrapper.vm.imageSelected).toBe(true)
    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('change')).toEqual([[preview ? imageData : undefined]])
    expect(browser.readers).toHaveLength(preview ? 2 : 0)
  })

  it.each([
    [true, 'URL', 'fileType'], [true, 'URL', 'fileSize'],
    [true, 'data URI', 'fileType'], [true, 'data URI', 'fileSize'],
    [false, 'URL', 'fileType'], [false, 'URL', 'fileSize'],
    [false, 'data URI', 'fileType'], [false, 'data URI', 'fileSize']
  ])('rejects a fetched prefill without changing the existing selection (preview=%s, source=%s, error=%s)', async (preview, source, errorType) => {
    if (!preview) vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({
      name: 'photo', size: 1, alertOnError: false, prefillOptions: { fileName: 'rejected.png' }
    })
    const form = document.createElement('form')
    form.append(wrapper.element)
    const input = wrapper.find('input')
    const selected = makeFile()
    input.element.files = nativeFiles([selected])
    await input.trigger('change')
    if (preview) browser.finishLoading()
    const files = input.element.files
    const value = input.element.value
    const image = wrapper.vm.image
    const imageObject = wrapper.vm.imageObject

    const bytes = errorType === 'fileType' ? Buffer.from('not an image') : Buffer.alloc(1024 * 1024 + 1)
    const blob = new Blob([bytes], { type: errorType === 'fileType' ? 'text/plain' : 'image/png' })
    const readBlob = vi.fn().mockResolvedValue(blob)
    browser.fetch.mockResolvedValue({ ok: true, status: 200, blob: readBlob })
    const prefill = source === 'URL'
      ? 'https://example.test/rejected.png'
      : `data:${blob.type};base64,${bytes.toString('base64')}`

    await wrapper.setProps({ prefill })
    await flushAsync()

    expect(browser.fetch).toHaveBeenCalledTimes(1)
    expect(readBlob).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('error')).toEqual([[{
      type: errorType,
      fileName: 'rejected.png',
      fileSize: blob.size,
      fileType: blob.type,
      message: errorType === 'fileType'
        ? 'This file type is not supported.'
        : 'The file size exceeds the limit (1MB)'
    }]])
    expect(input.element.files).toBe(files)
    expect(files[0]).toBe(selected)
    expect(input.element.value).toBe(value)
    const submitted = new FormData(form).get('photo')
    expect(submitted.name).toBe(selected.name)
    expect(submitted.size).toBe(selected.size)
    expect(wrapper.vm.file).toBe(selected)
    expect(wrapper.vm.fileName).toBe(selected.name)
    expect(wrapper.vm.fileSize).toBe(selected.size)
    expect(wrapper.vm.fileType).toBe(selected.type)
    expect(wrapper.vm.fileModified).toBe(selected.lastModified)
    expect(wrapper.vm.image).toBe(image)
    expect(wrapper.vm.imageObject).toBe(imageObject)
    expect(wrapper.vm.imageSelected).toBe(true)
    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('change')).toEqual([[preview ? imageData : undefined]])
    expect(browser.readers).toHaveLength(preview ? 2 : 0)
    expect(browser.alert).not.toHaveBeenCalled()
  })

  it('restores the empty preview when the prefill prop is cleared', async () => {
    const wrapper = mountPictureInput({ prefill: makeFile() })
    browser.finishLoading()
    await wrapper.setProps({ prefill: '' })

    expect(wrapper.vm.image).toBe('')
    expect(wrapper.vm.file).toBeNull()
    expect(wrapper.vm.imageObject).toBeNull()
    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.vm.imageSelected).toBe(false)
    expect(wrapper.find('.picture-inner').exists()).toBe(true)
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.emitted('prefill')).toHaveLength(1)
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each([true, false])('reports network errors with alertOnError=%s', async alertOnError => {
    browser.fetch.mockRejectedValue(new Error('Network unavailable'))
    const wrapper = mountPictureInput({ prefill: 'https://example.test/photo.png', alertOnError })
    await flushAsync()

    expect(wrapper.emitted('error')).toEqual([[{
      type: 'failedPrefill', message: 'Failed loading prefill image: Error: Network unavailable'
    }]])
    expect(browser.alert).toHaveBeenCalledTimes(alertOnError ? 1 : 0)
    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.find('.picture-inner').exists()).toBe(true)
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(browser.readers).toHaveLength(0)
  })

  it('reports unsuccessful HTTP responses instead of prefilling the error body', async () => {
    browser.fetch.mockResolvedValue({
      ok: false, status: 404, blob: async () => new Blob([pngBytes], { type: 'image/png' })
    })
    const wrapper = mountPictureInput({ prefill: 'https://example.test/missing.png', alertOnError: false })
    await flushAsync()

    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.emitted('error')[0][0]).toMatchObject({
      type: 'failedPrefill', message: expect.stringContaining('404')
    })
    expect(wrapper.vm.imagePreloaded).toBe(false)
    expect(wrapper.find('.picture-inner').exists()).toBe(true)
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(browser.readers).toHaveLength(0)
  })

  it.each([
    ['URL', () => 'https://example.test/photo.png'],
    ['File', () => makeFile()]
  ])('emits only prefill for a %s without preview support', async (kind, source) => {
    vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({ prefill: source() })
    await flushAsync()

    expect(wrapper.emitted('prefill')).toEqual([[]])
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(browser.readers).toHaveLength(0)
    expect(wrapper.find('input').element.files).toHaveLength(0)
  })
})
