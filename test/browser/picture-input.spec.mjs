import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const root = new URL('../../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const vue = JSON.parse(readFileSync(new URL(import.meta.resolve('vue/package.json')), 'utf8'))
const images = JSON.parse(readFileSync(new URL('fixtures/images.json', import.meta.url), 'utf8'))
const failures = new WeakMap()
const red = [255, 0, 0, 255]
const blue = [0, 0, 255, 255]
const photos = [
  { name: 'landscape', width: 640, height: 424 },
  { name: 'portrait', width: 640, height: 965 }
].map(photo => {
  const file = new URL(`fixtures/${photo.name}.jpg`, import.meta.url)
  const bytes = readFileSync(file)
  return {
    ...photo, file: fileURLToPath(file), filename: photo.name + '.jpg', size: bytes.length,
    dataURL: 'data:image/jpeg;base64,' + bytes.toString('base64'),
    previewWidth: photo.width > photo.height ? 400 : 200,
    previewHeight: photo.width > photo.height ? 200 : 400
  }
})

function payload (kind = 'landscape', name = kind + '.png') {
  return { name, mimeType: 'image/png', buffer: Buffer.from(images[kind].base64, 'base64') }
}

function dataURL (kind) {
  return 'data:image/png;base64,' + images[kind].base64
}

function state (page) {
  return page.locator('#public-state').evaluate(output => {
    const picture = window.pictureFixture.picture
    const nativeFile = picture.$refs.fileInput.files[0]
    return {
      // Public values must come from the parent's reactive output. Only
      // non-reactive native-input fields are inspected directly here.
      ...JSON.parse(output.textContent),
      nativeFile: nativeFile ? {
        name: nativeFile.name, size: nativeFile.size, type: nativeFile.type, modified: nativeFile.lastModified
      } : 'unset',
      sameAsNative: !!picture.file && picture.file === nativeFile
    }
  })
}

function events (page) {
  return page.locator('#events').evaluate(output => JSON.parse(output.textContent))
}

async function expectEvents (page, types) {
  await expect.poll(async () => (await events(page)).map(event => event.type)).toEqual(types)
}

function submittedFile (page) {
  return page.locator('form').evaluate(form => {
    const file = new FormData(form).get('photo')
    return file && { name: file.name, size: file.size, type: file.type }
  })
}

async function expectPhotoPreview (page, photo, crop) {
  const current = await state(page)
  expect(current).toMatchObject({
    image: photo.dataURL, fileName: photo.filename, fileSize: photo.size, fileType: 'image/jpeg',
    imageWidth: photo.width, imageHeight: photo.height,
    canvasWidth: photo.previewWidth, canvasHeight: photo.previewHeight,
    previewWidth: photo.previewWidth, previewHeight: photo.previewHeight
  })
  expect(current.imageRatio).toBeCloseTo(photo.width / photo.height)
  const decoded = await page.evaluate(() => {
    const image = window.pictureFixture.picture.imageObject
    return { complete: image.complete, width: image.naturalWidth, height: image.naturalHeight }
  })
  expect(decoded).toEqual({ complete: true, width: photo.width, height: photo.height })
  expect(await page.locator('canvas').boundingBox()).toMatchObject({
    width: photo.previewWidth, height: photo.previewHeight
  })
  // Check coverage and photographic detail, not JPEG-specific RGB values or
  // screenshot baselines that can vary with decoder/rendering versions.
  const pixels = await page.locator('canvas').evaluate(canvas => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    const colors = new Set()
    let opaque = 0
    let transparent = 0
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] === 255) {
        opaque++
        colors.add((data[offset] >> 5) * 64 + (data[offset + 1] >> 5) * 8 + (data[offset + 2] >> 5))
      } else if (data[offset + 3] === 0) transparent++
    }
    return { opaque, transparent, total: canvas.width * canvas.height, colors: colors.size }
  })
  expect(pixels.colors).toBeGreaterThan(16)
  if (crop) {
    expect(pixels.opaque).toBe(pixels.total)
    expect(pixels.transparent).toBe(0)
  } else {
    expect(pixels.transparent).toBeGreaterThan(0)
    expect(pixels.opaque).toBeGreaterThan(pixels.total / 2)
    expect(pixels.opaque).toBeLessThan(pixels.total)
  }
}

