# Browser image fixtures

These JPEGs were copied from the maintainer-provided URLs below. They are stored locally so browser tests never depend on a remote image service. They are test-only assets and are excluded from the published npm package.

## landscape.jpg
- Progressive JPEG, 640 × 424, 78,575 bytes.
- SHA-256: `c6f79819259297c204c4bb2a2843a17acaf0cb7b6143296504c0c9069a27ec61`.

## portrait.jpg
- Progressive JPEG, 640 × 965, 110,106 bytes.
- SHA-256: `1fb2301d56346be9196b622920524f1f8f21066adc3d57e43136b7607f9abbc3`.

No additional resizing or recompression was applied after downloading. If these files are replaced, update their expected dimensions in `../picture-input.spec.mjs`.

`images.json` contains the existing tiny, generated red/blue PNGs used for exact pixel assertions. The JPEG tests instead assert native decoding dimensions, crop/contain coverage, photographic color variation, automatic aspect matching, and preservation of original upload bytes.
