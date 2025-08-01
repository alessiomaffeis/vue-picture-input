# vue-picture-input

Mobile-friendly picture file input component for Vue.js 2 & 3 with image preview, drag and drop, EXIF orientation, and more.

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

This component works with both **Vue 2** (2.7+) and **Vue 3** (3.0+). The component is written in Vue 2 style (Options API) but is compatible with Vue 3.

## Usage

### Vue 2 & Vue 3 (Options API)

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

You can also use it directly in the browser through [unpkg's CDN](https://unpkg.com/vue-picture-input) (or [jsDelivr](https://cdn.jsdelivr.net/npm/vue-picture-input)):

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://unpkg.com/vue@2"></script>
    <script src="https://unpkg.com/vue-picture-input/dist/vue-picture-input"></script>
    <title>In the browser!</title>
  </head>
  <body>
    <div id="app">
      <p>{{ message }}</p>
      <picture-input></picture-input>
    </div>
    <script>
      var app = new Vue({
        el: "#app",
        data: {
          message: "Hello Vue!",
        },
        components: {
          "picture-input": PictureInput,
        },
      });
    </script>
  </body>
</html>
```

## Example project

Try it on CodeSandbox: https://codesandbox.io/s/github/alessiomaffeis/vue-picture-input-example

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
- **prefill**: (image url or File object, optional) use this to specify the path to a default image (or a File object) to prefill the image preview with. Please note that it doesn't change the underlying file input value, this should be used for image preview only. Default value: empty.
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
- **customStrings**: (object, optional) use this to provide one or more custom strings (see the example above). Here are the available strings and their default values:
- **capture**: (string, optional) use this if you want to allow image capture from capture devices (e.g. camera)

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

## Events

- **change**: emitted on (successful) picture change (prefill excluded). The image is passed along with the event as a Base64 Data URI string. If you need to access the underlying image from the parent component, add a _ref_ attribute to picture-input (see the example above). You may want to use _this.$refs.pictureInput.image_ (Base64 Data URI string) or _this.$refs.pictureInput.file_ (File Object)
- **prefill**: emitted on default image prefill.
- **remove**: emitted on picture remove.
- **click**: emitted on picture click.
- **error**: emitted on error, along with an object with _type_, _message_, and optional additional parameters.

## DeepWiki
You can explore more about this procject on DeepWiki too:

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/alessiomaffeis/vue-picture-input)


## TODOs

- Add tests

## Contributions

Contributions are welcome, as long as they are within the scope of the project. Please open a new issue before submitting a pull request.

You should follow the Javascript Standard Style guidelines:
https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