test.beforeEach(async ({ page, baseURL }) => {
  const errors = []
  failures.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('dialog', async dialog => {
    errors.push('Unexpected dialog: ' + dialog.message())
    await dialog.dismiss()
  })
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.origin !== new URL(baseURL).origin) {
      errors.push('Unexpected external request: ' + url)
    }
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true')
})

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.pictureFixture?.unmount())
  expect(failures.get(page)).toEqual([])
})

test('loads the exact published ESM with local Vue, injected CSS, and a flat public API', async ({ page, request }) => {
  expect(pkg.main).toBe('PictureInput.vue')
  expect(pkg.unpkg).toBe('dist/vue-picture-input.mjs')
  expect(pkg.jsdelivr).toBe(pkg.unpkg)
  expect(readdirSync(new URL('dist/', root))).toEqual(['vue-picture-input.mjs'])
  const bundle = readFileSync(new URL(pkg.unpkg, root), 'utf8')
  expect(bundle).toMatch(/from\s*["']vue["']/)
  const response = await request.get('/picture-input.mjs')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('text/javascript')
  expect(await response.text()).toBe(bundle)
  expect(await page.evaluate(() => window.pictureFixture.vueVersion)).toBe(vue.version)
  expect(await page.evaluate(() => ({
    noGlobals: window.Vue === undefined && window.PictureInput === undefined,
    initiallyUnset: window.pictureFixture.picture.image === undefined && window.pictureFixture.picture.file === undefined,
    methods: ['selectImage', 'removeImage', 'rotateImage', 'preloadImage'].every(
      name => typeof window.pictureFixture.picture[name] === 'function'
    )
  }))).toEqual({ noGlobals: true, initiallyUnset: true, methods: true })
  await expect(page.locator('.picture-inner')).toHaveCSS('pointer-events', 'none')
  await expect(page.locator('input[type=file]')).toHaveCSS('display', 'none')
  expect(await page.locator('canvas').boundingBox()).toMatchObject({ width: 400, height: 200 })
  expect((await state(page)).file).toBe('unset')
})

test('native picker selection and replacement draw before emitting one change and update parent refs', async ({ page }) => {
  let chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Select through ref', exact: true }).click()
  await (await chooser).setFiles(payload('landscape', 'first.png'))
  await expectEvents(page, ['change'])
  expect(await events(page)).toEqual([{ type: 'change', image: dataURL('landscape'), pixel: red }])
  expect(await state(page)).toMatchObject({
    image: dataURL('landscape'), fileName: 'first.png', fileSize: payload().buffer.length,
    fileType: 'image/png', sameAsNative: true, selected: true, preloaded: false
  })
  expect(await submittedFile(page)).toEqual({ name: 'first.png', size: payload().buffer.length, type: 'image/png' })

  chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Change Photo', exact: true }).click()
  await (await chooser).setFiles(payload('portrait', 'replacement.png'))
  await expectEvents(page, ['change', 'change'])
  expect((await events(page))[1]).toEqual({ type: 'change', image: dataURL('portrait'), pixel: blue })
  const current = await state(page)
  expect(current).toMatchObject({
    image: dataURL('portrait'), fileName: 'replacement.png', fileSize: payload('portrait').buffer.length,
    fileType: 'image/png', sameAsNative: true
  })
  expect(current.fileModified).toBe(current.file.modified)
  expect(current.fileModified).toBeGreaterThan(0)
  await page.locator('canvas').click()
  await expectEvents(page, ['change', 'change', 'click'])
})

test('public and button aspect toggles and native viewport resizing preserve the image', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(payload())
  await expectEvents(page, ['change'])
  await page.evaluate(() => window.pictureFixture.picture.rotateImage())
  await expectEvents(page, ['change', 'aspectratiochange'])
  expect((await events(page))[1].orientation).toBe('portrait')
  expect(await state(page)).toMatchObject({ canvasWidth: 200, canvasHeight: 400, previewWidth: 200, previewHeight: 400 })

  await page.getByRole('button', { name: 'Landscape/Portrait', exact: true }).click()
  await expectEvents(page, ['change', 'aspectratiochange', 'aspectratiochange'])
  expect((await events(page))[2].orientation).toBe('landscape')
  await page.setViewportSize({ width: 320, height: 600 })
  await expect.poll(async () => (await state(page)).previewWidth).toBe(320)
  expect(await state(page)).toMatchObject({
    previewHeight: 160, image: dataURL('landscape'), fileName: 'landscape.png', sameAsNative: true
  })
  expect(await page.locator('canvas').boundingBox()).toMatchObject({ width: 320, height: 160 })
  expect(await page.evaluate(() => window.pictureFixture.pixel())).toEqual(red)
  await expectEvents(page, ['change', 'aspectratiochange', 'aspectratiochange'])
})

for (const kind of ['File', 'Blob']) {
  test(`${kind} prefills keep their identity and native selection; public and button removal clear everything`, async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles(payload('portrait', 'selected.png'))
    await expectEvents(page, ['change'])
    await page.evaluate(async kind => {
      const blob = await (await fetch('/photo.png')).blob()
      const source = kind === 'File' ? new File([blob], 'prefilled.png', { type: blob.type, lastModified: 42 }) : blob
      window.pictureFixture.prefillSource = source
      window.pictureFixture.picture.preloadImage(source)
    }, kind)
    await expectEvents(page, ['change', 'prefill'])
    expect((await events(page))[1].pixel).toEqual(red)
    expect(await page.evaluate(() => window.pictureFixture.picture.file === window.pictureFixture.prefillSource)).toBe(true)
    expect(await state(page)).toMatchObject({
      image: dataURL('landscape'), fileName: kind === 'File' ? 'prefilled.png' : '',
      fileModified: kind === 'File' ? 42 : 0, selected: false, preloaded: true,
      nativeFile: { name: 'selected.png' }, sameAsNative: false
    })
    expect(await submittedFile(page)).toEqual({ name: 'selected.png', size: payload('portrait').buffer.length, type: 'image/png' })

    await page.evaluate(() => window.pictureFixture.picture.removeImage())
    await expectEvents(page, ['change', 'prefill', 'remove'])
    expect(await state(page)).toMatchObject({
      image: '', file: null, fileName: '', fileType: '', fileSize: 0, fileModified: 0,
      nativeFile: 'unset', selected: false, preloaded: false
    })
    expect(await submittedFile(page)).toMatchObject({ name: '', size: 0 })
    expect(await page.evaluate(() => window.pictureFixture.pixel())).toEqual([0, 0, 0, 0])
    await expect(page.locator('.picture-inner')).toBeVisible()

    await page.locator('input[type=file]').setInputFiles(payload('portrait', 'selected.png'))
    await expectEvents(page, ['change', 'prefill', 'remove', 'change'])
    await page.getByRole('button', { name: 'Remove Photo', exact: true }).click()
    await expectEvents(page, ['change', 'prefill', 'remove', 'change', 'remove'])
    expect((await state(page)).file).toBeNull()
    expect(await submittedFile(page)).toMatchObject({ name: '', size: 0 })
  })
}

