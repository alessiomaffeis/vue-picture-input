import { implForWrapper } from 'jsdom/lib/generated/idl/utils.js'

// jsdom lacks DataTransfer. Populate its native FileList implementation only
// in this fixture, keeping the real input value setter and FormData behavior.
export function nativeFiles (files) {
  const input = document.createElement('input')
  input.type = 'file'
  const list = input.files
  implForWrapper(list).push(...files.map(file => implForWrapper(file)))
  return list
}
