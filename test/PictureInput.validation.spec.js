import { describe, expect, it } from 'vitest'

import { useBrowserMocks } from './helpers/browser.js'
import { mountPictureInput, selectFile } from './helpers/component.js'
import { imageData, makeFile } from './helpers/fixtures.js'

describe('file validation', () => {
  const browser = useBrowserMocks()

  it.each([
    ['image/*', 'image/png'],
    ['image/*', 'image/jpeg'],
    ['image/jpeg', 'image/jpeg'],
    ['image/jpeg,image/png', 'image/png'],
    [' image/jpeg , image/png ', 'image/png']
  ])('accepts %s with MIME type %s', async (accept, type) => {
    const wrapper = mountPictureInput({ accept })
    const file = makeFile({ type })

    await selectFile(wrapper, file)
    browser.finishLoading()

    expect(wrapper.emitted('change')).toEqual([[imageData]])
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(wrapper.vm.file).toBe(file)
  })

  it('accepts a file exactly at the size limit', async () => {
    const wrapper = mountPictureInput({ size: 1 })
    await selectFile(wrapper, makeFile({ size: 1024 * 1024 }))
    browser.finishLoading()
    expect(wrapper.emitted('change')).toEqual([[imageData]])
  })

  it.each([0, 1024 * 1024 + 1])('rejects a file of %s bytes with error metadata', async size => {
    const wrapper = mountPictureInput({ size: '1' })
    const file = makeFile({ size })
    await selectFile(wrapper, file)

    expect(wrapper.emitted('error')).toEqual([[{
      type: 'fileSize', fileSize: size, fileType: file.type, fileName: file.name,
      message: 'The file size exceeds the limit (1MB)'
    }]])
    expect(browser.alert).toHaveBeenCalledExactlyOnceWith('The file size exceeds the limit (1MB)')
    expect(browser.readers).toHaveLength(0)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('prefill')).toBeUndefined()
  })

  it.each(['image/*', 'image/jpeg,image/png'])('reports rejected file types with accept=%s', async accept => {
    const wrapper = mountPictureInput({ accept })
    const file = makeFile({ name: 'notes.txt', type: 'text/plain' })
    await selectFile(wrapper, file)

    expect(wrapper.emitted('error')).toEqual([[{
      type: 'fileType', fileSize: file.size, fileType: file.type, fileName: file.name,
      message: 'This file type is not supported.'
    }]])
    expect(browser.alert).toHaveBeenCalledExactlyOnceWith('This file type is not supported.')
    expect(browser.readers).toHaveLength(0)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('prefill')).toBeUndefined()
    expect(wrapper.vm.imageSelected).toBe(false)
  })

  it.each(['fileSize', 'fileType'])('suppresses alerts, not %s errors', async errorType => {
    const wrapper = mountPictureInput({ size: 1, alertOnError: false })
    const file = errorType === 'fileSize'
      ? makeFile({ size: 1024 * 1024 + 1 })
      : makeFile({ name: 'notes.txt', type: 'text/plain' })
    await selectFile(wrapper, file)

    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.emitted('error')[0][0].type).toBe(errorType)
    expect(browser.alert).not.toHaveBeenCalled()
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('does nothing when the picker is cancelled', async () => {
    const wrapper = mountPictureInput()
    await selectFile(wrapper)
    expect(wrapper.emitted()).toEqual({})
    expect(browser.readers).toHaveLength(0)
    expect(browser.alert).not.toHaveBeenCalled()
  })

  it('keeps the successful image and file when the next file is rejected', async () => {
    const wrapper = mountPictureInput({ alertOnError: false })
    const file = makeFile()
    await selectFile(wrapper, file)
    browser.finishLoading()

    await selectFile(wrapper, makeFile({ name: 'bad.txt', type: 'text/plain' }))

    expect(wrapper.vm.file).toBe(file)
    expect(wrapper.vm.fileName).toBe(file.name)
    expect(wrapper.vm.image).toBe(imageData)
    expect(wrapper.emitted('change')).toHaveLength(1)
    expect(wrapper.emitted('error')).toHaveLength(1)
  })

  it('does not reload an unchanged selection', async () => {
    const wrapper = mountPictureInput()
    const file = makeFile()
    await selectFile(wrapper, file)
    browser.finishLoading()
    await selectFile(wrapper, file)

    expect(wrapper.emitted('change')).toHaveLength(1)
    expect(browser.readers).toHaveLength(2)
  })
})
