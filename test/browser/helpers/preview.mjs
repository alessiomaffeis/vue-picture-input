import { expect } from '@playwright/test'

function expectEdges (actual, expected, label) {
  expect(actual, label).not.toBeNull()
  for (const [edge, value] of Object.entries(expected)) {
    // Rasterization may round a fractional edge to either adjacent pixel.
    expect(Math.abs(actual[edge] - value), `${label}.${edge}: got ${actual[edge]}, expected ${value}`).toBeLessThanOrEqual(1)
  }
}

export async function expectCanvasSize (page, width, height, pixelRatio = 1) {
  expect(await page.locator('canvas').boundingBox()).toMatchObject({ width, height })
  expect(await page.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height }))).toEqual({
    width: width * pixelRatio, height: height * pixelRatio
  })
}

export async function expectPreviewGeometry (page, { imageWidth, imageHeight, width, height, crop, pixelRatio = 1, markerBand }) {
  await expectCanvasSize(page, width, height, pixelRatio)
  // An independent uniform-scale fit, rather than the component's per-axis
  // branches or its exposed drawing helpers/measurements.
  const scale = (crop ? Math.max : Math.min)(width / imageWidth, height / imageHeight)
  const drawnWidth = imageWidth * scale
  const drawnHeight = imageHeight * scale
  const left = (width - drawnWidth) / 2
  const top = (height - drawnHeight) / 2
  const visible = {
    left: Math.max(0, left), top: Math.max(0, top),
    right: Math.min(width, left + drawnWidth), bottom: Math.min(height, top + drawnHeight)
  }
  const bounds = Object.fromEntries(Object.entries(visible).map(([edge, value]) => [edge, value * pixelRatio]))
  const centerX = Math.floor((bounds.left + bounds.right) / 2)
  const centerY = Math.floor((bounds.top + bounds.bottom) / 2)
  const probes = [
    { x: Math.ceil(bounds.left) + 2, y: centerY, alpha: 255 },
    { x: Math.floor(bounds.left) - 2, y: centerY, alpha: 0 },
    { x: Math.floor(bounds.right) - 3, y: centerY, alpha: 255 },
    { x: Math.ceil(bounds.right) + 2, y: centerY, alpha: 0 },
    { x: centerX, y: Math.ceil(bounds.top) + 2, alpha: 255 },
    { x: centerX, y: Math.floor(bounds.top) - 2, alpha: 0 },
    { x: centerX, y: Math.floor(bounds.bottom) - 3, alpha: 255 },
    { x: centerX, y: Math.ceil(bounds.bottom) + 2, alpha: 0 }
  ].filter(({ x, y }) => x >= 0 && y >= 0 && x < width * pixelRatio && y < height * pixelRatio)
  const scan = {
    x: Math.floor(bounds.left + (bounds.right - bounds.left) * 0.75),
    y: Math.floor(bounds.top + (bounds.bottom - bounds.top) * 0.75),
    backgroundX: Math.floor(bounds.left + (bounds.right - bounds.left) * 0.1),
    backgroundY: Math.floor(bounds.top + (bounds.bottom - bounds.top) * 0.1)
  }
  const actual = await page.locator('canvas').evaluate((canvas, { probes, scan, markers }) => {
    const { width, height } = canvas
    const { data } = canvas.getContext('2d').getImageData(0, 0, width, height)
    let left = width
    let top = height
    let right = 0
    let bottom = 0
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 128) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x + 1)
      bottom = Math.max(bottom, y + 1)
    }
    function blackRange (length, offset, background) {
      const reference = offset(background)
      const peak = Math.max(data[reference], data[reference + 1], data[reference + 2])
      let start = -1
      let end = -1
      for (let point = 0; point < length; point++) {
        const index = offset(point)
        // Find the 50% transition from the surrounding solid color to black,
        // not the pure-black core: bilinear upscaling softens several pixels.
        if (data[index + 3] < 250 || Math.max(data[index], data[index + 1], data[index + 2]) > peak / 2) continue
        if (start === -1) start = point
        end = point + 1
      }
      return start === -1 ? null : { start, end }
    }
    return {
      bounds: right ? { left, top, right, bottom } : null,
      alphas: probes.map(({ x, y }) => data[(y * width + x) * 4 + 3]),
      verticalBand: markers ? blackRange(width, x => (scan.y * width + x) * 4, scan.backgroundX) : null,
      horizontalBand: markers ? blackRange(height, y => (y * width + scan.x) * 4, scan.backgroundY) : null
    }
  }, { probes, scan, markers: !!markerBand })
  expectEdges(actual.bounds, bounds, 'painted bounds')
  expect(actual.alphas, 'pixels just inside/outside the fitted edges').toEqual(probes.map(probe => probe.alpha))
  if (markerBand) {
    // Off-center stripes distinguish a uniform crop from stretch-to-fill;
    // four symmetric quadrant colors alone cannot establish scale.
    const [start, end] = markerBand
    expectEdges(actual.verticalBand, {
      start: Math.max(0, left + drawnWidth * start) * pixelRatio,
      end: Math.min(width, left + drawnWidth * end) * pixelRatio
    }, 'vertical marker')
    expectEdges(actual.horizontalBand, {
      start: Math.max(0, top + drawnHeight * start) * pixelRatio,
      end: Math.min(height, top + drawnHeight * end) * pixelRatio
    }, 'horizontal marker')
  }
  return visible
}
