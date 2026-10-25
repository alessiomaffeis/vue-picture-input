# Browser image fixtures

The downloaded JPEGs below are stored locally so browser tests never depend on a remote image service. All fixtures here are test-only assets and are excluded from the published npm package.

## landscape.jpg
- Progressive JPEG, 640 × 424, 78,575 bytes.
- SHA-256: `c6f79819259297c204c4bb2a2843a17acaf0cb7b6143296504c0c9069a27ec61`.

## portrait.jpg
- Progressive JPEG, 640 × 965, 110,106 bytes.
- SHA-256: `1fb2301d56346be9196b622920524f1f8f21066adc3d57e43136b7607f9abbc3`.

No additional resizing or recompression was applied after downloading. Photo assertions enforce these original SHA-256 hashes at runtime. An intentional replacement requires updating both the expected dimensions/hashes in `../picture-input.spec.mjs` and this record.

`images.json` contains the existing tiny, generated red/blue PNGs used for exact pixel assertions. The JPEG tests instead assert native decoding dimensions, crop/contain coverage, photographic color variation, automatic aspect matching, and preservation of original upload bytes.

## Generated orientation fixture

`orientation.json` contains a complete, decodable 96 × 64 JPEG, not the source suite's header-only EXIF mock. It was encoded once with native canvas at JPEG quality 1. Its four 48 × 32 quadrants are red, green, blue, and yellow (top-left, top-right, bottom-left, bottom-right); the original RGB values are recorded in `colors`.

Browser tests insert a minimal little-endian EXIF APP1 segment after the JPEG's SOI marker to produce orientations 1, 3, 6, and 8 without changing the encoded pixels. They assert native oriented dimensions, the expected corner-color ordering, and the original upload/data-URI bytes. This catches both ignored orientation and double rotation. A small RGB tolerance accommodates JPEG decoder differences, with samples away from color boundaries.

To regenerate the base image, fill a 96 × 64 canvas with those four quadrants and save the base64 part of `canvas.toDataURL('image/jpeg', 1)`. The downloaded photographs are never modified or recompressed for these tests.

## Lossless geometry fixtures

`geometry.json` contains complete RGBA PNGs: a 96 × 64 landscape and a 64 × 96 portrait. They have the same red/green/blue/yellow quadrants as the orientation fixture, plus black vertical and horizontal bands spanning `[3/8, 7/16)` of their respective source dimensions. Every pixel is fully opaque. The PNGs use 8-bit RGBA scanlines (filter 0) compressed with zlib.

The off-center bands are necessary: a four-quadrant image's symmetric center lines can still look correct after stretching instead of cropping. Geometry tests measure both marker edges, painted bounds, and inside/outside alpha probes in backing pixels. This establishes uniform scale and centering at DPR 1 and 2, and detects a missing redraw immediately after a manual aspect toggle.

To regenerate, color each pixel by its quadrant using `orientation.json`'s RGB values, overwrite it with black when either coordinate is in its band, and encode as PNG without color conversion or resampling.
