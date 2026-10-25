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
  ['/vue.mjs', { file: new URL('./dist/vue.esm-browser.prod.js', vuePackage), type: 'text/javascript' }],
  ['/landscape.jpg', { file: new URL('fixtures/landscape.jpg', import.meta.url), type: 'image/jpeg' }],
  ['/portrait.jpg', { file: new URL('fixtures/portrait.jpg', import.meta.url), type: 'image/jpeg' }],
  ['/failed-prefill.jpg', { file: new URL('fixtures/landscape.jpg', import.meta.url), type: 'image/jpeg', status: 503 }]
])

const delayedPhoto = readFileSync(new URL('fixtures/landscape.jpg', import.meta.url))
const pendingPrefills = new Map()

function send (request, response, status, type, body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body)
  response.writeHead(status, {
    'Content-Type': type.startsWith('text/') ? type + '; charset=utf-8' : type,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store'
  })
  response.end(request.method === 'HEAD' ? undefined : bytes)
}

function pendingState (pending) {
  if (!pending) return { started: false }
  const { stage, cancelled, closed, released } = pending
  return { started: true, stage, cancelled, closed, released }
}

const server = createServer((request, response) => {
  try {
    const { pathname, searchParams } = new URL(request.url, 'http://127.0.0.1:4173')
    if (pathname === '/delayed-prefill.jpg' || pathname === '/prefill-control') {
      const id = searchParams.get('id')
      if (!id || !/^[\w-]{1,80}$/.test(id)) {
        send(request, response, 400, 'text/plain', 'A test id is required')
        return
      }
      const pending = pendingPrefills.get(id)
      if (pathname === '/prefill-control') {
        if (request.method === 'POST' && pending) {
          pending.released = true
          if (!pending.response.destroyed) {
            if (pending.stage === 'headers') {
              pending.response.writeHead(200, {
                'Content-Type': 'image/jpeg', 'Content-Length': delayedPhoto.length, 'Cache-Control': 'no-store'
              })
            }
            pending.response.end(pending.stage === 'body' ? delayedPhoto.subarray(128) : delayedPhoto)
          }
        } else if (request.method === 'DELETE') {
          pending?.response.destroy()
          pendingPrefills.delete(id)
        } else if (request.method !== 'GET') {
          send(request, response, 405, 'text/plain', 'Method not allowed')
          return
        }
        send(request, response, 200, 'application/json', JSON.stringify(pendingState(pending)))
        return
      }
      const stage = searchParams.get('stage')
      if (request.method !== 'GET' || !['headers', 'body'].includes(stage) || pending) {
        send(request, response, 400, 'text/plain', 'Invalid delayed prefill')
        return
      }
      const entry = { response, stage, cancelled: false, closed: false, released: false }
      pendingPrefills.set(id, entry)
      response.once('close', () => {
        entry.closed = true
        entry.cancelled = !response.writableFinished
      })
      // No timer: the test releases the response explicitly. Sending only a
      // prefix lets native fetch resolve its headers while blob() stays pending.
      if (stage === 'body') {
        response.writeHead(200, {
          'Content-Type': 'image/jpeg', 'Content-Length': delayedPhoto.length, 'Cache-Control': 'no-store'
        })
        response.write(delayedPhoto.subarray(0, 128))
      }
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end()
      return
    }
    if (pathname === '/favicon.ico') {
      response.writeHead(204)
      response.end()
      return
    }
    const route = routes.get(pathname)
    const image = pathname === '/photo.png' ? images.landscape
      : pathname === '/portrait.png' ? images.portrait : undefined
    const status = route ? route.status || 200 : image ? 200 : 404
    const body = route ? readFileSync(route.file)
      : image ? Buffer.from(image.base64, 'base64') : Buffer.from('Not found')
    const type = image ? 'image/png' : route?.type || 'text/plain'
    send(request, response, status, type, body)
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
