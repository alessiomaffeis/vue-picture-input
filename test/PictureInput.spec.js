import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PictureInput from '../PictureInput.vue'

describe('PictureInput.vue', () => {
  it('matches snapshot', () => {
    const wrapper = shallowMount(PictureInput)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('removes the resize listener when destroyed', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = shallowMount(PictureInput)
    await wrapper.vm.$nextTick()
    const resizeListener = addListener.mock.calls.find(([event]) => event === 'resize')[1]

    wrapper.destroy()

    expect(removeListener).toHaveBeenCalledWith('resize', resizeListener)
    addListener.mockRestore()
    removeListener.mockRestore()
  })
})
