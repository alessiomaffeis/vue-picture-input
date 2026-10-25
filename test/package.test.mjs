import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('npm package contains only the source, ESM artifact, and package metadata', () => {
  const directory = new URL('../', import.meta.url)
  // The test:package script already runs prepack. Skip lifecycle scripts here
  // to avoid a duplicate build and keep npm's stdout a single JSON report.
  const args = ['pack', '--dry-run', '--json', '--ignore-scripts']
  const npmCli = process.env.npm_execpath
  const output = execFileSync(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args, {
    cwd: directory, encoding: 'utf8', timeout: 30000
  })
  // npm versions return either an array or a report keyed by package name.
  const report = JSON.parse(output)
  const packages = Array.isArray(report) ? report : Object.values(report)
  assert.equal(packages.length, 1)
  const files = packages[0].files.map(file => file.path).sort()
  assert.deepEqual(files, [
    'LICENSE',
    'PictureInput.vue',
    'README.md',
    'dist/vue-picture-input.mjs',
    'package.json'
  ])

  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const entry of [pkg.main, pkg.unpkg, pkg.jsdelivr]) {
    assert.ok(files.includes(entry), `Published entry ${entry} must be included`)
  }
})
