import { describe, expect, it, vi } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { findButton, flushAsync, mountPictureInput, selectFile } from './helpers/component.js'
import { makeFile } from './helpers/fixtures.js'

describe('documented props and presentation', () => {
  const browser = useBrowserMocks()

  it('forwards input attributes for forms and camera capture', () => {
    const wrapper = mountPictureInput({
      id: 'avatar', name: 'profileImage', accept: 'image/jpeg', capture: 'environment'
    })
    const input = wrapper.find('input')
    expect(input.attributes('id')).toBe('avatar')
    expect(input.attributes('name')).toBe('profileImage')
    expect(input.attributes('accept')).toBe('image/jpeg')
    expect(input.attributes('capture')).toBe('environment')
    expect(input.attributes('type')).toBe('file')
  })

  it('applies radius and z-index to the preview layers', () => {
    const wrapper = mountPictureInput({ radius: 50, zIndex: 300 })
    expect(wrapper.find('.preview-container').element.style.borderRadius).toBe('50%')
    expect(wrapper.find('.picture-inner').element.style.borderRadius).toBe('50%')
    expect(wrapper.find('canvas').element.style.zIndex).toBe('301')
    expect(wrapper.find('.picture-inner').element.style.zIndex).toBe('302')
  })

  it.each([false, true])('plain=%s controls the inner border and instructions', plain => {
    const wrapper = mountPictureInput({ plain })
    expect(wrapper.find('.picture-inner').exists()).toBe(!plain)
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it.each([
    [true, false, false], [true, true, false], [true, false, true], [true, true, true],
    [false, false, false], [false, true, false], [false, false, true], [false, true, true]
  ])('shows controls with preview=%s, removable=%s, hideChangeButton=%s', async (preview, removable, hideChangeButton) => {
    if (!preview) vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({ removable, hideChangeButton })
    expect(findButton(wrapper, 'Change Photo')).toBeUndefined()
    expect(findButton(wrapper, 'Remove Photo')).toBeUndefined()
    await selectFile(wrapper, makeFile())
    if (preview) browser.finishLoading()
    await flushAsync()

    expect(Boolean(findButton(wrapper, 'Change Photo'))).toBe(!hideChangeButton)
    expect(Boolean(findButton(wrapper, 'Remove Photo'))).toBe(removable)
  })

  it('applies custom classes to each control', async () => {
    const wrapper = mountPictureInput({
      width: 400, height: 200, removable: true, toggleAspectRatio: true,
      buttonClass: 'custom-change', removeButtonClass: 'custom-remove', aspectButtonClass: 'custom-aspect'
    })
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    await flushAsync()

    expect(findButton(wrapper, 'Change Photo').classes()).toContain('custom-change')
    expect(findButton(wrapper, 'Remove Photo').classes()).toContain('custom-remove')
    expect(findButton(wrapper, 'Landscape/Portrait').classes()).toContain('custom-aspect')
  })

  it.each([
    [false, false, false, 200],
    [true, false, true, 200],
    [true, true, true, 200],
    [true, false, true, 400]
  ])('shows prefill controls with removable=%s, hidden change=%s, aspect=%s, height=%s', async (removable, hideChangeButton, toggleAspectRatio, height) => {
    const wrapper = mountPictureInput({
      prefill: makeFile(), width: 400, height, changeOnClick: false,
      removable, hideChangeButton, toggleAspectRatio
    })
    browser.finishLoading()
    await flushAsync()

    expect(Boolean(findButton(wrapper, 'Change Photo'))).toBe(!hideChangeButton)
    expect(Boolean(findButton(wrapper, 'Remove Photo'))).toBe(removable)
    const aspect = findButton(wrapper, 'Landscape/Portrait')
    expect(Boolean(aspect)).toBe(toggleAspectRatio && height !== 400)

    if (!hideChangeButton) {
      const picker = vi.spyOn(wrapper.find('input').element, 'click').mockImplementation(() => {})
      await findButton(wrapper, 'Change Photo').trigger('click')
      expect(picker).toHaveBeenCalledTimes(1)
    }
    if (aspect) {
      await aspect.trigger('click')
      expect(wrapper.emitted('aspectratiochange')).toEqual([['portrait']])
    }
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each([false, true])('provides prefill controls without preview, hidden change=%s', async hideChangeButton => {
    vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({ prefill: makeFile(), removable: true, hideChangeButton, changeOnClick: false })
    await flushAsync()
    expect(findButton(wrapper, 'Select a Photo')).toBeUndefined()
    expect(Boolean(findButton(wrapper, 'Change Photo'))).toBe(!hideChangeButton)
    await findButton(wrapper, 'Remove Photo').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(findButton(wrapper, 'Select a Photo')).toBeDefined()
  })

  it.each(['URL', 'File'])('does not announce a file selection for a no-preview %s prefill', async source => {
    vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const wrapper = mountPictureInput({
      prefill: source === 'URL' ? 'https://example.test/default.png' : makeFile(),
      customStrings: { selected: '<strong class="selection-success">Photo successfully selected!</strong>' }
    })
    await flushAsync()

    expect(wrapper.find('.selection-success').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Photo successfully selected!')
    expect(findButton(wrapper, 'Change Photo')).toBeDefined()
    expect(wrapper.emitted('prefill')).toEqual([[]])

    await selectFile(wrapper, makeFile({ name: 'user-selected.png' }))
    expect(wrapper.find('.selection-success').exists()).toBe(true)
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('uses the documented default button classes', async () => {
    const wrapper = mountPictureInput({ width: 400, height: 200, removable: true, toggleAspectRatio: true })
    await selectFile(wrapper, makeFile())
    browser.finishLoading()
    await flushAsync()

    expect(findButton(wrapper, 'Change Photo').classes()).toEqual(['btn', 'btn-primary', 'button'])
    for (const label of ['Remove Photo', 'Landscape/Portrait']) {
      expect(findButton(wrapper, label).classes()).toEqual(['btn', 'btn-secondary', 'button', 'secondary'])
    }
  })

  it('keeps the initial select button available when change buttons are hidden', () => {
    vi.stubGlobal('FileReader', undefined)
    const wrapper = mountPictureInput({ hideChangeButton: true, buttonClass: 'custom-select' })
    expect(findButton(wrapper, 'Select a Photo').classes()).toContain('custom-select')
    expect(wrapper.find('canvas').exists()).toBe(false)
  })

  it.each(['upload', 'drag', 'tap', 'selected'])('renders HTML allowed in customStrings.%s', async key => {
    const customStrings = { [key]: '<strong class="custom-copy">Custom message</strong>' }
    const computed = {}
    if (key === 'upload') {
      computed.supportsUpload = () => false
      computed.supportsPreview = () => false
    } else if (key === 'selected') {
      computed.supportsPreview = () => false
    } else {
      computed.supportsDragAndDrop = () => key === 'drag'
    }
    const wrapper = mountPictureInput({ customStrings }, computed)
    if (key === 'selected') await selectFile(wrapper, makeFile())
    await flushAsync()
    expect(wrapper.find('strong.custom-copy').text()).toBe('Custom message')
  })

  it.each(['change', 'remove', 'select', 'aspect'])('escapes the text-only customStrings.%s label', async key => {
    const label = '<img src=x onerror=alert(1)>Label'
    const props = {
      width: 400, height: 200, removable: true, toggleAspectRatio: true,
      customStrings: { [key]: label }
    }
    const wrapper = mountPictureInput(props, key === 'select' ? { supportsPreview: () => false } : {})
    if (key !== 'select') {
      await selectFile(wrapper, makeFile())
      browser.finishLoading()
    }
    await flushAsync()
    expect(findButton(wrapper, label)).toBeDefined()
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it.each(['fileSize', 'fileType'])('uses customStrings.%s in error events and alerts', async key => {
    const label = 'Custom rejection message'
    const wrapper = mountPictureInput({ size: 1, customStrings: { [key]: label } })
    const file = key === 'fileSize'
      ? makeFile({ size: 1024 * 1024 + 1 })
      : makeFile({ name: 'bad.txt', type: 'text/plain' })
    await selectFile(wrapper, file)

    const message = key === 'fileSize' ? label + ' (1MB)' : label
    expect(wrapper.emitted('error')[0][0].message).toBe(message)
    expect(browser.alert).toHaveBeenCalledExactlyOnceWith(message)
  })

  it('provides the documented no-FileReader selection fallback', async () => {
    vi.stubGlobal('FileReader', undefined)
    const wrapper = mountPictureInput()
    const openPicker = vi.spyOn(wrapper.find('input').element, 'click').mockImplementation(() => {})
    await findButton(wrapper, 'Select a Photo').trigger('click')
    expect(openPicker).toHaveBeenCalledTimes(1)
    await selectFile(wrapper, makeFile())

    expect(wrapper.text()).toContain('Photo successfully selected!')
    expect(wrapper.emitted('change')).toEqual([[undefined]])
    expect(wrapper.vm.file).toBeDefined()
    expect(browser.readers).toHaveLength(0)
  })
})
