import { afterEach, beforeEach, vi } from 'vitest'

import { cleanupComponents } from './component.js'
import { imageData, pngBytes } from './fixtures.js'

export function useBrowserMocks () {
  const browser = {}

  beforeEach(() => {
    browser.NativeFileReader = window.FileReader
    browser.touchDescriptor = Object.getOwnPropertyDescriptor(window, 'ontouchstart')
    browser.touchPointsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'msMaxTouchPoints')
    browser.readers = []
    browser.images = []
    browser.containerWidth = 640
    const makeContext = () => Object.fromEntries([
      'scale', 'setTransform', 'clearRect', 'translate', 'rotate', 'drawImage'
    ].map(name => [name, vi.fn()]))
    browser.context = makeContext()
    browser.contexts = new Map()
    browser.alert = vi.fn()
    browser.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([pngBytes], { type: 'image/png' })
    })

    class MockFileReader {
      constructor () {
        browser.readers.push(this)
        this.readyState = 0
        this.readAsArrayBuffer = vi.fn(blob => {
          this.blob = blob
          this.kind = 'arrayBuffer'
          this.readyState = 1
        })
        this.readAsDataURL = vi.fn(blob => {
          this.blob = blob
          this.kind = 'dataURL'
          this.readyState = 1
        })
        this.abort = vi.fn(() => {
          if (this.readyState !== 1) return
          this.aborted = true
          this.finished = true
          this.readyState = 2
          this.result = null
          this.onabort?.({ target: this })
          this.onloadend?.({ target: this })
        })
      }

      finish (result) {
        if (this.aborted) return
        this.finished = true
        this.readyState = 2
        this.result = result
        this.onload?.({ target: this })
        this.onloadend?.({ target: this })
      }
    }

    class MockImage {
      constructor () {
        this.width = 400
        this.height = 200
        this.style = {}
        this.removeAttribute = vi.fn(name => {
          if (name === 'src') delete this.src
        })
        browser.images.push(this)
      }

      finish ({ width = 400, height = 200 } = {}) {
        this.width = width
        this.height = height
        this.onload?.()
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('CanvasRenderingContext2D', function () {})
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal('alert', browser.alert)
    vi.stubGlobal('fetch', browser.fetch)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      if (!browser.contexts.has(this)) {
        browser.contexts.set(this, browser.contexts.size === 0 ? browser.context : makeContext())
      }
      return browser.contexts.get(this)
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => browser.containerWidth)
  })

  afterEach(async () => {
    await cleanupComponents()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (browser.touchDescriptor) {
      Object.defineProperty(window, 'ontouchstart', browser.touchDescriptor)
    } else {
      delete window.ontouchstart
    }
    if (browser.touchPointsDescriptor) {
      Object.defineProperty(navigator, 'msMaxTouchPoints', browser.touchPointsDescriptor)
    } else {
      delete navigator.msMaxTouchPoints
    }
  })

  browser.disablePreview = (api = 'canvas') => {
    vi.stubGlobal(api === 'canvas' ? 'CanvasRenderingContext2D' : 'FileReader', undefined)
  }

  browser.disableUpload = (api = 'userAgent') => {
    if (api === 'userAgent') {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android 2.1')
    } else {
      vi.spyOn(HTMLInputElement.prototype, 'disabled', 'get').mockReturnValue(true)
    }
  }

  browser.setDragAndDrop = supported => {
    // The component checks property presence, not its value.
    if (supported) delete window.ontouchstart
    else Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null })
    Object.defineProperty(navigator, 'msMaxTouchPoints', { configurable: true, value: supported ? 0 : 1 })
  }

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
