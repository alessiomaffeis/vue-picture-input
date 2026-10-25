import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const root = new URL('../../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const vuePackage = new URL(import.meta.resolve('vue/package.json'))
const images = JSON.parse(readFileSync(new URL('fixtures/images.json', import.meta.url), 'utf8'))
// Serve an explicit allowlist, not the project directory or a Vite dev server:
// the browser must receive the published module without import rewriting.
const routes = new Map([
  ['/', { file: new URL('index.html', import.meta.url), type: 'text/html' }],
  ['/picture-input.mjs', { file: new URL(pkg.unpkg, root), type: 'text/javascript' }],
  ['/vue.mjs', { file: new URL('./dist/vue.esm-browser.prod.js', vuePackage), type: 'text/javascript' }]
])

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end()
    return
  }
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1:4173').pathname
    if (pathname === '/favicon.ico') {
      response.writeHead(204)
      response.end()
      return
    }
    const route = routes.get(pathname)
    const image = pathname === '/photo.png' ? images.landscape
      : pathname === '/portrait.png' ? images.portrait : undefined
    const status = route || image ? 200 : 404
    const body = route ? readFileSync(route.file)
      : image ? Buffer.from(image.base64, 'base64') : Buffer.from('Not found')
    response.writeHead(status, {
      'Content-Type': image ? 'image/png' : (route?.type || 'text/plain') + '; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store'
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch (error) {
    console.error(error)
    response.writeHead(500)
    response.end()
  }
})

server.listen(4173, '127.0.0.1', () => {
  console.log('Browser fixture ready at http://127.0.0.1:4173')
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)))
}
