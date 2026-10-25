import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const root = new URL('../../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const vue = JSON.parse(readFileSync(new URL(import.meta.resolve('vue/package.json')), 'utf8'))
const images = JSON.parse(readFileSync(new URL('fixtures/images.json', import.meta.url), 'utf8'))
const orientationImage = JSON.parse(readFileSync(new URL('fixtures/orientation.json', import.meta.url), 'utf8'))
const failures = new WeakMap()
const red = [255, 0, 0, 255]
const blue = [0, 0, 255, 255]
const orientations = [
  { value: 1, width: 96, height: 64, rotate: false, corners: [0, 1, 2, 3] },
  { value: 3, width: 96, height: 64, rotate: -Math.PI, corners: [3, 2, 1, 0] },
  { value: 6, width: 64, height: 96, rotate: Math.PI / 2, corners: [2, 0, 3, 1] },
  { value: 8, width: 64, height: 96, rotate: -Math.PI / 2, corners: [1, 3, 0, 2] }
]
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

function orientedJPEG (orientation) {
  const jpeg = Buffer.from(orientationImage.base64, 'base64')
  // A little-endian EXIF APP1 segment with one SHORT orientation tag. Insert
  // metadata after SOI without altering the complete, decodable JPEG scan.
  const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000000000000000000', 'hex')
  exif.writeUInt16LE(orientation, 28)
  return {
    name: `orientation-${orientation}.jpg`, mimeType: 'image/jpeg',
    buffer: Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)])
  }
}

function canvasPixels (page, points = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
  return page.locator('canvas').evaluate((canvas, points) => points.map(([x, y]) =>
    Array.from(canvas.getContext('2d').getImageData(
      Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1
    ).data)
  ), points)
}

function expectColors (pixels, corners) {
  expect(pixels).toHaveLength(corners.length)
  pixels.forEach((pixel, index) => {
    expect(pixel[3]).toBe(255)
    orientationImage.colors[corners[index]].forEach((channel, component) => {
      // JPEG decoding can differ slightly; sample well away from block edges.
      expect(Math.abs(pixel[component] - channel)).toBeLessThanOrEqual(8)
    })
  })
}

async function resizeViewport (page, width) {
  await page.evaluate(() => {
    window.pictureFixture.resized = new Promise(resolve => {
      window.addEventListener('resize', () => resolve(), { once: true })
    })
  })
  await page.setViewportSize({ width, height: 600 })
  await page.evaluate(() => window.pictureFixture.resized)
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
  const expectedResourceErrors = []
  failures.set(page, { errors, expectedResourceErrors })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const location = new URL(message.location().url || '/', baseURL)
    const expected = expectedResourceErrors.findIndex(error =>
      location.origin === new URL(baseURL).origin && location.pathname === error.pathname && message.text() === error.text
    )
    if (expected === -1) errors.push(message.text())
    else expectedResourceErrors.splice(expected, 1)
  })
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
  expect(failures.get(page)).toEqual({ errors: [], expectedResourceErrors: [] })
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

test('Tab reaches the canvas and Enter opens exactly one picker; the change button remains keyboard accessible', async ({ page }) => {
  const choosers = []
  page.on('filechooser', chooser => choosers.push(chooser))
  await page.keyboard.press('Tab')
  await expect(page.locator('#select-through-ref')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('canvas')).toBeFocused()
  let chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles(payload())
  await expectEvents(page, ['change'])
  expect(choosers).toHaveLength(1)

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Change Photo', exact: true })).toBeFocused()
  chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles(payload('portrait', 'keyboard-replacement.png'))
  await expectEvents(page, ['change', 'change'])
  expect(choosers).toHaveLength(2)
  expect(await state(page)).toMatchObject({ fileName: 'keyboard-replacement.png', sameAsNative: true })
  expect(await submittedFile(page)).toMatchObject({ name: 'keyboard-replacement.png' })
})

