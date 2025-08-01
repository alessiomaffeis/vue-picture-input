<template>
  <div ref="container" id="picture-input" class="picture-input">
    <div v-if="!supportsUpload" v-html="strings.upload"></div>
    <div v-else-if="supportsPreview">
      <div
        class="preview-container"
        :style="{
          maxWidth: previewWidth + 'px',
          height: previewHeight + 'px',
          borderRadius: radius + '%',
        }"
      >
        <canvas
          ref="previewCanvas"
          class="picture-preview"
          tabindex="0"
          :class="computedClasses"
          @drag.stop.prevent=""
          @dragover.stop.prevent=""
          @dragstart.stop.prevent=""
          @dragend.stop.prevent=""
          @dragenter.stop.prevent="onDragEnter"
          @dragleave.stop.prevent="onDragLeave"
          @drop.stop.prevent="onFileDrop"
          @click.prevent="onClick"
          @keyup.enter="onClick"
          :style="{
            height: previewHeight + 'px',
            zIndex: parseInt(zIndex) + 1,
          }"
        >
        </canvas>
        <div
          v-if="!(imageSelected || imagePreloaded) && !plain"
          class="picture-inner"
          :style="{
            top: -previewHeight + 'px',
            marginBottom: -previewHeight + 'px',
            fontSize: fontSize,
            borderRadius: radius + '%',
            zIndex: parseInt(zIndex) + 2,
          }"
        >
          <span
            v-if="supportsDragAndDrop"
            class="picture-inner-text"
            v-html="strings.drag"
          ></span>
          <span v-else class="picture-inner-text" v-html="strings.tap"></span>
        </div>
      </div>
      <button
        v-if="imageSelected && !hideChangeButton"
        @click.prevent="selectImage"
        :class="buttonClass"
        type="button"
      >
        {{ strings.change }}
      </button>
      <button
        v-if="imageSelected && removable"
        @click.prevent="removeImage"
        :class="removeButtonClass"
        type="button"
      >
        {{ strings.remove }}
      </button>
      <button
        v-if="imageSelected && toggleAspectRatio && width !== height"
        @click.prevent="rotateImage"
        :class="aspectButtonClass"
        type="button"
      >
        {{ strings.aspect }}
      </button>
    </div>
    <div v-else>
      <button
        v-if="!imageSelected"
        @click.prevent="selectImage"
        :class="buttonClass"
        type="button"
      >
        {{ strings.select }}
      </button>
      <div v-else>
        <div v-html="strings.selected"></div>
        <button
          v-if="!hideChangeButton"
          @click.prevent="selectImage"
          :class="buttonClass"
          type="button"
        >
          {{ strings.change }}
        </button>
        <button
          v-if="removable"
          @click.prevent="removeImage"
          :class="removeButtonClass"
          type="button"
        >
          {{ strings.remove }}
        </button>
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      :name="name"
      :id="id"
      :accept="accept"
      @change.stop="onFileChange"
      :capture="capture"
    />
  </div>
</template>

