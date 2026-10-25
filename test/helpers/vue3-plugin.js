import { compileScript, compileTemplate, parse } from 'vue3/compiler-sfc'

// Compile the same SFC with Vue 3 without changing the Vue 2 production build
// or installing a Vite plugin whose Vue 3 peer conflicts with the Vue 2 build.
export function vue3 () {
  return {
    name: 'vue3-test-compiler',
    transform (source, filename) {
      if (!filename.endsWith('.vue')) return

      const { descriptor, errors } = parse(source, { filename })
      if (errors.length) throw errors[0]

      const id = 'picture-input-test'
      const script = compileScript(descriptor, { id, genDefaultAs: '__sfc__' })
      const template = compileTemplate({ source: descriptor.template.content, filename, id })
      if (template.errors.length) throw template.errors[0]

      return {
        code: `${script.content}\n${template.code}\n__sfc__.render = render\nexport default __sfc__`,
        map: null
      }
    }
  }
}
