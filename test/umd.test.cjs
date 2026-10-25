const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const test = require('node:test')
const { JSDOM, VirtualConsole } = require('jsdom')
const { nativeFiles } = require('./helpers/native-files.cjs')

test('published UMD mounts with global Vue, injects CSS, and preserves the live public API', { timeout: 5000 }, async t => {
  const errors = []
  const console = new VirtualConsole()
  console.on('jsdomError', error => errors.push(error))
  const dom = new JSDOM('<div id="app"></div>', {
    runScripts: 'outside-only', url: 'http://localhost/', virtualConsole: console
  })
  const window = dom.window
  let app
  t.after(() => {
    try {
      if (app) app.unmount()
    } finally {
      window.close()
    }
  })

  window.eval(readFileSync(require.resolve('vue/dist/vue.global.prod.js'), 'utf8'))
  assert.equal(window.Vue.version, require('vue/package.json').version)
  const context = Object.fromEntries([
    'scale', 'setTransform', 'clearRect', 'translate', 'rotate', 'drawImage'
  ].map(name => [name, () => {}]))
  window.CanvasRenderingContext2D = function () {}
  window.HTMLCanvasElement.prototype.getContext = () => context
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get: () => 400 })
  window.Image = class {
    constructor () { this.width = 400; this.height = 200; this.style = {} }
    set src (value) { window.queueMicrotask(() => this.onload?.()) }
    removeAttribute () {}
  }

  const pkg = require('../package.json')
  assert.equal(pkg.unpkg, pkg.jsdelivr)
  window.eval(readFileSync(resolve(__dirname, '..', pkg.unpkg), 'utf8'))
  assert.ok(window.PictureInput, 'bundle exports the PictureInput global')
  const events = []
  const orientations = []
  let loaded
  let prefilled
  const nextChange = () => new Promise(resolve => { loaded = resolve })
  let changed = nextChange()
  const prefillDone = new Promise(resolve => { prefilled = resolve })
  async function waitFor (promise) {
    let timer
    try {
      return await Promise.race([
        promise,
        new Promise((resolve, reject) => { timer = window.setTimeout(() => reject(new Error('Bundle did not finish loading')), 2000) })
      ])
    } finally {
      window.clearTimeout(timer)
    }
  }
  app = window.Vue.createApp({
    setup () {
      const picture = window.Vue.useTemplateRef('picture')
      return () => window.Vue.h('div', [
        window.Vue.h(window.PictureInput, {
          ref: 'picture', name: 'photo', removable: true, width: 400, height: 200,
          onChange: image => { events.push(['change', image]); loaded(image) },
          onPrefill: () => { events.push(['prefill']); prefilled() },
          onRemove: () => events.push(['remove']),
          onAspectratiochange: orientation => orientations.push(orientation)
        }),
        window.Vue.h('output', { id: 'public-state' }, JSON.stringify(picture.value ? {
          image: picture.value.image, name: picture.value.fileName,
          size: picture.value.fileSize, type: picture.value.fileType,
          modified: picture.value.fileModified
        } : null))
      ])
    }
  })
  const parent = app.mount('#app')
  const input = window.document.querySelector('input[type="file"]')
  assert.ok(input, 'compiled component mounts')
  const picture = parent.$refs.picture
  assert.equal(picture.image, undefined)
  assert.equal(picture.file, undefined)
  for (const method of ['selectImage', 'rotateImage', 'preloadImage', 'removeImage']) {
    assert.equal(typeof picture[method], 'function', `${method} is exposed`)
  }
  let pickerClicks = 0
  input.addEventListener('click', () => { pickerClicks++ })
  picture.selectImage()
  assert.equal(pickerClicks, 1)
  assert.match([...window.document.querySelectorAll('style')].map(style => style.textContent).join('\n'), /\.picture-input/)
  const file = new window.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' })
  // Use the same native FileList mechanism as the source regression suite.
  input.files = nativeFiles([file], window.document)
  input.dispatchEvent(new window.Event('change', { bubbles: true }))
  const image = await waitFor(changed)
  assert.equal(image, 'data:image/png;base64,iVBORw==')
  assert.deepEqual(events, [['change', image]])
  assert.equal(picture.file, file)
  assert.equal(picture.image, image)

  const renderedState = () => JSON.parse(window.document.querySelector('#public-state').textContent)
  await window.Vue.nextTick()
  assert.deepEqual(renderedState(), {
    image, name: file.name, size: file.size, type: file.type, modified: file.lastModified
  })
  picture.rotateImage()
  assert.deepEqual(orientations, ['portrait'])
  assert.equal(picture.image, image)

  const replacement = new window.File([new Uint8Array([1, 2, 3, 4])], 'replacement.png', { type: 'image/png', lastModified: 42 })
  changed = nextChange()
  input.files = nativeFiles([replacement], window.document)
  input.dispatchEvent(new window.Event('change', { bubbles: true }))
  const replacementImage = await waitFor(changed)
  assert.equal(replacementImage, 'data:image/png;base64,AQIDBA==')
  assert.equal(picture.file, replacement)
  await window.Vue.nextTick()
  assert.deepEqual(renderedState(), {
    image: replacementImage, name: replacement.name, size: 4, type: 'image/png', modified: 42
  })

  const prefill = new window.Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })
  picture.preloadImage(prefill)
  await waitFor(prefillDone)
  await window.Vue.nextTick()
  assert.equal(picture.file, prefill)
  assert.equal(input.files[0], replacement, 'prefill retains the native selection')
  assert.deepEqual(renderedState(), { image, name: '', size: 4, type: 'image/png', modified: 0 })
  picture.removeImage()
  await window.Vue.nextTick()
  assert.equal(input.files.length, 0)
  assert.equal(picture.file, null)
  assert.deepEqual(renderedState(), { image: '', name: '', size: 0, type: '', modified: 0 })

  changed = nextChange()
  input.files = nativeFiles([file], window.document)
  input.dispatchEvent(new window.Event('change', { bubbles: true }))
  await waitFor(changed)

  await window.Vue.nextTick()
  const remove = [...window.document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Remove Photo')
  assert.ok(remove, 'remove button becomes available')
  remove.click()
  await window.Vue.nextTick()
  assert.equal(input.files.length, 0)
  assert.equal(picture.file, null)
  assert.equal(picture.image, '')
  assert.ok(window.document.querySelector('.picture-inner'), 'empty preview returns')
  assert.deepEqual(events, [
    ['change', image], ['change', replacementImage], ['prefill'], ['remove'], ['change', image], ['remove']
  ])
  assert.deepEqual(errors, [])
})