for (const changeOnClick of [false, true]) {
  test(`empty instructions pass pointer clicks through to the picker with changeOnClick=${changeOnClick}`, async ({ page }) => {
    await page.evaluate(changeOnClick => window.pictureFixture.updateProps({ changeOnClick }), changeOnClick)
    const instructions = page.locator('.picture-inner-text')
    await expect(instructions).toBeVisible()
    const box = await instructions.boundingBox()
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).tagName, point)).toBe('CANVAS')
    const choosers = []
    page.on('filechooser', chooser => choosers.push(chooser))
    const chooser = page.waitForEvent('filechooser')
    // Use a real pointer at the text, not dispatchEvent or a forced canvas click.
    await page.mouse.click(point.x, point.y)
    await (await chooser).setFiles(payload())
    await expectEvents(page, ['change'])
    expect(choosers).toHaveLength(1)
    expect(await page.evaluate(() => window.pictureFixture.pixel())).toEqual(red)
  })
}

for (const source of ['selected', 'prefilled']) {
  test(`${source} canvas clicks emit once and open a picker only when changeOnClick is enabled`, async ({ page }) => {
    const initialEvent = source === 'selected' ? 'change' : 'prefill'
    if (source === 'selected') await page.locator('input[type=file]').setInputFiles(payload())
    else await page.evaluate(() => window.pictureFixture.updateProps({
      prefill: '/photo.png', prefillOptions: { fileName: 'prefilled.png' }
    }))
    await expectEvents(page, [initialEvent])
    const previous = await state(page)
    const choosers = []
    page.on('filechooser', chooser => choosers.push(chooser))
    await page.locator('canvas').click()
    await expectEvents(page, [initialEvent, 'click'])
    expect(await state(page)).toEqual(previous)
    expect(choosers).toHaveLength(0)

    await page.evaluate(() => window.pictureFixture.updateProps({ changeOnClick: true }))
    const chooser = page.waitForEvent('filechooser')
    await page.locator('canvas').click()
    await (await chooser).setFiles(payload('portrait', 'click-replacement.png'))
    await expectEvents(page, [initialEvent, 'click', 'click', 'change'])
    // The positive picker event is also a coordination point for the earlier
    // disabled click: an unexpected chooser there would make this count two.
    expect(choosers).toHaveLength(1)
    expect(await state(page)).toMatchObject({
      image: dataURL('portrait'), fileName: 'click-replacement.png', selected: true, preloaded: false, sameAsNative: true
    })
    expect(await submittedFile(page)).toMatchObject({ name: 'click-replacement.png' })
  })
}

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

test('an HTTP prefill failure preserves the decoded selection, source identity, and native upload', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(payload('portrait', 'retained.png'))
  await expectEvents(page, ['change'])
  const previous = await state(page)
  await page.evaluate(() => {
    const picture = window.pictureFixture.picture
    const input = picture.$refs.fileInput
    window.pictureFixture.retained = { file: picture.file, image: picture.imageObject, files: input.files, value: input.value }
  })
  // Permit exactly this resource's one expected Chromium diagnostic, not all
  // console errors in this test or all HTTP failures across the suite.
  failures.get(page).expectedResourceErrors.push({
    pathname: '/failed-prefill.jpg',
    text: 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)'
  })
  const fetched = page.waitForResponse(response => new URL(response.url()).pathname === '/failed-prefill.jpg')
  await page.evaluate(() => window.pictureFixture.updateProps({ prefill: '/failed-prefill.jpg' }))
  const response = await fetched
  expect(response.status()).toBe(503)
  // Failed HTTP responses are rejected at the headers without reading their
  // body; coordinate on the handled error, not an unconsumed fetch body.
  await expectEvents(page, ['change', 'error'])
  expect((await events(page))[1].error).toEqual({
    type: 'failedPrefill', message: 'Failed loading prefill image: Error: HTTP 503'
  })
  expect(await state(page)).toEqual(previous)
  expect(await page.evaluate(() => {
    const { picture, retained } = window.pictureFixture
    const input = picture.$refs.fileInput
    return picture.file === retained.file && picture.imageObject === retained.image &&
      input.files === retained.files && input.value === retained.value
  })).toBe(true)
  expect(await submittedFile(page)).toEqual({ name: 'retained.png', size: payload('portrait').buffer.length, type: 'image/png' })
  expect(await page.evaluate(() => window.pictureFixture.pixel())).toEqual(blue)
})

