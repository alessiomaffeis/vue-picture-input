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
})
