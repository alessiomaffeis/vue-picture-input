# vue-picture-input

Mobile-friendly picture file input component for Vue 3 with image preview, drag and drop, EXIF orientation, and more.

![vue-pictur-input-demo](https://user-images.githubusercontent.com/2185511/167262626-5f10679f-70cf-4477-865a-508c67bca44e.gif)

## Installation

### npm

```sh
npm install --save vue-picture-input
```

### yarn

```sh
yarn add vue-picture-input
```

## Compatibility

Version 5 requires **Vue 3.5 or newer within Vue 3**. Vue 2 support has been removed; Vue 2 applications should remain on `vue-picture-input@4`.

The component uses the typed Composition API with `<script setup lang="ts">`. It works with both Options API and Composition API parents; its props, events, exposed instance API, and browser fallbacks remain compatible. The default package entry is still the source Vue SFC, so use a Vue build tool that supports TypeScript in SFCs.

The prebuilt distribution is **ESM-only** in v5 (`dist/vue-picture-input.mjs`). UMD bundles and the `PictureInput` browser global are no longer provided. Vue remains an external dependency, and the prebuilt module injects its CSS automatically.

## Usage

### Vue 3 (Options API)

```HTML
<template>
  <div class="hello">
    <picture-input
      ref="pictureInput"
      width="600"
      height="600"
      margin="16"
      accept="image/jpeg,image/png"
      size="10"
      button-class="btn"
      :custom-strings="{
        upload: '<h1>Bummer!</h1>',
        drag: 'Drag a 😺 GIF or GTFO'
      }"
      @change="onChange">
    </picture-input>
  </div>
</template>
```

```javascript
<script>
import PictureInput from 'vue-picture-input'

export default {
  name: 'app',
  data () {
    return {
      image: null
    }
  },
  components: {
    PictureInput
  },
  methods: {
    onChange (image) {
      console.log('New picture selected!')
      if (image) {
        console.log('Picture loaded.')
        this.image = image
      } else {
        console.log('FileReader API not supported: use the <form>, Luke!')
      }
    }
  }
}
</script>
```

### Vue 3 (Composition API)

```HTML
<template>
  <div class="hello">
    <picture-input
      ref="pictureInput"
      width="600"
      height="600"
      margin="16"
      accept="image/jpeg,image/png"
      size="10"
      button-class="btn"
      :custom-strings="{
        upload: '<h1>Bummer!</h1>',
        drag: 'Drag a 😺 GIF or GTFO'
      }"
      @change="onChange">
    </picture-input>
  </div>
</template>
```

```javascript
<script setup>
import { ref } from 'vue'
import PictureInput from 'vue-picture-input'

const pictureInput = ref(null)
const image = ref(null)

const onChange = (newImage) => {
  console.log('New picture selected!')
  if (newImage) {
    console.log('Picture loaded.')
    image.value = newImage
  } else {
    console.log('FileReader API not supported: use the <form>, Luke!')
  }
}
</script>
```

### Prebuilt ESM

To import the precompiled component without an SFC loader:

```js
import PictureInput from 'vue-picture-input/dist/vue-picture-input.mjs'
```

### Browser ESM (CDN)

You can also use it directly in the browser through [unpkg's CDN](https://unpkg.com/vue-picture-input) (or [jsDelivr](https://cdn.jsdelivr.net/npm/vue-picture-input)). Use a module script and an import map so the component's external `vue` import resolves to the same Vue instance as your application:

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="importmap">
      {
        "imports": {
          "vue": "https://unpkg.com/vue@3.5/dist/vue.esm-browser.prod.js"
        }
      }
    </script>
    <title>In the browser!</title>
  </head>
  <body>
    <div id="app">
      <p>{{ message }}</p>
      <picture-input></picture-input>
    </div>
    <script type="module">
      import { createApp } from "vue";
      import PictureInput from "https://unpkg.com/vue-picture-input@5/dist/vue-picture-input.mjs";

      const app = createApp({
        data() {
          return { message: "Hello Vue!" };
        },
        components: {
          "picture-input": PictureInput,
        },
      });
      app.mount("#app");
    </script>
  </body>
</html>
```

## Example project

https://codesandbox.io/s/github/alessiomaffeis/vue-picture-input-example

## Props

- **width, height**: (pixels, optional) the maximum width and height of the preview container. The picture will be resized and centered to cover this area. If width is not specified, the preview container will expand to full width. If height is not specified, it will be set equal to width.
- **crop**: (boolean, optional) set _:crop="false"_ if you wish to disable cropping. The image will be resized and centered in order to be fully contained in the preview container. Please note that this only affects the image preview; the image file will not be cropped. Default value: true.
- **margin**: (pixels, optional) the margin around the preview container. Default value: 0.
- **radius**: (percentage, optional) The border-radius value for the container. Set _radius="50"_ to get a circular container. Default value: 0.
- **plain**: (boolean, optional) Set _:plain="true"_ to remove the inner border and text. Default value: false.
- **accept**: (media type, optional) the accepted image type(s), e.g. image/jpeg, image/gif, etc. Default value: 'image/\*'.
- **size**: (MB, optional) the maximum accepted file size in megabytes.
- **removable**: (boolean, optional) set _:removable="true"_ if you want to display a "Remove Photo" button. Default value: false.
- **hideChangeButton**: (boolean, optional) set _:hideChangeButton="true"_ if you want to hide the "Change Photo" button. Default value: false.
- **id, name**: (string, optional) the id and name attributes of the HTML input element.
- **buttonClass**: (string, optional) the class which will be applied to the 'Change Photo' button.
  Default value: 'btn btn-primary button'.
- **removeButtonClass**: (string, optional) the class which will be applied to the 'Remove Photo' button.
  Default value: 'btn btn-secondary button secondary'.
- **prefill**: (image URL, data URI, File, or Blob, optional) use this to provide a default image for the preview. It doesn't change the underlying file input value; this is for image preview only. Default value: empty.

  Loading a prefill preserves any existing native file selection, but updates `pictureInput.file` to the prefill source: a generated File for a URL/data URI, or the supplied File/Blob itself. A Blob is not automatically wrapped in a File; when it has no name or modification time, the component's `fileName` metadata is `""` and `fileModified` is `0`. Use the native input or `FormData` to inspect the form upload rather than the preview source. A prefill hides the no-preview selection-success message even when an older native selection is retained.

  File/Blob prefills retain their direct-loading behavior and bypass the selected-file size/type checks; fetched URL/data-URI prefills pass through those checks. Explicit removal (the Remove Photo button or `removeImage()`) clears everything: the displayed image, exposed `file` reference, and native input, including any earlier selection retained underneath a prefill. It does not restore a previously displayed image.
- **prefillOptions**: (object, optional) use this if you prefill with a data uri scheme to specify a file name and a media or file type:

```
  fileName: (string, optional) the file name
  fileType: (string, optional) the file type of the image, i.e. "png", or
  mediaType: (string, optional) the media type of the image, i.e. "image/png"
```

- **toggleAspectRatio**: (boolean, optional) set _:toggleAspectRatio="true"_ to show a button for toggling the canvas aspect ratio (Landscape/Portrait) on a non-square canvas. Default value: false.
- **autoToggleAspectRatio**: (boolean, optional) set _:autoToggleAspectRatio="true"_ to enable automatic canvas aspect ratio change to match the selected picture's. Default value: false.
- **changeOnClick**: (boolean, optional) set _:changeOnClick="true"_ to open image selector when user click on the image. Default value: true.
- **aspectButtonClass**: (string, optional) the class which will be applied to the 'Landscape/Portrait' button.
  Default value: 'btn btn-secondary button secondary'.
- **zIndex**: (number, optional) The base z-index value. In case of issues with your layout, change _:zIndex="..."_ to a value that suits you better. Default value: 10000.
- **alertOnError**: (boolean, optional) Set _:alertOnError="false"_ to disable displaying alerts on attemps to select file with
  wrong type or too big.
  Default value: true.
- **capture**: (string, optional) use this if you want to allow image capture from capture devices (e.g. camera)
- **customStrings**: (object, optional) use this to provide one or more custom strings (see the example above). Here are the available strings and their default values:

```js
{
  upload: '<p>Your device does not support file uploading.</p>', // HTML allowed
  drag: 'Drag an image or <br>click here to select a file', // HTML allowed
  tap: 'Tap here to select a photo <br>from your gallery', // HTML allowed
  change: 'Change Photo', // Text only
  remove: 'Remove Photo', // Text only
  select: 'Select a Photo', // Text only
  selected: '<p>Photo successfully selected!</p>', // HTML allowed
  fileSize: 'The file size exceeds the limit', // Text only
  fileType: 'This file type is not supported.', // Text only
  aspect: 'Landscape/Portrait' // Text only
}
```

## Component refs

Parent refs expose live, reactive values through `defineExpose`, with no extra `.value` on the component's members:

```js
// Options API parent
this.$refs.pictureInput.file
this.$refs.pictureInput.removeImage()

// Composition API parent (pictureInput is the parent's template ref)
pictureInput.value.image
pictureInput.value.removeImage()
```

`image` is initially `undefined` and becomes `""` on removal. `file` is initially `undefined` and becomes `null` on removal. File metadata is available as `fileName`, `fileSize`, `fileType`, and `fileModified`. The public methods `selectImage()`, `removeImage()`, `rotateImage()`, and `preloadImage(source, options)` remain callable; existing props, state, computed values, and helper methods are also retained for compatibility. Browser File/Blob objects retain their identity, including direct prefills.

The exposed `strings` object remains deeply reactive: direct edits update the UI, and `updateStrings()` applies custom strings in place so retained references stay current.

Unmounting removes the resize listener and cancels pending reads, image decoding callbacks, and abortable prefill fetches without emitting cancellation errors. This does not introduce SSR/hydration support or change overlapping-load ordering.

## Events

- **change**: emitted once on a successful user picture change (prefill excluded). With preview support, the payload is the image as a Base64 Data URI string. Without preview support, no Base64 image is generated: the payload can be `undefined` initially or `""` after removal. Use the exposed `file` or the native form input in that fallback. Add a _ref_ attribute to picture-input (see the example above) to access _this.$refs.pictureInput.image_ (Base64 Data URI when available) and _this.$refs.pictureInput.file_ (the current image source as a File or Blob, including prefills; not necessarily the native form selection).
- **prefill**: emitted on default image prefill.
- **remove**: emitted on picture remove.
- **click**: emitted on picture click.
- **aspectratiochange**: emitted when the aspect button manually toggles the canvas orientation, with `"landscape"` or `"portrait"` as its payload. Automatic matching through `autoToggleAspectRatio` does not emit this event.
- **error**: emitted on error, along with an object with _type_, _message_, and optional additional parameters.

Rejected selections and dropped files clear the native file input, so a form cannot submit the rejected file. The previous successful preview and exposed `file` reference are retained, but the native form field stays empty until a file is selected again. Invalid prefills leave the native input untouched.

## DeepWiki
You can explore more about this project on DeepWiki too:
https://deepwiki.com/alessiomaffeis/vue-picture-input


## Tests

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` runs strict SFC type checking, the Vue 3 source regression suites, and a fresh production build with package-content checks. It does not require a browser. `npm run test:browser` builds the actual ESM artifact and tests it in Chromium with real image decoding, canvas rendering, file inputs, native FormData, and layout. Vue is served locally through an import map; no CDN is required.

CI runs source/package checks with locked Vue and the Vue 3.5.0 minimum, plus a separate Chromium job using locked Vue. `npm run typecheck` and `npm run test:package` run individual checks. The `prepack` hook rebuilds automatically before `npm pack` or `npm publish`. See [test/README.md](test/README.md) for setup, coverage, debugging, and minimum-version reproduction commands.

## Contributions

Contributions are welcome, as long as they are within the scope of the project. Please open a new issue before submitting a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Node.js 24 development workflow and formatting conventions.