<script>
export default {
  name: "picture-input",
  props: {
    width: {
      type: [String, Number],
      default: Number.MAX_SAFE_INTEGER,
    },
    height: {
      type: [String, Number],
      default: Number.MAX_SAFE_INTEGER,
    },
    margin: {
      type: [String, Number],
      default: 0,
    },
    accept: {
      type: String,
      default: "image/*",
    },
    capture: {
      type: String,
      default: null,
    },
    size: {
      type: [String, Number],
      default: Number.MAX_SAFE_INTEGER,
    },
    name: {
      type: String,
      default: null,
    },
    id: {
      type: [String, Number],
      default: null,
    },
    buttonClass: {
      type: String,
      default: "btn btn-primary button",
    },
    removeButtonClass: {
      type: String,
      default: "btn btn-secondary button secondary",
    },
    aspectButtonClass: {
      type: String,
      default: "btn btn-secondary button secondary",
    },
    prefill: {
      // check for File API existence, do not fail with server side rendering
      type:
        typeof File === "undefined" || typeof Blob === "undefined"
          ? [String]
          : [String, File, Blob],
      default: "",
    },
    prefillOptions: {
      type: Object,
      default: () => {
        return {};
      },
    },
    crop: {
      type: Boolean,
      default: true,
    },
    radius: {
      type: [String, Number],
      default: 0,
    },
    removable: {
      type: Boolean,
      default: false,
    },
    hideChangeButton: {
      type: Boolean,
      default: false,
    },
    autoToggleAspectRatio: {
      type: Boolean,
      default: false,
    },
    toggleAspectRatio: {
      type: Boolean,
      default: false,
    },
    changeOnClick: {
      type: Boolean,
      default: true,
    },
    plain: {
      type: Boolean,
      default: false,
    },
    zIndex: {
      type: Number,
      default: 10000,
    },
    alertOnError: {
      type: Boolean,
      default: true,
    },
    customStrings: {
      type: Object,
      default: () => {
        return {};
      },
    },
  },
  watch: {
    prefill() {
      if (this.prefill) {
        this.preloadImage(this.prefill, this.prefillOptions);
      } else {
        this.removeImage();
      }
    },
  },
  data() {
    return {
      imageSelected: false,
      imagePreloaded: false,
      previewHeight: 0,
      previewWidth: 0,
      draggingOver: false,
      canvasWidth: 0,
      canvasHeight: 0,
      strings: {
        upload: "<p>Your device does not support file uploading.</p>",
        drag: "Drag an image or <br>click here to select a file",
        tap: "Tap here to select a photo <br>from your gallery",
        change: "Change Photo",
        aspect: "Landscape/Portrait",
        remove: "Remove Photo",
        select: "Select a Photo",
        selected: "<p>Photo successfully selected!</p>",
        fileSize: "The file size exceeds the limit",
        fileType: "This file type is not supported.",
      },
    };
  },
  mounted() {
    this.updateStrings();
    if (this.prefill) {
      this.preloadImage(this.prefill, this.prefillOptions);
    }

    this.$nextTick(() => {
      window.addEventListener("resize", this.onResize);
      this.onResize();
    });
    if (this.supportsPreview) {
      this.pixelRatio = Math.round(
        window.devicePixelRatio ||
          window.screen.deviceXDPI / window.screen.logicalXDPI
      );
      const canvas = this.$refs.previewCanvas;
      if (canvas.getContext) {
        this.context = canvas.getContext("2d");
        this.context.scale(this.pixelRatio, this.pixelRatio);
      }
    }
    if (this.accept !== "image/*") {
      this.fileTypes = this.accept.split(",");
      this.fileTypes = this.fileTypes.map((s) => s.trim());
    }
    this.canvasWidth =
      this.width != Number.MAX_SAFE_INTEGER
        ? this.width
        : this.$refs.container.clientWidth;
    this.canvasHeight =
      this.height != Number.MAX_SAFE_INTEGER ? this.height : this.canvasWidth;
    this.previewWidth = this.canvasWidth;
    this.previewHeight = this.canvasHeight;
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.onResize);
  },
  methods: {
    updateStrings() {
      for (let s in this.customStrings) {
        if (s in this.strings && typeof this.customStrings[s] === "string") {
          this.strings[s] = this.customStrings[s];
        }
      }
    },
    onClick() {
      if (!this.imageSelected) {
        this.selectImage();
        return;
      }

      if (this.changeOnClick) {
        this.selectImage();
      }

      this.$emit("click");
    },
    onResize() {
      if (this.resizeCanvas() && this.imageObject) {
        this.drawImage(this.imageObject);
      }
    },
    onDragEnter() {
      if (!this.supportsDragAndDrop) {
        return;
      }
      this.draggingOver = true;
    },
    onDragLeave() {
      if (!this.supportsDragAndDrop) {
        return;
      }
      this.draggingOver = false;
    },
    onFileDrop(e) {
      this.onDragLeave();
      this.$refs.fileInput.files = e.target.files || e.dataTransfer.files;
      this.onFileChange(e, false);
    },
    onFileChange(e, prefill) {
      const files = e.target.files || e.dataTransfer.files;
      if (!files.length) {
        return;
      }
      if (files[0].size <= 0 || files[0].size > this.size * 1024 * 1024) {
        this.$emit("error", {
          type: "fileSize",
          fileSize: files[0].size,
          fileType: files[0].type,
          fileName: files[0].name,
          message: this.strings.fileSize + " (" + this.size + "MB)",
        });
        if (this.alertOnError) {
          alert(this.strings.fileSize + " (" + this.size + "MB)");
        }
        return;
      }
      if (
        files[0].name === this.fileName &&
        files[0].size === this.fileSize &&
        this.fileModified === files[0].lastModified
      ) {
        return;
      }

      this.file = files[0];
      this.fileName = files[0].name;
      this.fileSize = files[0].size;
      this.fileModified = files[0].lastModified;
      this.fileType = files[0].type.split(";")[0];

      if (this.accept === "image/*") {
        if (this.fileType.substr(0, 6) !== "image/") {
          return;
        }
      } else {
        if (this.fileTypes.indexOf(this.fileType) === -1) {
          this.$emit("error", {
            type: "fileType",
            fileSize: this.fileSize,
            fileType: this.fileType,
            fileName: this.fileName,
            message: this.strings.fileType,
          });
          if (this.alertOnError) {
            alert(this.strings.fileType);
          }
          return;
        }
      }
      this.imageSelected = !prefill;
      this.imagePreloaded = prefill;
      if (this.supportsPreview) {
        this.loadImage(files[0], prefill || false);
      } else {
        if (prefill) {
          this.$emit("prefill");
        } else {
          this.$emit("change", this.image);
        }
      }
    },
    loadImage(file, prefill) {
      this.getEXIFOrientation(file, (orientation) => {
        this.setOrientation(orientation);
        let reader = new FileReader();
        reader.onload = (e) => {
          this.image = e.target.result;
          this.imageObject = new Image();
          this.imageObject.onload = () => {
            if (this.autoToggleAspectRatio) {
              let canvasOrientation = this.getOrientation(
                this.canvasWidth,
                this.canvasHeight
              );
              let imageOrientation = this.getOrientation(
                this.imageObject.width,
                this.imageObject.height
              );
              if (canvasOrientation !== imageOrientation) {
                this.rotateCanvas();
              }
            }
            this.drawImage(this.imageObject);
            if (prefill) {
              this.$emit("prefill");
            } else {
              this.$emit("change", this.image);
            }
          };
          this.imageObject.src = this.image;
        };
        reader.readAsDataURL(file);
      });
    },
    drawImage(image) {
      this.imageWidth = image.width;
      this.imageHeight = image.height;
      this.imageRatio = image.width / image.height;
      let offsetX = 0;
      let offsetY = 0;
      let scaledWidth = this.previewWidth;
      let scaledHeight = this.previewHeight;
      const previewRatio = this.previewWidth / this.previewHeight;
      if (this.crop) {
        if (this.imageRatio >= previewRatio) {
          scaledWidth = scaledHeight * this.imageRatio;
          offsetX = (this.previewWidth - scaledWidth) / 2;
        } else {
          scaledHeight = scaledWidth / this.imageRatio;
          offsetY = (this.previewHeight - scaledHeight) / 2;
        }
      } else {
        if (this.imageRatio >= previewRatio) {
          scaledHeight = scaledWidth / this.imageRatio;
          offsetY = (this.previewHeight - scaledHeight) / 2;
        } else {
          scaledWidth = scaledHeight * this.imageRatio;
          offsetX = (this.previewWidth - scaledWidth) / 2;
        }
      }
      const canvas = this.$refs.previewCanvas;
      canvas.style.background = "none";
      canvas.width = this.previewWidth * this.pixelRatio;
      canvas.height = this.previewHeight * this.pixelRatio;
      this.context.setTransform(1, 0, 0, 1, 0, 0);
      this.context.clearRect(0, 0, canvas.width, canvas.height);
      if (
        this.rotate &&
        typeof this.imageObject.style.imageOrientation === "undefined"
      ) {
        this.context.translate(
          offsetX * this.pixelRatio,
          offsetY * this.pixelRatio
        );
        this.context.translate(
          (scaledWidth / 2) * this.pixelRatio,
          (scaledHeight / 2) * this.pixelRatio
        );
        this.context.rotate(this.rotate);
        offsetX = -scaledWidth / 2;
        offsetY = -scaledHeight / 2;
      }
      this.context.drawImage(
        image,
        offsetX * this.pixelRatio,
        offsetY * this.pixelRatio,
        scaledWidth * this.pixelRatio,
        scaledHeight * this.pixelRatio
      );
    },
    selectImage() {
      this.$refs.fileInput.click();
    },
    removeImage() {
      this.$refs.fileInput.value = "";
      this.$refs.fileInput.type = "";
      this.$refs.fileInput.type = "file";
      this.fileName = "";
      this.fileType = "";
      this.fileSize = 0;
      this.fileModified = 0;
      this.imageSelected = false;
      this.image = "";
      this.file = null;
      this.imageObject = null;
      if (this.$refs.previewCanvas) {
        this.$refs.previewCanvas.style.backgroundColor =
          "rgba(200,200,200,.25)";
        this.$refs.previewCanvas.width = this.previewWidth * this.pixelRatio;
      }
      this.$emit("remove");
    },
    rotateImage() {
      this.rotateCanvas();

      if (this.imageObject) {
        this.drawImage(this.imageObject);
      }

      let newOrientation = this.getOrientation(
        this.canvasWidth,
        this.canvasHeight
      );
      this.$emit("aspectratiochange", newOrientation);
    },
    resizeCanvas() {
      let previewRatio = this.canvasWidth / this.canvasHeight;
      let newWidth = this.$refs.container.clientWidth;
      if (!newWidth) return false;
      if (
        !this.toggleAspectRatio &&
        !this.autoToggleAspectRatio &&
        newWidth === this.containerWidth
      ) {
        return false;
      }
      this.containerWidth = newWidth;
      this.previewWidth = Math.min(
        this.containerWidth - this.margin * 2,
        this.canvasWidth
      );
      this.previewHeight = this.previewWidth / previewRatio;
      return true;
    },
    getOrientation(width, height) {
      let orientation = "square";

      if (width > height) {
        orientation = "landscape";
      } else if (width < height) {
        orientation = "portrait";
      }

      return orientation;
    },
    switchCanvasOrientation() {
      const canvasWidth = this.canvasWidth;
      const canvasHeight = this.canvasHeight;

      this.canvasWidth = canvasHeight;
      this.canvasHeight = canvasWidth;
    },
    rotateCanvas() {
      this.switchCanvasOrientation();
      this.resizeCanvas();
    },
    setOrientation(orientation) {
      this.rotate = false;
      if (orientation === 8) {
        this.rotate = -Math.PI / 2;
      } else if (orientation === 6) {
        this.rotate = Math.PI / 2;
      } else if (orientation === 3) {
        this.rotate = -Math.PI;
      }
    },
    getEXIFOrientation(file, callback) {
      var reader = new FileReader();
      reader.onload = (e) => {
        var view = new DataView(e.target.result);
        if (view.getUint16(0, false) !== 0xffd8) {
          return callback(-2);
        }
        var length = view.byteLength;
        var offset = 2;
        while (offset < length) {
          var marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xffe1) {
            if (view.getUint32((offset += 2), false) !== 0x45786966) {
              return callback(-1);
            }
            var little = view.getUint16((offset += 6), false) === 0x4949;
            offset += view.getUint32(offset + 4, little);
            var tags = view.getUint16(offset, little);
            offset += 2;
            for (var i = 0; i < tags; i++) {
              if (view.getUint16(offset + i * 12, little) === 0x0112) {
                return callback(view.getUint16(offset + i * 12 + 8, little));
              }
            }
          } else if ((marker & 0xff00) !== 0xff00) {
            break;
          } else {
            offset += view.getUint16(offset, false);
          }
        }
        return callback(-1);
      };
      reader.readAsArrayBuffer(file.slice(0, 65536));
    },
    preloadImage(source, options) {
      // ie 11 support
      let File = window.File;
      try {
        new File([], ""); // eslint-disable-line
      } catch (e) {
        File = class File extends Blob {
          constructor(chunks, filename, opts = {}) {
            super(chunks, opts);
            this.lastModifiedDate = new Date();
            this.lastModified = +this.lastModifiedDate;
            this.name = filename;
          }
        };
      }
      options = Object.assign({}, options);
      if (typeof source === "object") {
        this.imagePreloaded = true;
        if (this.supportsPreview) {
          this.loadImage(source, true);
        } else {
          this.$emit("prefill");
        }
        return;
      }
      if (source.indexOf("data:") === -1) {
        if (source.indexOf("?") !== -1) {
          source += "&_=" + new Date().getTime();
        } else {
          source += "?_=" + new Date().getTime();
        }
      }
      let headers = new Headers();
      headers.append("Accept", "image/*");
      fetch(source, {
        method: "GET",
        mode: "cors",
        headers: headers,
      })
        .then((response) => {
          return response.blob();
        })
        .then((imageBlob) => {
          let e = { target: { files: [] } };
          const fileName = options.fileName || source.split("/").slice(-1)[0];
          let mediaType =
            options.mediaType ||
            imageBlob.type ||
            "image/" +
              (options.fileType ||
                fileName.split("?")[0].split(".").slice(-1)[0].split("?")[0]);
          mediaType = mediaType.replace("jpg", "jpeg");
          mediaType = mediaType.replace("image/svg", "image/svg+xml");
          if (mediaType === "image/svg") {
            mediaType = "image/svg+xml";
          }
          e.target.files[0] = new File([imageBlob], fileName, {
            type: mediaType,
          });
          this.onFileChange(e, true);
        })
        .catch((err) => {
          this.$emit("error", {
            type: "failedPrefill",
            message: "Failed loading prefill image: " + err,
          });
          if (this.alertOnError) {
            alert("Failed loading prefill image: " + err);
          }
        });
    },
  },
  computed: {
    supportsUpload() {
      if (
        navigator.userAgent.match(
          /(Android (1.0|1.1|1.5|1.6|2.0|2.1))|(Windows Phone (OS 7|8.0))|(XBLWP)|(ZuneWP)|(w(eb)?OSBrowser)|(webOS)|(Kindle\/(1.0|2.0|2.5|3.0))/
        )
      ) {
        return false;
      }
      const el = document.createElement("input");
      el.type = "file";
      return !el.disabled;
    },
    supportsPreview() {
      return window.FileReader && !!window.CanvasRenderingContext2D;
    },
    supportsDragAndDrop() {
      const div = document.createElement("div");
      return (
        ("draggable" in div || ("ondragstart" in div && "ondrop" in div)) &&
        !("ontouchstart" in window || navigator.msMaxTouchPoints)
      );
    },
    computedClasses() {
      const classObject = {};
      classObject["dragging-over"] = this.draggingOver;
      return classObject;
    },
    fontSize() {
      return Math.min(0.04 * this.previewWidth, 21) + "px";
    },
  },
};
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
  margin: 0 auto;
  cursor: pointer;
  overflow: hidden;
  transform: translate3d(0, 0, 0);
}
.picture-preview {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 10001;
  box-sizing: border-box;
  background-color: rgba(200, 200, 200, 0.25);
}
.picture-preview.dragging-over {
  filter: brightness(0.5);
}
.picture-inner {
  position: relative;
  z-index: 10002;
  pointer-events: none;
  box-sizing: border-box;
  margin: 1em auto;
  padding: 0.5em;
  border: 0.3em dashed rgba(66, 66, 66, 0.15);
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
  line-height: 1.5;
}
button {
  margin: 1em 0.25em;
  cursor: pointer;
}
input[type="file"] {
  display: none;
}
</style>
