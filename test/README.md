# Regression tests

Run the fast Vue 3 source and package checks, then the real-browser suite:

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Individual commands:

```sh
npm run typecheck
npm run test:unit
npm run test:bundle
npm run test:package
npm run test:watch
npm run build
```

`npm test` runs strict SFC type checking with `vue-tsc --noEmit`, the source regression suite, and `test:package` (including a fresh ESM build). It does not require Chromium. `typecheck` runs only checking; `test:unit` runs only the source suite and accepts Vitest filters. Watch mode runs only source tests.

`test:browser` always builds before running Playwright against the actual ESM artifact. `test:bundle` is a compatibility alias for it. The former Node/jsdom distribution smoke test has been replaced by this real-browser suite, not retained as a duplicate.

`test:package` runs the prepack build, then checks `npm pack --dry-run --json --ignore-scripts` for exactly the source SFC, ESM artifact, README, license, and package manifest. The dry run skips lifecycle scripts because the prepack build has already run. Missing entry files, old bundles, and unexpected development files fail the check. Normal `npm pack` and `npm publish` invoke the `prepack` build automatically.

The source regression suites, including the snapshot and mounted event-timing tests in `PictureInput.spec.js`, compile and mount the real `PictureInput.vue` with Vue 3 and the official Vite Vue plugin. Tests do not construct Options API instances or override component computed values. Each case runs once; Vue 2 is no longer supported.

## Minimum-version coverage

`.github/workflows/test.yml` runs type/source/build/package-content checks on Node 24 with both the locked Vue version and the declared minimum, Vue 3.5.0. The minimum leg asserts that both the installed Vue runtime and its SFC compiler are exactly 3.5.0 before running tests; merely printing a version is not sufficient. The minimum installation intentionally leaves the package manifest and lockfile unchanged. Reproduce that leg locally with:

```sh
npm ci
npm install --no-save --package-lock=false vue@3.5.0
node -e "const assert = require('node:assert/strict'); assert.equal(require('vue/package.json').version, '3.5.0'); assert.equal(require('vue/compiler-sfc').version, '3.5.0');"
npm test
npm ci
```

The final `npm ci` restores the locked development dependencies. Minimum-version compatibility is not a recommendation to use an older patch; use the latest compatible Vue patch in applications.

This leg intentionally overlays the minimum runtime/compiler on the locked test tooling. Other Vue packages used by Test Utils, such as its compiler-dom/shared dependencies, are not forced to 3.5.0 and may remain at newer locked versions. The check establishes component runtime/compiler compatibility, not a pristine all-3.5.0 dependency tree.

## Real-browser setup

`playwright.config.mjs` runs one headless Chromium worker. Playwright starts and stops `browser/server.mjs`, a loopback-only Node HTTP server with an explicit route allowlist. It serves the built module byte-for-byte, the installed production browser Vue ESM build, the fixture HTML, tiny valid PNGs, and the checked-in landscape/portrait JPEG photographs. A few test-only routes provide an HTTP 503 and explicitly controlled delayed JPEG responses. There is no Vite dev-server transformation, external CDN, or extra application framework.

`browser/index.html` mounts the production component in a real parent form using a native import map. Its test-only bridge calls the public instance API; parent output reads exposed values reactively rather than copying them in event handlers. Event logging has a separate render effect and remains readable through the bridge after unmount. FileReader, image decoding, canvas, layout, fetch/cancellation, DataTransfer, FileList, and FormData all use native browser implementations. Tiny generated PNGs are stored as base64 JSON for exact color checks; `browser/fixtures/landscape.jpg` and `portrait.jpg` are real progressive JPEG files uploaded by path and served locally for URL-prefill tests. A complete asymmetric JPEG in `orientation.json` supplies decodable EXIF variants. See [fixture provenance](browser/fixtures/README.md) for dimensions, hashes, and generation details. The source suite's header-only image fixtures are not reused here.

Install Chromium once per Playwright version with `npx playwright install chromium`. If Linux system libraries are missing, use `npx playwright install --with-deps chromium`. The separate CI browser job uses locked Vue only and installs just the Chromium headless shell (`--with-deps --only-shell chromium`), avoiding a browser/version matrix. Only the two focused high-density cases use DPR 2; the rest of the suite runs once at DPR 1.

Use `npm run test:browser -- --headed` for interactive debugging. Tests use auto-waiting assertions and explicit browser/server events, not fixed sleeps. Delayed-prefill tests hold either headers or the body until explicitly released, verify actual browser aborts and closed server connections, and clean up their per-test controls. Page errors, console errors, unexpected dialogs, and external HTTP requests fail the suite; only the HTTP-failure case permits its one exact, URL-scoped 503 resource diagnostic. Traces and screenshots are retained only for failures in `test-results/`; CI uploads them as `chromium-failures`. Open a downloaded trace with `npx playwright show-trace path/to/trace.zip`.

## Coverage

