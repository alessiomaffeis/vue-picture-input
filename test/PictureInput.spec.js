import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PictureInput from '../PictureInput.vue'
import { useBrowserMocks } from './helpers/browser.js'
import { mountPictureInput, selectFile } from './helpers/component.js'
import { imageData, makeFile, otherImageData } from './helpers/fixtures.js'

describe('PictureInput.vue', () => {
  it('matches snapshot', async () => {
    const wrapper = shallowMount(PictureInput)
    expect(wrapper.html()).toMatchSnapshot()
    await wrapper.vm.$nextTick()
    wrapper.unmount()
  })

  it('removes the resize listener when unmounted', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = shallowMount(PictureInput)
    await wrapper.vm.$nextTick()
    const resizeListener = addListener.mock.calls.find(([event]) => event === 'resize')[1]

    wrapper.unmount()

    expect(removeListener).toHaveBeenCalledWith('resize', resizeListener)
    addListener.mockRestore()
    removeListener.mockRestore()
  })

  describe('file change events', () => {
    const browser = useBrowserMocks()

    it.each([false, true])('emits one change after decoding (replacement: %s)', async replacement => {
      const wrapper = mountPictureInput({ size: 1 })
      if (replacement) {
        await selectFile(wrapper, makeFile({ name: 'previous.png' }))
        browser.finishLoading({ data: otherImageData })
      }
      const previousEvents = replacement ? [[otherImageData]] : []
      const file = makeFile()
      await selectFile(wrapper, file)

      expect(wrapper.emitted('change') || []).toEqual(previousEvents)
      browser.finishEXIF()
      const reader = browser.readers.at(-1)
      expect(reader.readAsDataURL).toHaveBeenCalledWith(file)
      expect(wrapper.emitted('change') || []).toEqual(previousEvents)

      browser.finishDataURL()
      expect(wrapper.emitted('change') || []).toEqual(previousEvents)
      browser.images.at(-1).finish()

      expect(browser.context.drawImage).toHaveBeenLastCalledWith(browser.images.at(-1), -320, 0, 1280, 640)
      expect(wrapper.emitted('change')).toEqual([...previousEvents, [imageData]])
    })

    it('emits only prefill after decoding a prefilled image', () => {
      const wrapper = mountPictureInput({ prefill: makeFile() })
      expect(wrapper.emitted()).toEqual({})
      browser.finishEXIF()
      expect(wrapper.emitted()).toEqual({})
      browser.finishDataURL()
      expect(wrapper.emitted()).toEqual({})
      browser.images[0].finish()
      expect(wrapper.emitted()).toEqual({ prefill: [[]] })
    })

    it.each([false, true])('emits one event without preview support (prefill: %s)', async prefill => {
      browser.disablePreview()
      const file = makeFile()
      const wrapper = mountPictureInput(prefill ? { prefill: file } : {})
      if (!prefill) await selectFile(wrapper, file)
      expect(browser.readers).toHaveLength(0)
      expect(wrapper.emitted()).toEqual(prefill ? { prefill: [[]] } : { change: [[undefined]] })
    })
  })
})