for (const stage of ['headers', 'body']) {
  test(`unmount aborts a native prefill with pending ${stage} and ignores a later server release`, async ({ page, request }) => {
    const id = randomUUID()
    const control = '/prefill-control?id=' + id
    const matches = request => {
      const url = new URL(request.url())
      return url.pathname === '/delayed-prefill.jpg' && url.searchParams.get('id') === id
    }
    try {
      await page.locator('input[type=file]').setInputFiles(payload())
      await expectEvents(page, ['change'])
      await page.evaluate(() => {
        const picture = window.pictureFixture.picture
        const canvas = picture.$refs.previewCanvas
        window.pictureFixture.retained = { picture, file: picture.file, canvas, bitmap: canvas.toDataURL() }
      })
      const headers = stage === 'body' ? page.waitForResponse(matches) : null
      await page.evaluate(prefill => window.pictureFixture.updateProps({ prefill }), `/delayed-prefill.jpg?id=${id}&stage=${stage}`)
      await expect.poll(async () => (await request.get(control)).json()).toMatchObject({
        started: true, stage, cancelled: false, released: false
      })
      if (headers) expect((await headers).status()).toBe(200)
      await expectEvents(page, ['change'])

      const failed = page.waitForEvent('requestfailed', matches)
      await page.evaluate(() => window.pictureFixture.unmount())
      expect((await failed).failure().errorText).toBe('net::ERR_ABORTED')
      await expect(page.locator('#app')).toBeEmpty()
      await expect.poll(async () => (await request.get(control)).json()).toMatchObject({ cancelled: true, closed: true })
      const released = await request.post(control)
      expect(await released.json()).toMatchObject({ cancelled: true, closed: true, released: true })
      // A render frame after the real network cancellation/release drains
      // queued browser work without a time-based sleep or mocked callbacks.
      const after = await page.evaluate(async () => {
        window.dispatchEvent(new Event('resize'))
        await new Promise(resolve => requestAnimationFrame(resolve))
        const { retained } = window.pictureFixture
        return {
          events: window.pictureFixture.events.map(event => event.type),
          sameFile: retained.picture.file === retained.file,
          image: retained.picture.image,
          samePixels: retained.canvas.toDataURL() === retained.bitmap
        }
      })
      expect(after).toEqual({ events: ['change'], sameFile: true, image: dataURL('landscape'), samePixels: true })
    } finally {
      await request.delete(control)
    }
  })
}

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

for (const orientation of orientations) {
  test(`EXIF ${orientation.value} decodes and displays the correct corners without double rotation`, async ({ page }) => {
    await page.evaluate(() => window.pictureFixture.updateProps({ autoToggleAspectRatio: true }))
    const file = orientedJPEG(orientation.value)
    await page.locator('input[type=file]').setInputFiles(file)
    await expectEvents(page, ['change'])
    expect(await state(page)).toMatchObject({
      imageWidth: orientation.width, imageHeight: orientation.height, rotate: orientation.rotate,
      canvasWidth: orientation.width > orientation.height ? 400 : 200,
      canvasHeight: orientation.width > orientation.height ? 200 : 400,
      selected: true, preloaded: false, sameAsNative: true
    })
    expect(await page.evaluate(() => {
      const image = window.pictureFixture.picture.imageObject
      return {
        complete: image.complete, width: image.naturalWidth, height: image.naturalHeight,
        nativeOrientation: typeof image.style.imageOrientation === 'string'
      }
    })).toEqual({ complete: true, width: orientation.width, height: orientation.height, nativeOrientation: true })
    expectColors(await canvasPixels(page), orientation.corners)
    expect((await events(page))[0].image).toBe('data:image/jpeg;base64,' + file.buffer.toString('base64'))
    expect(await submittedFile(page)).toEqual({ name: file.name, size: file.buffer.length, type: 'image/jpeg' })
    await expectEvents(page, ['change'])
  })
}

