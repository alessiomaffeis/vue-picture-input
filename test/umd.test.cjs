const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const test = require('node:test')
const { JSDOM, VirtualConsole } = require('jsdom')
const { nativeFiles } = require('./helpers/native-files.cjs')

test('published UMD mounts with global Vue, injects CSS, and handles selection/removal', { timeout: 5000 }, async t => {
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
    set src (value) { window.queueMicrotask(() => this.onload()) }
  }

  const pkg = require('../package.json')
  assert.equal(pkg.unpkg, pkg.jsdelivr)
  window.eval(readFileSync(resolve(__dirname, '..', pkg.unpkg), 'utf8'))
  assert.ok(window.PictureInput, 'bundle exports the PictureInput global')
  const events = []
  let loaded
  const changed = new Promise(resolve => { loaded = resolve })
  app = window.Vue.createApp({
    render () {
      return window.Vue.h(window.PictureInput, {
        ref: 'picture', name: 'photo', removable: true,
        onChange: image => { events.push(['change', image]); loaded(image) },
        onRemove: () => events.push(['remove'])
      })
    }
  })
  const parent = app.mount('#app')
  const input = window.document.querySelector('input[type="file"]')
  assert.ok(input, 'compiled component mounts')
  assert.match([...window.document.querySelectorAll('style')].map(style => style.textContent).join('\n'), /\.picture-input/)
  const file = new window.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' })
  // Use the same native FileList mechanism as the source regression suite.
  input.files = nativeFiles([file], window.document)
  input.dispatchEvent(new window.Event('change', { bubbles: true }))
  const image = await Promise.race([
    changed,
    new Promise((resolve, reject) => window.setTimeout(() => reject(new Error('Bundle did not emit change')), 2000))
  ])
  assert.equal(image, 'data:image/png;base64,iVBORw==')
  assert.deepEqual(events, [['change', image]])
  assert.equal(parent.$refs.picture.file, file)
  assert.equal(parent.$refs.picture.image, image)

  await window.Vue.nextTick()
  const remove = [...window.document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Remove Photo')
  assert.ok(remove, 'remove button becomes available')
  remove.click()
  await window.Vue.nextTick()
  assert.equal(input.files.length, 0)
  assert.equal(parent.$refs.picture.file, null)
  assert.equal(parent.$refs.picture.image, '')
  assert.ok(window.document.querySelector('.picture-inner'), 'empty preview returns')
  assert.deepEqual(events, [['change', image], ['remove']])
  assert.deepEqual(errors, [])
})