- `package.test.mjs`: checks npm's actual dry-run file list against the five allowed package files and verifies that the source/CDN entries are included. It runs through `test:package`, after the prepack build, as part of `npm test` on both CI matrix legs.
- `browser/picture-input.spec.mjs`: real Chromium coverage of unmodified ESM loading and local external Vue, injected scoped CSS, native picker selection/replacement, decoded canvas pixels before success events, reactive parent refs/metadata, public methods, File/Blob/URL prefills versus retained native selection, clear-all removal/reselection, rejected input/FormData clearing, aspect toggling, native viewport resize, and drops using a real DataTransfer. Real landscape/portrait JPEG cases also verify native decoding dimensions, crop/contain pixel coverage, automatic aspect matching without manual events, local URL prefills, and preservation of the original file/data-URI bytes. No source SFC or compiler test plugin is imported.
  - Native Tab/Enter focus and picker activation, instruction-overlay pointer hit-testing, and selected/prefilled `changeOnClick` behavior, without synthetic click/key events or input-click mocks.
  - EXIF orientations 1, 3, 6, and 8: native decoding, displayed corner ordering, and no double rotation. Header endianness/parser combinations and the non-native fallback stay in source tests.
  - Two DPR 2 crop/contain cases: CSS versus backing-buffer dimensions, centered colors/transparent bands, resize, and removal.
  - Real HTTP failure preserving previous refs, pixels, and FormData; unmount cancellation while headers or a response body are pending, with no late events or state changes.
  - An already initialized preview hidden during resize, then revealed and explicitly resized: retained hidden dimensions/pixels, real margins, redraw, and maximum dimensions. This does not require initial-hidden sizing improvements or automatic container observation.

- `PictureInput.spec.js`: unchanged markup snapshot, resize teardown, and first/replacement/prefill/no-preview event timing through mounted components.
- `PictureInput.composition.spec.js`: full exposed instance surface on real parent refs, reactive parent rendering without event-handler copying, deeply reactive messages with stable identity, File/Blob identity, initialization-only settings, single prefill initialization/updates, pre-render clear-prefill removal timing, runtime Boolean casting, attribute fallthrough, custom-string filtering, and instance isolation.
- `PictureInput.lifecycle.spec.js`: immediate-unmount resize teardown, reader aborts, queued read/decode/fetch/blob callbacks, silent fetch cancellation, independent instance cleanup, missing AbortController, and the File-constructor fallback.
- `PictureInput.validation.spec.js`: accepted MIME types, size boundaries, cancellation, rejection metadata, alert suppression, and preserving the previous successful selection.
- `PictureInput.native-input.spec.js`: rejected picker/drop files are absent from native FormData, while previous preview/ref state is retained; rejected prefills do not clear the native selection.
- `PictureInput.prefill.spec.js`: URL/data-URI/File/Blob prefills, exposed source/metadata versus retained native uploads, prop changes, prefill options, direct File/Blob validation bypass, fetched-blob type/size rejection, network/HTTP failures with and without an existing selection, no-preview messages, and removal.
- `PictureInput.removal.spec.js`: state and input reset, removal events, selecting the same file again (including the empty no-preview payload after removal), and explicit clear-all removal when a prefill overlays a retained native selection.
- `PictureInput.integration.spec.js`: real DOM input events, parent listeners and refs, event propagation, framework teardown, and an actual FileReader round trip.
- `PictureInput.interactions.spec.js`: click and keyboard selection, prefilled-image clicks, drag feedback, drop handling, and validation of dropped files.
- `PictureInput.preview.spec.js`: square and rectangular cover/contain coordinates, orientation, default/numeric-string dimensions, margins, resize limits, high-DPI drawing, and manual/automatic aspect toggling and event behavior.
- `PictureInput.exif.spec.js`: little-/big-endian JPEG headers, rotation values, missing metadata, native-orientation support, and bounded EXIF reads.
- `PictureInput.presentation.spec.js`: visibility, prefill controls, no-preview prefill success-message suppression, input attributes, default/custom classes, HTML-enabled messages, escaped labels, custom errors, and unsupported-preview fallback.

## Source-suite browser mocks

`helpers/browser.js` controls FileReader completion/aborts, image decoding/cancellation, fetch responses, per-canvas contexts, container widths, and pixel density. Capability branches use real browser API/user-agent fixtures: missing canvas/FileReader, unsupported upload APIs, and touch/drag support. Desktop drag tests remove jsdom's configurable `window.ontouchstart` property because the component checks property presence; cleanup restores its original descriptor. Tests advance each loading stage explicitly, so they can detect premature success events without timing-dependent image downloads. Every test unmounts its components and restores browser mocks.

Source geometry tests assert mocked canvas drawing coordinates rather than screenshots. EXIF fixtures contain binary JPEG headers; image decoding is mocked in the source suite. One source integration test uses jsdom's real FileReader to verify the emitted Base64 payload. The separate browser suite checks actual PNG/JPEG decoding (including native EXIF orientation), canvas pixels, and layout. Neither suite replaces real-device camera/orientation checks or cross-browser testing beyond Chromium. Exhaustive validation, missing-API fallbacks, and precisely staged queued callbacks remain in the faster source suite.

`helpers/native-files.cjs` isolates a jsdom internal API used to populate genuine FileLists because jsdom has no DataTransfer constructor. It is used only by the source regression suite; the browser suite uses real browser FileLists and FormData. Source native-input tests retain the real jsdom input value setter and FormData serialization rather than mocking away file clearing.

That API is private, so jsdom upgrades may require updating this isolated fixture. Replacing it with a local array/mock would lose the live-FileList and native FormData behavior these regression tests are intended to protect.

## Toolchain

Vue 3 is the build and test runtime, with Vue Test Utils 2 for source mounting and Playwright Test for native Chromium integration. TypeScript and `vue-tsc` are development-only dependencies; the focused strict `tsconfig.json` checks the source SFC without converting JavaScript tests or build configuration. Both Vite and Vitest use `@vitejs/plugin-vue`, including normal scoped-style compilation. The configs and prebuilt artifact use `.mjs` for ESM without requiring a package-wide module-type change. Vite 8 builds the ESM artifact with Rolldown and `vite-plugin-css-injected-by-js` 5; Vue remains external and CSS is still injected by the bundle. The default npm entry remains `PictureInput.vue`. Vite strips TypeScript but does not replace checking. There are no alternate Vue runtime aliases or custom SFC compiler plugins. Source tests retain deterministic mocks; browser tests separately exercise the actual browser layout and rendering engines.
