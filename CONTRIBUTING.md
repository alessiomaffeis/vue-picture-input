# Contributing

Contributions are welcome within the scope of the project. Please open an issue before submitting a pull request.

## Development

Use **Node.js 24** and npm, matching CI. Install the locked dependencies and run the checks:

```sh
npm ci
npm test
npm run test:package
```

`npm test` runs strict SFC type checking, the source regression suites, and a fresh ESM build with its distribution smoke test. `npm run test:package` runs the prepack build and checks npm's package file list for missing entries or unexpected files, including legacy bundles and development tooling.

Useful individual commands:

```sh
npm run typecheck
npm run test:unit
npm run test:watch
npm run test:bundle
npm run build
```

CI runs the test and package checks with both locked Vue and the Vue 3.5.0 minimum. See [test/README.md](test/README.md) for coverage and minimum-version reproduction commands.

`npm pack` and `npm publish` automatically run the `prepack` build so the package does not use a missing or stale distribution. The `files` allowlist in `package.json` controls published contents.

## Formatting

Match the surrounding files and use two-space indentation. The Vue component and tooling configs use double quotes and semicolons; JavaScript tests and helpers use single quotes without semicolons. No formatter or lint command is currently enforced. Avoid unrelated formatting changes in behavioral patches.
