import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PictureInput from '../PictureInput.vue'

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
    const image = 'data:image/png;base64,aW1hZ2U='
    let vm
    let readAsDataURL

    beforeEach(() => {
      readAsDataURL = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(() => {})
      vm = {
        ...PictureInput.data(),
        ...PictureInput.methods,
        accept: 'image/*',
        size: 1,
        supportsPreview: true,
        getEXIFOrientation: vi.fn((file, callback) => callback(-1)),
        drawImage: vi.fn(),
        $emit: vi.fn()
      }
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    function selectFile (prefill) {
      const file = new File(['image'], 'image.png', { type: 'image/png' })
      vm.onFileChange({ target: { files: [file] } }, prefill)
      return file
    }

    function finishReadingImage () {
      const reader = readAsDataURL.mock.instances[0]
      reader.onload({ target: { result: image } })
    }

    it.each([undefined, 'data:image/png;base64,b2xk'])('emits one change after decoding (previous image: %s)', (previousImage) => {
      vm.image = previousImage

      const file = selectFile(false)

      expect(readAsDataURL).toHaveBeenCalledWith(file)
      expect(vm.$emit).not.toHaveBeenCalled()

      finishReadingImage()
      expect(vm.$emit).not.toHaveBeenCalled()

      vm.imageObject.onload()

      expect(vm.drawImage).toHaveBeenCalledWith(vm.imageObject)
      expect(vm.$emit.mock.calls).toEqual([['change', image]])
    })

    it('emits only prefill after decoding a prefilled image', () => {
      selectFile(true)

      expect(vm.$emit).not.toHaveBeenCalled()

      finishReadingImage()
      expect(vm.$emit).not.toHaveBeenCalled()

      vm.imageObject.onload()

      expect(vm.$emit.mock.calls).toEqual([['prefill']])
    })

    it.each([false, true])('emits one event without preview support (prefill: %s)', (prefill) => {
      vm.supportsPreview = false

      selectFile(prefill)

      expect(readAsDataURL).not.toHaveBeenCalled()
      expect(vm.$emit.mock.calls).toEqual(prefill ? [['prefill']] : [['change', undefined]])
    })
  })
})
