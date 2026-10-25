export const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
export const imageData = 'data:image/png;base64,iVBORw=='
export const otherImageData = 'data:image/png;base64,bmV3'

export function makeFile ({ name = 'photo.png', type = 'image/png', size, lastModified = 1 } = {}) {
  return new File([size === undefined ? pngBytes : new Uint8Array(size)], name, { type, lastModified })
}

export function jpegWithExif (orientation = 1, littleEndian = true, tag = 0x0112) {
  const buffer = new ArrayBuffer(40)
  const view = new DataView(buffer)
  view.setUint16(0, 0xffd8)
  view.setUint16(2, 0xffe1)
  view.setUint16(4, 36)
  view.setUint32(6, 0x45786966)
  view.setUint16(12, littleEndian ? 0x4949 : 0x4d4d)
  view.setUint16(14, 42, littleEndian)
  view.setUint32(16, 8, littleEndian)
  view.setUint16(20, 1, littleEndian)
  view.setUint16(22, tag, littleEndian)
  view.setUint16(24, 3, littleEndian)
  view.setUint32(26, 1, littleEndian)
  view.setUint16(30, orientation, littleEndian)
  view.setUint16(38, 0xffd9)
  return buffer
}

export const jpegWithoutExif = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0,
  0xff, 0xda, 0, 2, 0x12, 0x34, 0xff, 0xd9
]).buffer
