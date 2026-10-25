import { mount } from '@vue/test-utils'
import { h, nextTick, shallowRef, useTemplateRef } from 'vue'

import PictureInput from '../../PictureInput.vue'

const wrappers = new Set()

export function mountPictureInput (props = {}) {
  const wrapper = mount(PictureInput, { props })
  wrappers.add(wrapper)
  return wrapper
}

export function mountWithParent (props = {}, listeners = {}, renderExposed) {
  const parent = {
    setup (_, { expose }) {
      const pictureProps = shallowRef(props)
      const pictureInput = useTemplateRef('pictureInput')
      const events = Object.fromEntries(Object.entries(listeners).map(([name, handler]) => [
        'on' + name[0].toUpperCase() + name.slice(1), handler
      ]))
      expose({ pictureProps })
      return () => h('div', [
        h(PictureInput, { ...pictureProps.value, ref: 'pictureInput', ...events }),
        renderExposed ? renderExposed(pictureInput.value) : null
      ])
    }
  }
  const wrapper = mount(parent)
  wrappers.add(wrapper)
  return wrapper
}

export function unmount (wrapper) {
  if (!wrappers.delete(wrapper)) return
  wrapper.unmount()
}

export async function cleanupComponents () {
  for (const wrapper of wrappers) unmount(wrapper)
  await nextTick()
}

export function findButton (wrapper, label) {
  const buttons = wrapper.findAll('button')
  return buttons.find(button => button.text() === label)
}

export function setFiles (input, files) {
  // jsdom has no DataTransfer constructor to create a writable native FileList.
  Object.defineProperty(input, 'files', { configurable: true, writable: true, value: files })
}

export async function selectFile (wrapper, file) {
  const input = wrapper.find('input')
  setFiles(input.element, file ? [file] : [])
  await input.trigger('change')
}

export async function flushAsync () {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
