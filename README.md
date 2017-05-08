vue-picture-input
=============

Mobile-friendly picture file input Vue.js component with image preview, drag and drop, EXIF orientation, and more.

![Picture Input Demo](http://i.giphy.com/3o84UfcY1QV7Unrtba.gif)


## Installation

### npm

``` sh
npm install --save vue-picture-input
```
### yarn

``` sh
yarn add vue-picture-input
```

## Usage

```HTML
<template>
  <div class="hello">    
    <picture-input 
      ref="pictureInput" 
      @change="onChange" 
      width="600" 
      height="600" 
      margin="16" 
      accept="image/jpeg,image/png" 
      size="10" 
      buttonClass="btn"
      :customStrings="{
        upload: '<h1>Bummer!</h1>',
        drag: 'Drag a 😺 GIF or GTFO'
      }">
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
    }
  },
  components: {
    PictureInput
  },
  methods: {
    onChange () {
      console.log('New picture selected!')
      if (this.$refs.pictureInput.image) {
        console.log('Picture loaded.')
      } else {
        console.log('FileReader API not supported: use the <form>, Luke!')
      }
    }
  }
}
</script>
```

## Example project

You can find an example project here: https://github.com/alessiomaffeis/vue-picture-input-example

## Props

- **width, height**: (pixels, optional) the maximum width and height of the preview container. The picture will be resized and centered to cover this area. If not specified, the preview container will expand to full width, 1:1 square ratio.
- **crop**: (boolean, optional) set *:crop="false"* if you wish to disable cropping. The image will be resized and centered in order to be fully contained in the preview container. Default value: true.
- **margin**: (pixels, optional) the margin around the preview container. Default value: 0.
- **accept**: (media type, optional) the accepted image type(s), e.g. image/jpeg, image/gif, etc. Default value: 'image/*'. 
- **size**: (MB, optional) the maximum accepted file size in megabytes.
- **removable**: (boolean, optional) set *:removable="true"* if you want to display a "Remove Photo" button. Default value: false.
- **id, name**: (string, optional) the id and name attributes of the HTML input element.
- **buttonClass**: (string, optional) the class which will be applied to the 'Change Photo' button.
  Default value: 'btn btn-primary button'.
- **removeButtonClass**: (string, optional) the class which will be applied to the 'Remove Photo' button.
  Default value: 'btn btn-secondary button secondary'.
- **prefill**: (image url or File object, optional) use this to specify the path to a default image (or a File object) to prefill the input with. Default value: empty.
- **customStrings**: (object, optional) use this to provide one or more custom strings (see the example above). Here are the available strings and their default values:
```
  upload: '<p>Your device does not support file uploading.</p>', // HTML allowed
  drag: 'Drag an image or <br>click here to select a file', // HTML allowed
  tap: 'Tap here to select a photo <br>from your gallery', // HTML allowed
  change: 'Change Photo', // Text only
  remove: 'Remove Photo', // Text only
  select: 'Select a Photo', // Text only
  selected: '<p>Photo successfully selected!</p>', // HTML allowed
  fileSize: 'The file size exceeds the limit', // Text only
  fileType: 'This file type is not supported.' // Text only
```
   
## Events

- **change**: emitted on (successful) picture change. If you need to access the underlying image from the parent component, add a *ref* attribute to picture-input (see the example above). You may want to use *this.$refs.pictureInput.image* (Base64 Data URI string) or *this.$refs.pictureInput.file* (File Object)
- **remove**: emitted on picture remove.
  
## TODOs

- Client-side resizing and cropping
- Demo GitHub pages


## Contributions

All contributions are welcome.

Please follow the Javascript Standard Style guidelines:
https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
