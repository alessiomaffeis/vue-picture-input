import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'

import PictureInput from '../../PictureInput.vue'

const wrappers = new Set()

export function mountPictureInput (props = {}, computed = {}) {
  const component = {
    ...PictureInput,
    computed: { ...PictureInput.computed, ...computed }
  }
  const wrapper = mount(component, { props })
  wrappers.add(wrapper)
  return wrapper
}

export function mountWithParent (props = {}, listeners = {}) {
  const parent = {
    data: () => ({ pictureProps: props }),
    render () {
      const events = Object.fromEntries(Object.entries(listeners).map(([name, handler]) => [
        'on' + name[0].toUpperCase() + name.slice(1), handler
      ]))
      return h('div', [h(PictureInput, { ...this.pictureProps, ref: 'pictureInput', ...events })])
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
  // Let mounted's deferred resize subscription finish before tearing it down.
  await nextTick()
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
