import { shallowMount } from '@vue/test-utils'
import { createRenderer } from 'vue-server-renderer'

import PictureInput from '../PictureInput.vue'

describe('PictureInput.vue', () => {
  it('matches snapshot', () => {
    const renderer = createRenderer()
    const wrapper = shallowMount(PictureInput)
    renderer.renderToString(wrapper.vm, (err, str) => {
      if (err) throw new Error(err)
      expect(str).toMatchSnapshot()
    })
  })

  it('removes the resize listener when destroyed', async () => {
    const addListener = jest.spyOn(window, 'addEventListener')
    const removeListener = jest.spyOn(window, 'removeEventListener')
    const wrapper = shallowMount(PictureInput)
    await wrapper.vm.$nextTick()
    const resizeListener = addListener.mock.calls.find(([event]) => event === 'resize')[1]

    wrapper.destroy()

    expect(removeListener).toHaveBeenCalledWith('resize', resizeListener)
    addListener.mockRestore()
    removeListener.mockRestore()
  })
})
