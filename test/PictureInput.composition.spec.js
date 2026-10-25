import { h, isProxy, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import {
  findButton, flushAsync, mountPictureInput, mountWithParent, selectFile, unmount
} from './helpers/component.js'
import { imageData, makeFile, otherImageData, pngBytes } from './helpers/fixtures.js'
import { nativeFiles } from './helpers/native-files.cjs'

describe('Composition API public compatibility', () => {
  const browser = useBrowserMocks()

  it('preserves the full state, helper, computed, and prop surface on real parent refs', async () => {
    const parent = mountWithParent({ width: 400, height: 200, name: 'photo' })
    await nextTick()
    const picture = parent.vm.$refs.pictureInput
    expect(picture.$options.name).toBe('picture-input')
    expect(picture.image).toBeUndefined()
    expect(picture.file).toBeUndefined()
    for (const key of ['fileName', 'fileSize', 'fileModified', 'fileType', 'imageObject', 'imageWidth', 'imageHeight', 'imageRatio', 'rotate']) {
      expect(picture[key]).toBeUndefined()
    }
    for (const key of [
      'imageSelected', 'imagePreloaded', 'previewHeight', 'previewWidth', 'draggingOver',
      'canvasWidth', 'canvasHeight', 'strings', 'image', 'file', 'fileName', 'fileSize',
      'fileModified', 'fileType', 'imageObject', 'pixelRatio', 'context', 'fileTypes',
      'containerWidth', 'imageWidth', 'imageHeight', 'imageRatio', 'rotate',
      'supportsUpload', 'supportsPreview', 'supportsDragAndDrop', 'computedClasses', 'fontSize'
    ]) expect(key in picture).toBe(true)
    for (const method of [
      'updateStrings', 'onClick', 'onResize', 'onDragEnter', 'onDragLeave', 'onFileDrop',
      'onFileChange', 'loadImage', 'drawImage', 'selectImage', 'removeImage', 'rotateImage',
      'resizeCanvas', 'getOrientation', 'switchCanvasOrientation', 'rotateCanvas',
      'setOrientation', 'getEXIFOrientation', 'preloadImage'
    ]) expect(picture[method]).toBeTypeOf('function')
    expect(picture.width).toBe(400)
    expect(picture.name).toBe('photo')
    for (const [key, value] of Object.entries(picture.$props)) expect(picture[key]).toBe(value)
    expect(picture.canvasWidth).toBe(400)
    expect(picture.computedClasses).toEqual({ 'dragging-over': false })
    expect(picture.fontSize).toBe('16px')

    const picker = vi.spyOn(parent.find('input').element, 'click').mockImplementation(() => {})
    picture.selectImage()
    expect(picker).toHaveBeenCalledTimes(1)
    parent.vm.pictureProps = { width: 900, height: 200, name: 'replacement' }
    await nextTick()
    expect(picture.width).toBe(900)
    expect(picture.name).toBe('replacement')
    expect(picture.canvasWidth).toBe(400)
  })

  it('reactively renders exposed values after selection, replacement, prefill, and public removal', async () => {
    const aspect = vi.fn()
    const parent = mountWithParent({ width: 400, height: 200 }, { aspectratiochange: aspect }, picture =>
      h('output', JSON.stringify(picture ? {
        image: picture.image,
        name: picture.fileName,
        size: picture.fileSize,
        type: picture.fileType,
        modified: picture.fileModified,
        sourceName: picture.file?.name || '',
        selected: picture.imageSelected,
        preloaded: picture.imagePreloaded
      } : null))
    )
    const picture = parent.vm.$refs.pictureInput
    const readOutput = () => JSON.parse(parent.find('output').text())
    const first = makeFile()
    await selectFile(parent, first)
    browser.finishLoading()
    await nextTick()
    expect(picture.file).toBe(first)
    expect(readOutput()).toEqual({
      image: imageData, name: first.name, size: first.size, type: first.type,
      modified: first.lastModified, sourceName: first.name, selected: true, preloaded: false
    })

    const replacement = makeFile({ name: 'replacement.png', lastModified: 42, size: 8 })
    await selectFile(parent, replacement)
    browser.finishLoading({ data: otherImageData })
    await nextTick()
    expect(picture.file).toBe(replacement)
    expect(readOutput()).toEqual({
      image: otherImageData, name: replacement.name, size: 8, type: replacement.type,
      modified: 42, sourceName: replacement.name, selected: true, preloaded: false
    })

    const blob = new Blob([pngBytes], { type: 'image/png' })
    picture.preloadImage(blob)
    browser.finishLoading()
    await nextTick()
    expect(picture.file).toBe(blob)
    expect(isProxy(picture.file)).toBe(false)
    expect(isProxy(picture.imageObject)).toBe(false)
    expect(isProxy(picture.context)).toBe(false)
    expect(readOutput()).toEqual({
      image: imageData, name: '', size: 4, type: 'image/png',
      modified: 0, sourceName: '', selected: false, preloaded: true
    })
    picture.rotateImage()
    expect(aspect).toHaveBeenCalledExactlyOnceWith('portrait')
    picture.removeImage()
    await nextTick()
    expect(picture.file).toBeNull()
    expect(picture.imageObject).toBeNull()
    expect(readOutput()).toEqual({
      image: '', name: '', size: 0, type: '', modified: 0,
      sourceName: '', selected: false, preloaded: false
    })
  })

  it.each(['File', 'Blob', 'URL'])('keeps live parent-ref identity and metadata for a %s prefill', async kind => {
    const source = kind === 'File' ? makeFile({ lastModified: 42 })
      : kind === 'Blob' ? new Blob([pngBytes], { type: 'image/png' })
        : 'https://example.test/default.png'
    const parent = mountWithParent({ prefill: source })
    const picture = parent.vm.$refs.pictureInput
    await flushAsync()
    browser.finishLoading()
    if (kind === 'URL') expect(picture.file).toBeInstanceOf(File)
    else expect(picture.file).toBe(source)
    expect(picture.image).toBe(imageData)
    expect(picture.fileName).toBe(picture.file.name || '')
    expect(picture.fileSize).toBe(picture.file.size)
    expect(picture.fileType).toBe(picture.file.type)
    expect(picture.fileModified).toBe(picture.file.lastModified || 0)
  })

  it('loads initial and changed prefills once, after initializing dimensions and acceptance', async () => {
    const wrapper = mountPictureInput({
      prefill: 'https://example.test/first.png', accept: 'image/png', width: '400', height: '200'
    })
    await flushAsync()
    expect(browser.fetch).toHaveBeenCalledTimes(1)
    expect(browser.readers).toHaveLength(1)
    expect(wrapper.vm.fileTypes).toEqual(['image/png'])
    expect(wrapper.vm.previewWidth).toBe(400)
    expect(wrapper.vm.context).toBe(browser.context)
    browser.finishLoading()

    await wrapper.setProps({ prefill: 'https://example.test/second.png' })
    await flushAsync()
    expect(browser.fetch).toHaveBeenCalledTimes(2)
    expect(browser.readers).toHaveLength(3)
    browser.finishLoading({ data: otherImageData })
    expect(wrapper.emitted('prefill')).toEqual([[], []])
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('clearing prefill through a parent performs clear-all removal of a retained native selection', async () => {
    const parent = mountWithParent({ name: 'photo' })
    const picture = parent.vm.$refs.pictureInput
    const input = parent.find('input')
    const selected = makeFile()
    input.element.files = nativeFiles([selected])
    await input.trigger('change')
    browser.finishLoading()
    parent.vm.pictureProps = { name: 'photo', prefill: makeFile({ name: 'prefill.png' }) }
    await nextTick()
    browser.finishLoading({ data: otherImageData })
    expect(input.element.files[0]).toBe(selected)

    parent.vm.pictureProps = { name: 'photo', prefill: '' }
    await nextTick()
    expect(input.element.files).toHaveLength(0)
    expect(picture.file).toBeNull()
    expect(picture.image).toBe('')
    expect(picture.fileName).toBe('')
    expect(picture.fileModified).toBe(0)
    expect(picture.imageSelected).toBe(false)
    expect(picture.imagePreloaded).toBe(false)
  })

  it('clears prefill state and emits remove before the child rerenders', async () => {
    const removals = []
    const parent = mountWithParent({ name: 'photo', buttonClass: 'before-clear' }, {
      remove: () => removals.push({
        file: picture.file,
        image: picture.image,
        nativeFiles: input.element.files.length,
        placeholder: parent.find('.picture-inner').exists(),
        buttonClass: findButton(parent, 'Change Photo')?.attributes('class')
      })
    })
    const picture = parent.vm.$refs.pictureInput
    const input = parent.find('input')
    input.element.files = nativeFiles([makeFile()])
    await input.trigger('change')
    browser.finishLoading()
    parent.vm.pictureProps = {
      name: 'photo', buttonClass: 'before-clear', prefill: makeFile({ name: 'prefill.png' })
    }
    await nextTick()
    browser.finishLoading({ data: otherImageData })
    await nextTick()

    parent.vm.pictureProps = { name: 'photo', buttonClass: 'after-clear', prefill: '' }
    await nextTick()

    expect(removals).toEqual([{
      file: null, image: '', nativeFiles: 0, placeholder: false, buttonClass: 'before-clear'
    }])
    expect(parent.find('.picture-inner').exists()).toBe(true)
    expect(findButton(parent, 'Change Photo')).toBeUndefined()
  })

  it('retains initialization-only dimensions, parsed types, and strings without watching prefillOptions', async () => {
    const wrapper = mountPictureInput({
      width: 400, height: 200, accept: 'image/png', customStrings: { change: 'Original' }
    })
    await wrapper.setProps({
      width: 900, height: 600, accept: 'image/jpeg', customStrings: { change: 'Updated' },
      prefillOptions: { fileName: 'new-name.png' }
    })
    expect(wrapper.vm.canvasWidth).toBe(400)
    expect(wrapper.vm.canvasHeight).toBe(200)
    expect(wrapper.vm.fileTypes).toEqual(['image/png'])
    expect(wrapper.vm.strings.change).toBe('Original')
    expect(browser.fetch).not.toHaveBeenCalled()
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    await nextTick()
    expect(findButton(wrapper, 'Original')).toBeDefined()
    wrapper.vm.updateStrings()
    await nextTick()
    expect(findButton(wrapper, 'Updated')).toBeDefined()
  })

  it('does not reload an existing prefill when only prefillOptions changes', async () => {
    const wrapper = mountPictureInput({
      prefill: 'https://example.test/default.png', prefillOptions: { fileName: 'original.png' }
    })
    await flushAsync()
    browser.finishLoading()
    await wrapper.setProps({ prefillOptions: { fileName: 'updated.png' } })
    await flushAsync()
    expect(browser.fetch).toHaveBeenCalledTimes(1)
    expect(browser.readers).toHaveLength(2)
    expect(wrapper.vm.fileName).toBe('original.png')
    expect(wrapper.emitted('prefill')).toEqual([[]])
  })

  it('handles the conditional absence of a canvas even when preview APIs exist', () => {
    browser.disableUpload()
    const wrapper = mountPictureInput()
    expect(wrapper.vm.supportsPreview).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.vm.context).toBeUndefined()
  })

  it('preserves runtime Boolean casting and attribute fallthrough', async () => {
    const wrapper = mountPictureInput({
      width: '400', height: '200', removable: '', hideChangeButton: '',
      toggleAspectRatio: '', plain: '', crop: '', changeOnClick: '',
      id: 12, capture: 'custom-capture-mode', class: 'parent-class', 'data-test': 'fallthrough'
    })
    expect(wrapper.classes()).toContain('parent-class')
    expect(wrapper.attributes('data-test')).toBe('fallthrough')
    expect(wrapper.find('input').attributes('id')).toBe('12')
    expect(wrapper.find('input').attributes('capture')).toBe('custom-capture-mode')
    expect(wrapper.find('.picture-inner').exists()).toBe(false)
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    await nextTick()
    expect(findButton(wrapper, 'Change Photo')).toBeUndefined()
    expect(findButton(wrapper, 'Remove Photo')).toBeDefined()
    expect(findButton(wrapper, 'Landscape/Portrait')).toBeDefined()
    expect(wrapper.vm.crop).toBe(true)
    expect(wrapper.vm.changeOnClick).toBe(true)
  })

  it('filters invalid custom strings and renders the accepted messages reactively', async () => {
    browser.setDragAndDrop(true)
    const wrapper = mountPictureInput({ customStrings: {
      change: null, remove: 42, selected: {}, unknown: 'ignored', drag: '<b>Custom drag</b>'
    } })
    await nextTick()
    expect(wrapper.find('b').text()).toBe('Custom drag')
    expect(wrapper.vm.strings.change).toBe('Change Photo')
    expect(wrapper.vm.strings.remove).toBe('Remove Photo')
    expect(wrapper.vm.strings.selected).toBe('<p>Photo successfully selected!</p>')
    expect(wrapper.vm.strings.unknown).toBeUndefined()
  })

  it('keeps exposed strings deeply reactive and retains their identity across updates', async () => {
    const parent = mountWithParent({ customStrings: { change: 'Original' } }, {}, picture =>
      h('output', picture?.strings.change || '')
    )
    const picture = parent.vm.$refs.pictureInput
    const strings = picture.strings
    await selectFile(parent, makeFile())
    browser.finishLoading()
    await nextTick()

    picture.strings.change = 'Parent edit'
    await nextTick()
    expect(findButton(parent, 'Parent edit')).toBeDefined()
    expect(parent.find('output').text()).toBe('Parent edit')

    parent.vm.pictureProps = { customStrings: { change: 'Updated custom string' } }
    await nextTick()
    expect(strings.change).toBe('Parent edit')
    picture.updateStrings()
    await nextTick()
    expect(picture.strings).toBe(strings)
    expect(strings.change).toBe('Updated custom string')
    expect(findButton(parent, 'Updated custom string')).toBeDefined()
    expect(parent.find('output').text()).toBe('Updated custom string')

    strings.change = 'Held-reference edit'
    await nextTick()
    expect(findButton(parent, 'Held-reference edit')).toBeDefined()
    expect(parent.find('output').text()).toBe('Held-reference edit')
  })

  it('isolates messages, metadata, DOM refs, drawing resources, and cleanup across instances', async () => {
    const first = mountWithParent({ removable: true, customStrings: { change: 'First change' } })
    const second = mountWithParent({ removable: true, customStrings: { change: 'Second change' } })
    const a = first.vm.$refs.pictureInput
    const b = second.vm.$refs.pictureInput
    const firstFile = makeFile({ name: 'first.png', lastModified: 12 })
    const secondFile = makeFile({ name: 'second.png', lastModified: 34 })
    await selectFile(first, firstFile)
    browser.finishLoading()
    await selectFile(second, secondFile)
    browser.finishLoading({ data: otherImageData })
    await nextTick()
    expect(a.file).toBe(firstFile)
    expect(b.file).toBe(secondFile)
    expect(a.fileModified).toBe(12)
    expect(b.fileModified).toBe(34)
    expect(a.strings).not.toBe(b.strings)
    expect(findButton(first, 'First change')).toBeDefined()
    expect(findButton(second, 'Second change')).toBeDefined()
    for (const key of ['container', 'previewCanvas', 'fileInput']) expect(a.$refs[key]).not.toBe(b.$refs[key])
    expect(a.context).not.toBe(b.context)
    expect(a.imageObject).not.toBe(b.imageObject)

    const aContext = a.context
    a.removeImage()
    expect(b.file).toBe(secondFile)
    expect(b.image).toBe(otherImageData)
    unmount(first)
    aContext.drawImage.mockClear()
    b.context.drawImage.mockClear()
    browser.containerWidth = 320
    window.dispatchEvent(new Event('resize'))
    expect(aContext.drawImage).not.toHaveBeenCalled()
    expect(b.context.drawImage).toHaveBeenCalledTimes(1)
    expect(b.previewWidth).toBe(320)
    expect(b.file).toBe(secondFile)
  })
})