test('URL prop prefills use real fetch and preserve native upload until the prop is cleared', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(payload('portrait', 'selected.png'))
  await expectEvents(page, ['change'])
  const fetched = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname === '/photo.png' && url.searchParams.has('_')
  })
  await page.evaluate(() => window.pictureFixture.updateProps({
    prefill: '/photo.png', prefillOptions: { fileName: 'remote.png' }
  }))
  expect((await fetched).headers().accept).toBe('image/*')
  await expectEvents(page, ['change', 'prefill'])
  expect(await page.evaluate(() => window.pictureFixture.picture.file instanceof File)).toBe(true)
  expect(await state(page)).toMatchObject({
    image: dataURL('landscape'), fileName: 'remote.png', selected: false, preloaded: true,
    nativeFile: { name: 'selected.png' }, sameAsNative: false
  })
  expect(await submittedFile(page)).toMatchObject({ name: 'selected.png' })
  await page.evaluate(() => window.pictureFixture.updateProps({ prefill: '' }))
  await expectEvents(page, ['change', 'prefill', 'remove'])
  expect(await state(page)).toMatchObject({ image: '', file: null, nativeFile: 'unset', selected: false, preloaded: false })
  expect(await submittedFile(page)).toMatchObject({ name: '', size: 0 })
})

