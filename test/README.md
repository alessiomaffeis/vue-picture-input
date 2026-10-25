# Regression tests

Run the complete suite, or select one framework:

```sh
npm test
npm test -- --project vue2
npm test -- --project vue3
npm run test:watch
npm run build
```

The shared regression suites compile and mount `PictureInput.vue` separately with Vue 2.7 and Vue 3. The original snapshot and method-level event tests in `PictureInput.spec.js` also run in the Vue 2 project.

## Coverage

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

`helpers/native-files.js` isolates a jsdom internal API used to populate genuine FileLists because jsdom has no DataTransfer constructor. Native-input tests retain the real input value setter and FormData serialization rather than mocking away file clearing.

That API is private, so jsdom upgrades may require updating this isolated fixture. Replacing it with a local array/mock would lose the live-FileList and native FormData behavior these regression tests are intended to protect.

## Framework isolation

Vue 2 remains the development/build default. The `vue3` and `@vue/test-utils-vue3` npm aliases add a separate Vue 3 runtime and test utilities without changing the published peer dependencies or UMD build. Test Utils 2.4.6 is pinned because newer versions declare a Vue 3 peer that conflicts with the Vue 2 build dependency.

The Vue 3 project uses the official SFC compiler through `helpers/vue3-plugin.js` to compile the script and template. Its ESM test-utils alias ensures imports use the Vue 3 runtime rather than resolving the Vue 2 CommonJS package. Scoped styles are not compiled by this test-only plugin; DOM/class and inline-style assertions do not depend on a layout engine.
