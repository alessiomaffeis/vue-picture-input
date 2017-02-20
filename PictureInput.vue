<template>
  <div id="picture-input" class="picture-input">
    <div v-if="!supportsUpload">
      <h3>Your device doesn't support file uploading.</h3>
    </div>
    <div v-else-if="supportsPreview">
      <div class="preview-container" 
        :style="{maxWidth: previewWidth + 'px', height: previewHeight + 'px'}">
          <canvas ref="previewCanvas"
            class="picture-preview" 
            :class="computedClasses"
            @drag.stop.prevent="" 
            @dragover.stop.prevent="" 
            @dragstart.stop.prevent="onDragStart"
            @dragenter.stop.prevent="onDragStart"
            @dragend.stop.prevent="onDragStop"
            @dragleave.stop.prevent="onDragStop"
            @drop.stop.prevent="onFileDrop"
            @click="selectImage"
            :style="{height: previewHeight + 'px'}">
          </canvas>
        <div v-if="!image" 
          class="picture-inner"
            :style="{top: -previewHeight + 'px', marginBottom: -previewHeight + 'px' }">
          <span v-if="supportsDragAndDrop" class="picture-inner-text">Drag an image or <br>click here to select a file</span>
          <span v-else class="picture-inner-text" >Tap here to select a photo <br>from your gallery</span>
        </div>
      </div>
      <button v-if="image" @click="selectImage" class="btn btn-primary button">Change Photo</button>
    </div>
    <div v-else>
      <button v-if="!image" class="btn btn-primary button" @click="selectImage">Select a Photo</button>
      <div v-else>
        <h3>Photo successfully selected!</h3>
        <button @click="selectImage" class="btn btn-primary button">Change Photo</button>
      </div>
    </div>
    <input ref="fileInput" type="file" :name="name" :id="id" :accept="accept" @change="onFileChange">
  </div>
</template>

