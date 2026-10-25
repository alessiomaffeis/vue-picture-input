# Regression tests

Run the complete Vue 3 suite:

```sh
npm test
npm run test:unit
npm run test:bundle
npm run test:watch
npm run build
```

`npm test` runs the source regression suite, then builds a fresh production artifact and runs its UMD smoke test. `test:unit` runs only the source suite (and accepts Vitest filters); `test:bundle` always rebuilds before checking the bundle. Watch mode runs only source tests.

The source regression suites, including the snapshot and method-level event tests in `PictureInput.spec.js`, compile and mount `PictureInput.vue` with Vue 3 and the official Vite Vue plugin. Each case runs once; Vue 2 is no longer supported.

## Minimum-version coverage

`.github/workflows/test.yml` runs the full source/build/UMD checks on Node 24 with both the locked Vue version and the declared minimum, Vue 3.5.0. The minimum leg asserts that both the installed Vue runtime and its SFC compiler are exactly 3.5.0 before running tests; merely printing a version is not sufficient. The minimum installation intentionally leaves the package manifest and lockfile unchanged. Reproduce that leg locally with:

```sh
npm ci
npm install --no-save --package-lock=false vue@3.5.0
node -e "const assert = require('node:assert/strict'); assert.equal(require('vue/package.json').version, '3.5.0'); assert.equal(require('vue/compiler-sfc').version, '3.5.0');"
npm test
npm ci
```

The final `npm ci` restores the locked development dependencies. Minimum-version compatibility is not a recommendation to use an older patch; use the latest compatible Vue patch in applications.

This leg intentionally overlays the minimum runtime/compiler on the locked test tooling. Other Vue packages used by Test Utils, such as its compiler-dom/shared dependencies, are not forced to 3.5.0 and may remain at newer locked versions. The check establishes component runtime/compiler compatibility, not a pristine all-3.5.0 dependency tree.

## Coverage

- `umd.test.cjs`: Node's test runner loads the actual published UMD path and Vue's browser global into jsdom; verifies the `PictureInput` global, injected CSS, native FileReader/change/ref behavior, removal and teardown. No source SFC or compiler test plugin is imported.

- `PictureInput.validation.spec.js`: accepted MIME types, size boundaries, cancellation, rejection metadata, alert suppression, and preserving the previous successful selection.
- `PictureInput.native-input.spec.js`: rejected picker/drop files are absent from native FormData, while previous preview/ref state is retained; rejected prefills do not clear the native selection.
- `PictureInput.prefill.spec.js`: URL/data-URI/File/Blob prefills, exposed source/metadata versus retained native uploads, prop changes, prefill options, direct File/Blob validation bypass, fetched-blob type/size rejection, network/HTTP failures with and without an existing selection, no-preview messages, and removal.
- `PictureInput.removal.spec.js`: state and input reset, removal events, selecting the same file again (including the empty no-preview payload after removal), and explicit clear-all removal when a prefill overlays a retained native selection.
- `PictureInput.integration.spec.js`: real DOM input events, parent listeners and refs, event propagation, framework teardown, and an actual FileReader round trip.
- `PictureInput.interactions.spec.js`: click and keyboard selection, prefilled-image clicks, drag feedback, drop handling, and validation of dropped files.
- `PictureInput.preview.spec.js`: square and rectangular cover/contain coordinates, orientation, default/numeric-string dimensions, margins, resize limits, high-DPI drawing, and manual/automatic aspect toggling and event behavior.
- `PictureInput.exif.spec.js`: little-/big-endian JPEG headers, rotation values, missing metadata, native-orientation support, and bounded EXIF reads.
- `PictureInput.presentation.spec.js`: visibility, prefill controls, no-preview prefill success-message suppression, input attributes, default/custom classes, HTML-enabled messages, escaped labels, custom errors, and unsupported-preview fallback.

## Browser fixtures

`helpers/browser.js` controls FileReader completion, image decoding, fetch responses, canvas calls, container widths, and pixel density. Tests advance each loading stage explicitly, so they can detect premature success events without timing-dependent image downloads. Every test unmounts its components and restores browser mocks.

Geometry tests assert canvas drawing coordinates rather than screenshots. EXIF fixtures contain binary JPEG headers; actual image decoding is mocked. One integration test uses jsdom's real FileReader to verify the emitted Base64 payload. These tests do not replace real-device checks of camera capture, native image orientation, or pixel rendering.

`helpers/native-files.cjs` isolates a jsdom internal API used to populate genuine FileLists because jsdom has no DataTransfer constructor. It is shared by Vitest and the Node UMD test; the latter supplies its own jsdom document. Native-input tests retain the real input value setter and FormData serialization rather than mocking away file clearing.

That API is private, so jsdom upgrades may require updating this isolated fixture. Replacing it with a local array/mock would lose the live-FileList and native FormData behavior these regression tests are intended to protect.

## Toolchain

Vue 3 is the build and test runtime, with Vue Test Utils 2 for mounting. Both Vite and Vitest use `@vitejs/plugin-vue`, including normal scoped-style compilation. There are no alternate Vue runtime aliases or custom SFC compiler plugins. DOM/class and canvas-coordinate assertions still do not depend on a browser layout engine.
