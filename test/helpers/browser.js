import { afterEach, beforeEach, vi } from 'vitest'

import { cleanupComponents } from './component.js'
import { imageData, pngBytes } from './fixtures.js'

export function useBrowserMocks () {
  const browser = {}

  beforeEach(() => {
    browser.NativeFileReader = window.FileReader
    browser.readers = []
    browser.images = []
    browser.containerWidth = 640
    browser.context = Object.fromEntries([
      'scale', 'setTransform', 'clearRect', 'translate', 'rotate', 'drawImage'
    ].map(name => [name, vi.fn()]))
    browser.alert = vi.fn()
    browser.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([pngBytes], { type: 'image/png' })
    })

    class MockFileReader {
      constructor () {
        browser.readers.push(this)
        this.readAsArrayBuffer = vi.fn(blob => {
          this.blob = blob
          this.kind = 'arrayBuffer'
        })
        this.readAsDataURL = vi.fn(blob => {
          this.blob = blob
          this.kind = 'dataURL'
        })
      }

      finish (result) {
        this.finished = true
        this.result = result
        this.onload({ target: this })
      }
    }

    class MockImage {
      constructor () {
        this.width = 400
        this.height = 200
        this.style = {}
        browser.images.push(this)
      }

      finish ({ width = 400, height = 200 } = {}) {
        this.width = width
        this.height = height
        this.onload()
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('CanvasRenderingContext2D', function () {})
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal('alert', browser.alert)
    vi.stubGlobal('fetch', browser.fetch)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(browser.context)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => browser.containerWidth)
  })

  afterEach(async () => {
    await cleanupComponents()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  browser.finishEXIF = (buffer = pngBytes.buffer) => {
    const reader = browser.readers.find(reader => reader.kind === 'arrayBuffer' && !reader.finished)
    if (!reader) throw new Error('No pending EXIF read')
    reader.finish(buffer)
  }

  browser.finishDataURL = (data = imageData) => {
    const reader = browser.readers.find(reader => reader.kind === 'dataURL' && !reader.finished)
    if (!reader) throw new Error('No pending data URI read')
    reader.finish(data)
  }

  browser.finishLoading = ({ buffer, data, width, height } = {}) => {
    browser.finishEXIF(buffer)
    browser.finishDataURL(data)
    const image = browser.images[browser.images.length - 1]
    image.finish({ width, height })
    return image
  }

  return browser
}