for (const errorType of ['fileType', 'fileSize']) {
  test(`${errorType} rejection clears the real input and FormData while retaining the previous source`, async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles(payload())
    await expectEvents(page, ['change'])
    await page.evaluate(() => {
      window.pictureFixture.selectedSource = window.pictureFixture.picture.file
      return window.pictureFixture.updateProps({ size: 1 })
    })
    const rejected = errorType === 'fileType'
      ? { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('Not an image') }
      : { name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(1024 * 1024 + 1) }
    await page.locator('input[type=file]').setInputFiles(rejected)
    await expectEvents(page, ['change', 'error'])
    expect((await events(page))[1].error).toMatchObject({
      type: errorType, fileName: rejected.name, fileSize: rejected.buffer.length, fileType: rejected.mimeType
    })
    expect(await page.evaluate(() => window.pictureFixture.picture.file === window.pictureFixture.selectedSource)).toBe(true)
    expect(await state(page)).toMatchObject({
      image: dataURL('landscape'), fileName: 'landscape.png', selected: true
    })
    // Clearing a native input is not a reactive component-state change.
    expect(await page.locator('input[type=file]').evaluate(input => input.files.length)).toBe(0)
    expect(await submittedFile(page)).toMatchObject({ name: '', size: 0 })
    expect(await page.evaluate(() => window.pictureFixture.pixel())).toEqual(red)
  })
}

test('native DataTransfer drops highlight, prevent default, decode, and populate the form input', async ({ page }) => {
  const transfer = await page.evaluateHandle(({ base64 }) => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File([bytes], 'dropped.png', { type: 'image/png', lastModified: 42 }))
    return dataTransfer
  }, images.landscape)
  try {
    const canvas = page.locator('canvas')
    await canvas.dispatchEvent('dragenter', { dataTransfer: transfer })
    await expect(canvas).toHaveClass(/dragging-over/)
    const prevented = await canvas.evaluate((element, dataTransfer) => {
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
      element.dispatchEvent(event)
      return event.defaultPrevented
    }, transfer)
    expect(prevented).toBe(true)
    await expectEvents(page, ['change'])
    await expect(canvas).not.toHaveClass(/dragging-over/)
    expect(await events(page)).toEqual([{ type: 'change', image: dataURL('landscape'), pixel: red }])
    expect(await state(page)).toMatchObject({ fileName: 'dropped.png', fileModified: 42, sameAsNative: true })
    expect(await submittedFile(page)).toEqual({ name: 'dropped.png', size: payload().buffer.length, type: 'image/png' })
  } finally {
    await transfer.dispose()
  }
})

for (const photo of photos) {
  for (const crop of [true, false]) {
    test(`${photo.filename} decodes, matches aspect, and renders a ${crop ? 'cropped' : 'contained'} preview`, async ({ page }) => {
      await page.evaluate(crop => window.pictureFixture.updateProps({ autoToggleAspectRatio: true, crop }), crop)
      // Pass the checked-in JPEG path, not a generated buffer or mock image.
      await page.locator('input[type=file]').setInputFiles(photo.file)
      await expectEvents(page, ['change'])
      await expectPhotoPreview(page, photo, crop)
      expect(await state(page)).toMatchObject({ selected: true, preloaded: false, sameAsNative: true })
      expect(await submittedFile(page)).toEqual({ name: photo.filename, size: photo.size, type: 'image/jpeg' })
      const [changed] = await events(page)
      expect(changed.image).toBe(photo.dataURL)
      expect(changed.pixel[3]).toBe(255)
      // Automatic matching must not emit a manual aspectratiochange event.
      await expectEvents(page, ['change'])
    })
  }

  test(`${photo.filename} prefills from the local JPEG URL without replacing the native upload`, async ({ page }) => {
    const selected = photos.find(candidate => candidate.name !== photo.name)
    await page.evaluate(() => window.pictureFixture.updateProps({ autoToggleAspectRatio: true }))
    await page.locator('input[type=file]').setInputFiles(selected.file)
    await expectEvents(page, ['change'])
    const response = page.waitForResponse(response => new URL(response.url()).pathname === '/' + photo.filename)
    await page.evaluate(filename => window.pictureFixture.updateProps({
      prefill: '/' + filename, prefillOptions: { fileName: filename }
    }), photo.filename)
    expect((await response).headers()['content-type']).toBe('image/jpeg')
    await expectEvents(page, ['change', 'prefill'])
    await expectPhotoPreview(page, photo, true)
    expect(await state(page)).toMatchObject({
      selected: false, preloaded: true, nativeFile: { name: selected.filename }, sameAsNative: false
    })
    expect(await submittedFile(page)).toEqual({ name: selected.filename, size: selected.size, type: 'image/jpeg' })
    expect((await events(page))[1].pixel[3]).toBe(255)
    expect(await page.evaluate(() => window.pictureFixture.picture.file instanceof File)).toBe(true)
  })
}