<script>
export default {
  name: 'picture-input',
  props: {
    width: {
      default: Number.MAX_VALUE
    },
    height: {
      default: Number.MAX_VALUE
    },
    margin: {
      default: 0
    },
    accept: {
      default: 'image/*'
    },
    name: {
      default: null
    },
    id: {
      default: null
    }
  },
  data () {
    return {
      image: '',
      previewHeight: 0,
      previewWidth: 0,
      draggingOver: false
    }
  },
  mounted () {
    this.$nextTick(function () {
      window.addEventListener('resize', this.onResize)
      this.onResize()
    })
    if (this.supportsPreview) {
      this.pixelRatio = Math.round(window.devicePixelRatio || window.screen.deviceXDPI / window.screen.logicalXDPI)
      const canvas = this.$refs.previewCanvas
      if (canvas.getContext) {
        this.context = canvas.getContext('2d')
        this.context.scale(this.pixelRatio, this.pixelRatio)
      }
    }
    if (this.accept !== 'image/*') {
      this.fileTypes = this.accept.split(',')
      this.fileTypes = this.fileTypes.map(s => s.trim())
    }
  },
  methods: {
    onResize () {
      let previewRatio = this.width / this.height
      let newWidth = document.documentElement.clientWidth
      if (newWidth === this.viewportWidth) {
        return
      }
      this.viewportWidth = newWidth
      this.previewWidth = Math.min(this.viewportWidth - this.margin * 2, this.width)
      this.previewHeight = this.previewWidth / previewRatio
      if (this.imageObject) {
        this.drawImage(this.imageObject)
      }
    },
    onDragStart () {
      if (!this.supportsDragAndDrop) {
        return
      }
      this.draggingOver = true
    },
    onDragStop () {
      if (!this.supportsDragAndDrop) {
        return
      }
      this.draggingOver = false
    },
    onFileDrop (e) {
      this.onDragStop()
      this.onFileChange(e)
    },
    onFileChange (e) {
      let files = e.target.files || e.dataTransfer.files
      if (!files.length) {
        return
      }

      if (this.accept === 'image/*') {
        if (files[0].type.substr(0, 6) !== 'image/') {
          return
        }
      } else {
        if (this.fileTypes.indexOf(files[0].type) === -1) {
          alert('This file type is not supported.')
          return
        }
      }

      if (this.supportsPreview) {
        this.loadImage(files[0])
      } else {
        this.image = true
      }
    },
    loadImage (file) {
      this.getEXIFOrientation(file, (orientation) => {
        this.setOrientation(orientation)
        let reader = new FileReader()
        reader.onload = (e) => {
          this.image = e.target.result
          this.imageObject = new Image()
          this.imageObject.onload = () => {
            this.drawImage(this.imageObject)
          }
          this.imageObject.src = this.image
        }
        reader.readAsDataURL(file)
      })
    },
    drawImage (image) {
      this.imageWidth = image.width
      this.imageHeight = image.height
      this.imageRatio = image.width / image.height
      let offsetX = 0
      let offsetY = 0
      let scaledWidth = this.previewWidth
      let scaledHeight = this.previewHeight
      if (this.imageRatio > 1) {
        scaledWidth = scaledHeight * this.imageRatio
        offsetX = (this.previewWidth - scaledWidth) / 2
      } else {
        scaledHeight = scaledWidth / this.imageRatio
        offsetY = (this.previewHeight - scaledHeight) / 2
      }
      const canvas = this.$refs.previewCanvas
      canvas.width = this.previewWidth * this.pixelRatio
      canvas.height = this.previewHeight * this.pixelRatio
      this.context.setTransform(1, 0, 0, 1, 0, 0)
      this.context.clearRect(0, 0, canvas.width, canvas.height)
      if (this.rotate) {
        this.context.translate(offsetX * this.pixelRatio, offsetY * this.pixelRatio)
        this.context.translate(scaledWidth / 2 * this.pixelRatio, scaledHeight / 2 * this.pixelRatio)
        this.context.rotate(this.rotate)
        offsetX = -scaledWidth / 2
        offsetY = -scaledHeight / 2
      }
      this.context.drawImage(image,
        offsetX * this.pixelRatio,
        offsetY * this.pixelRatio,
        scaledWidth * this.pixelRatio,
        scaledHeight * this.pixelRatio)
    },
    selectImage () {
      this.$refs.fileInput.click()
    },
    setOrientation (orientation) {
      this.rotate = false
      if (orientation === 8) {
        this.rotate = -Math.PI / 2
      } else if (orientation === 6) {
        this.rotate = Math.PI / 2
      } else if (orientation === 3) {
        this.rotate = -Math.PI
      }
    },
    getEXIFOrientation (file, callback) {
      var reader = new FileReader()
      reader.onload = function (e) {
        var view = new DataView(e.target.result)
        if (view.getUint16(0, false) !== 0xFFD8) {
          return callback(-2)
        }
        var length = view.byteLength
        var offset = 2
        while (offset < length) {
          var marker = view.getUint16(offset, false)
          offset += 2
          if (marker === 0xFFE1) {
            if (view.getUint32(offset += 2, false) !== 0x45786966) {
              return callback(-1)
            }
            var little = view.getUint16(offset += 6, false) === 0x4949
            offset += view.getUint32(offset + 4, little)
            var tags = view.getUint16(offset, little)
            offset += 2
            for (var i = 0; i < tags; i++) {
              if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                return callback(view.getUint16(offset + (i * 12) + 8, little))
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) {
            break
          } else {
            offset += view.getUint16(offset, false)
          }
        }
        return callback(-1)
      }
      reader.readAsArrayBuffer(file.slice(0, 65536))
    }
  },
  computed: {
    supportsUpload () {
      if (navigator.userAgent.match(/(Android (1.0|1.1|1.5|1.6|2.0|2.1))|(Windows Phone (OS 7|8.0))|(XBLWP)|(ZuneWP)|(w(eb)?OSBrowser)|(webOS)|(Kindle\/(1.0|2.0|2.5|3.0))/)) {
        return false
      }
      const el = document.createElement('input')
      el.type = 'file'
      return !el.disabled
    },
    supportsPreview () {
      return window.FileReader && !!window.CanvasRenderingContext2D
    },
    supportsDragAndDrop () {
      const div = document.createElement('div')
      return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && !('ontouchstart' in window || navigator.msMaxTouchPoints)
    },
    computedClasses () {
      const classObject = {}
      classObject['dragging-over'] = this.draggingOver
      return classObject
    }
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.onResize)
  }
}
</script>

<style scoped>
.picture-input {
  width: 100%;
  margin: 0 auto;
  text-align: center;
}
.preview-container {
  width: 100%;
  box-sizing: border-box;
  margin: 1em auto;
  cursor: pointer;
  overflow: hidden;
}
.picture-preview {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  background-color: rgba(200,200,200,.25);
}
.picture-preview.dragging-over {
  filter: brightness(0.5); 
}
.picture-inner {
  position: relative;
  z-index: 2;
  pointer-events: none;
  box-sizing: border-box;
  margin: 1em auto;
  padding: 3em;
  border: .3em dashed rgba(66,66,66,.15);
  border-radius: 8px;
  width: calc(100% - 2.5em);
  height: calc(100% - 2.5em);
  display: table;
}
.picture-inner .picture-inner-text {
  display: table-cell;
  vertical-align: middle;
  text-align: center;
  font-size: 2em;
}
.button {
  cursor: pointer;
}
input[type=file] {
  display: none;
}
@media (max-width: 767px) {
  .picture-inner {
    padding: 2vw;
  }
  .picture-inner .picture-inner-text {
    font-size: 5vw;
  }
}
</style>
