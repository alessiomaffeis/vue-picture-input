# Contributing

Contributions are welcome within the scope of the project. Please open an issue before submitting a pull request.

## Development

Use **Node.js 24** and npm, matching CI. Install the locked dependencies and run the checks:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` runs strict SFC type checking, the source regression suites, and a fresh ESM build with package-content validation. It does not require a browser installation. `npm run test:package` runs just the prepack build and package-content check.

Install Chromium once per Playwright version, then use `npm run test:browser` to build and test the actual ESM artifact in a real headless browser. Playwright's managed-server startup owns the build, so direct `npx playwright test` and IDE/UI startup also rebuild rather than using stale output. Restart long-running UI/IDE test sessions after component/build-config edits; this is not a development watch server. The fixture serves Vue locally through an import map, so tests do not depend on a CDN. FileReader, image decoding, canvas, native inputs, and layout are not mocked. On Linux, `npx playwright install --with-deps chromium` can also install the browser's system dependencies.

Useful individual commands:

```sh
npm run typecheck
npm run test:unit
npm run test:watch
npm run test:bundle
npm run test:package
npm run build
```

`test:bundle` is an alias for `test:browser`. To debug interactively, use `npm run test:browser -- --headed`. Failed browser tests retain a trace and screenshot under `test-results/`.

CI runs source/package checks with both locked Vue and the Vue 3.5.0 minimum. A separate job runs Chromium against locked Vue, installing only its headless shell and uploading diagnostics on failure. See [test/README.md](test/README.md) for coverage and minimum-version reproduction commands.

`npm pack` and `npm publish` automatically run the `prepack` build so the package does not use a missing or stale distribution. The `files` allowlist in `package.json` controls published contents.

## Formatting

Match the surrounding files and use two-space indentation. The Vue component and tooling configs use double quotes and semicolons; JavaScript tests and helpers use single quotes without semicolons. No formatter or lint command is currently enforced. Avoid unrelated formatting changes in behavioral patches.