test.describe('DPR 2', () => {
  test.use({ deviceScaleFactor: 2 })

  for (const crop of [true, false]) {
    test(`${crop ? 'cropped' : 'contained'} pixels stay centered in a doubled backing buffer through resize and removal`, async ({ page }) => {
      await page.evaluate(crop => window.pictureFixture.updateProps({ crop }), crop)
      await page.locator('input[type=file]').setInputFiles(orientedJPEG(6))
      await expectEvents(page, ['change'])
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2)
      // A contained 2:3 portrait occupies the middle third of this 2:1 canvas.
      const points = crop ? [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]
        : [[5 / 12, 0.25], [7 / 12, 0.25], [5 / 12, 0.75], [7 / 12, 0.75]]
      for (const width of [400, 320]) {
        if (width === 320) await resizeViewport(page, width)
        expect(await state(page)).toMatchObject({ previewWidth: width, previewHeight: width / 2, pixelRatio: 2 })
        expect(await page.locator('canvas').boundingBox()).toMatchObject({ width, height: width / 2 })
        expect(await page.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height }))).toEqual({
          width: width * 2, height: width
        })
        expectColors(await canvasPixels(page, points), [2, 0, 3, 1])
        const edges = await canvasPixels(page, [[0.1, 0.5], [0.9, 0.5]])
        expect(edges.map(pixel => pixel[3])).toEqual(crop ? [255, 255] : [0, 0])
      }
      await page.getByRole('button', { name: 'Remove Photo', exact: true }).click()
      await expectEvents(page, ['change', 'remove'])
      expect(await canvasPixels(page, points)).toEqual(Array(4).fill([0, 0, 0, 0]))
      expect(await page.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height }))).toEqual({
        width: 640, height: 320
      })
    })
  }
})

test('an initialized preview survives hide/resize/reveal and remeasures margins and limits on the next resize', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(payload())
  await expectEvents(page, ['change'])
  await page.evaluate(async () => {
    window.pictureFixture.selectedSource = window.pictureFixture.picture.file
    await window.pictureFixture.updateProps({ margin: '10', toggleAspectRatio: false })
    document.querySelector('#host').style.width = '300px'
  })
  await resizeViewport(page, 700)
  expect(await state(page)).toMatchObject({ containerWidth: 300, previewWidth: 280, previewHeight: 140 })
  expect(await page.locator('canvas').boundingBox()).toMatchObject({ x: 10, width: 280, height: 140 })
  const bitmap = await page.locator('canvas').evaluate(canvas => canvas.toDataURL())

  await page.locator('#host').evaluate(host => {
    host.style.display = 'none'
    host.style.width = '200px'
  })
  await resizeViewport(page, 600)
  expect(await page.locator('#picture-input').evaluate(container => container.clientWidth)).toBe(0)
  expect(await page.locator('canvas').boundingBox()).toBeNull()
  expect(await state(page)).toMatchObject({ containerWidth: 300, previewWidth: 280, previewHeight: 140 })
  expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).toBe(bitmap)

  await page.locator('#host').evaluate(host => { host.style.display = '' })
  expect(await page.locator('#picture-input').evaluate(container => container.clientWidth)).toBe(200)
  // Revealing alone is not a resize subscription or a ResizeObserver contract.
  expect(await state(page)).toMatchObject({ containerWidth: 300, previewWidth: 280, previewHeight: 140 })
  expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).toBe(bitmap)
  await resizeViewport(page, 500)
  expect(await state(page)).toMatchObject({ containerWidth: 200, previewWidth: 180, previewHeight: 90 })
  expect(await page.locator('canvas').boundingBox()).toMatchObject({ x: 10, width: 180, height: 90 })
  expect(await page.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height }))).toEqual({ width: 180, height: 90 })
  expect(await page.evaluate(() => window.pictureFixture.pixel())).toEqual(red)

  await page.locator('#host').evaluate(host => { host.style.width = '800px'; host.style.maxWidth = 'none' })
  await resizeViewport(page, 900)
  expect(await state(page)).toMatchObject({
    containerWidth: 800, canvasWidth: 400, canvasHeight: 200, previewWidth: 400, previewHeight: 200,
    image: dataURL('landscape'), fileName: 'landscape.png', sameAsNative: true
  })
  expect(await page.locator('canvas').boundingBox()).toMatchObject({ x: 200, width: 400, height: 200 })
  expect(await page.evaluate(() => window.pictureFixture.picture.file === window.pictureFixture.selectedSource)).toBe(true)
  expect(await page.evaluate(() => window.pictureFixture.pixel())).toEqual(red)
  expect(await submittedFile(page)).toEqual({ name: 'landscape.png', size: payload().buffer.length, type: 'image/png' })
  await expectEvents(page, ['change'])
})
