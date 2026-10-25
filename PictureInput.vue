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
            zIndex: parseInt(String(zIndex)) + 1,
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
            zIndex: parseInt(String(zIndex)) + 2,
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
        v-if="(imageSelected || imagePreloaded) && !hideChangeButton"
        @click.prevent="selectImage"
        :class="buttonClass"
        type="button"
      >
        {{ strings.change }}
      </button>
      <button
        v-if="(imageSelected || imagePreloaded) && removable"
        @click.prevent="removeImage"
        :class="removeButtonClass"
        type="button"
      >
        {{ strings.remove }}
      </button>
      <button
        v-if="(imageSelected || imagePreloaded) && toggleAspectRatio && canvasWidth !== canvasHeight"
        @click.prevent="rotateImage"
        :class="aspectButtonClass"
        type="button"
      >
        {{ strings.aspect }}
      </button>
    </div>
    <div v-else>
      <button
        v-if="!(imageSelected || imagePreloaded)"
        @click.prevent="selectImage"
        :class="buttonClass"
        type="button"
      >
        {{ strings.select }}
      </button>
      <div v-else>
        <div v-if="imageSelected" v-html="strings.selected"></div>
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
      :name="name ?? undefined"
      :id="id == null ? undefined : String(id)"
      :accept="accept"
      @change.stop="onFileChange"
      :capture="(capture ?? undefined) as InputHTMLAttributes['capture']"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  toRefs,
  useTemplateRef,
  watch,
  type InputHTMLAttributes,
  type PropType,
} from "vue";

interface PrefillOptions {
  fileName?: string;
  fileType?: string;
  mediaType?: string;
}

interface ImageFile extends Blob {
  readonly name?: string;
  readonly lastModified?: number;
}

interface SelectedFile extends ImageFile {
  readonly name: string;
  readonly lastModified: number;
}

interface FileSourceEvent {
  target?: { files?: ArrayLike<SelectedFile> | null } | null;
  dataTransfer?: { files: FileList } | null;
}

interface ValidationError {
  type: "fileSize" | "fileType";
  fileSize: number;
  fileType: string;
  fileName: string;
  message: string;
}

interface PrefillError {
  type: "failedPrefill";
  message: string;
}

interface LegacyScreen extends Screen {
  deviceXDPI?: number;
  logicalXDPI?: number;
}

interface LegacyNavigator extends Navigator {
  msMaxTouchPoints?: number;
}

defineOptions({ name: "picture-input" });

const props = defineProps({
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
    type: String as PropType<string | null>,
    default: null,
  },
  size: {
    type: [String, Number],
    default: Number.MAX_SAFE_INTEGER,
  },
  name: {
    type: String as PropType<string | null>,
    default: null,
  },
  id: {
    type: [String, Number] as PropType<string | number | null>,
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
    // Check for browser constructors without requiring them during module evaluation.
    type: (typeof File === "undefined" || typeof Blob === "undefined"
      ? [String]
      : [String, File, Blob]) as PropType<string | File | Blob>,
    default: "",
  },
  prefillOptions: {
    type: Object as PropType<PrefillOptions | null>,
    default: () => ({}),
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
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({}),
  },
});

const emit = defineEmits<{
  change: [image: string | undefined];
  prefill: [];
  remove: [];
  click: [];
  error: [error: ValidationError | PrefillError];
  aspectratiochange: [orientation: string];
}>();

const imageSelected = ref(false);
const imagePreloaded = ref(false);
const previewHeight = ref(0);
const previewWidth = ref(0);
const draggingOver = ref(false);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
// Parents can mutate these messages or retain the exposed object by reference.
const strings = ref({
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
});

// These were assigned dynamically by the Options API component. Keep their
// initial undefined values distinct from the explicit removal/reset values.
const image = ref<string>();
const file = shallowRef<ImageFile | null>();
const fileName = ref<string>();
const fileSize = ref<number>();
const fileModified = ref<number>();
const fileType = ref<string>();
const imageObject = shallowRef<HTMLImageElement | null>();
const pixelRatio = ref<number>();
const context = shallowRef<CanvasRenderingContext2D | null>();
const fileTypes = shallowRef<string[]>();
const containerWidth = ref<number>();
const imageWidth = ref<number>();
const imageHeight = ref<number>();
const imageRatio = ref<number>();
const rotate = ref<number | false>();

const container = useTemplateRef<HTMLDivElement>("container");
const previewCanvas = useTemplateRef<HTMLCanvasElement>("previewCanvas");
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");

let mounted = false;
let disposed = false;
const pendingReaders = new Set<FileReader>();
const pendingImages = new Set<HTMLImageElement>();
const pendingRequests = new Set<AbortController>();

const supportsUpload = computed(() => {
  if (typeof navigator === "undefined" || typeof document === "undefined") return false;
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
});

const supportsPreview = computed(() =>
  typeof window !== "undefined" && !!window.FileReader && !!window.CanvasRenderingContext2D
);

const supportsDragAndDrop = computed(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const div = document.createElement("div");
  return (
    ("draggable" in div || ("ondragstart" in div && "ondrop" in div)) &&
    !("ontouchstart" in window || (navigator as LegacyNavigator).msMaxTouchPoints)
  );
});

const computedClasses = computed(() => ({ "dragging-over": draggingOver.value }));
const fontSize = computed(() => Math.min(0.04 * previewWidth.value, 21) + "px");

function updateStrings() {
  const messages = strings.value;
  for (const key in props.customStrings) {
    const value = props.customStrings[key];
    if (key in messages && typeof value === "string") {
      messages[key as keyof typeof messages] = value;
    }
  }
}

function onClick() {
  if (disposed) return;
  if (!(imageSelected.value || imagePreloaded.value)) {
    selectImage();
    return;
  }
  if (props.changeOnClick) selectImage();
  emit("click");
}

function onResize() {
  if (resizeCanvas() && imageObject.value) drawImage(imageObject.value);
}

function onDragEnter() {
  if (disposed || !supportsDragAndDrop.value) return;
  draggingOver.value = true;
}

function onDragLeave() {
  if (disposed || !supportsDragAndDrop.value) return;
  draggingOver.value = false;
}

function onFileDrop(event: DragEvent) {
  if (disposed) return;
  onDragLeave();
  const target = event.target as HTMLInputElement | null;
  const files = target?.files || event.dataTransfer?.files;
  if (fileInput.value && files) fileInput.value.files = files;
  onFileChange(event, false);
}

function onFileChange(event: Event | FileSourceEvent, prefill = false) {
  if (disposed) return;
  const target = event.target as FileSourceEvent["target"];
  const files = target?.files || ("dataTransfer" in event ? event.dataTransfer?.files : undefined);
  if (!files?.length) return;
  // Capture the File before clearing a rejected, live native FileList.
  const selected = files[0];
  if (selected.size <= 0 || selected.size > Number(props.size) * 1024 * 1024) {
    if (!prefill && fileInput.value) fileInput.value.value = "";
    emit("error", {
      type: "fileSize",
      fileSize: selected.size,
      fileType: selected.type,
      fileName: selected.name,
      message: strings.value.fileSize + " (" + props.size + "MB)",
    });
    if (props.alertOnError) alert(strings.value.fileSize + " (" + props.size + "MB)");
    return;
  }
  if (
    selected.name === fileName.value &&
    selected.size === fileSize.value &&
    fileModified.value === selected.lastModified
  ) {
    return;
  }

  const selectedType = selected.type.split(";")[0];
  const fileExtension = selected.name.split(".").pop()!;
  const accepted = props.accept === "image/*"
    ? selectedType.substr(0, 6) === "image/"
    : !!fileTypes.value && (fileTypes.value.indexOf(selectedType) !== -1 ||
        fileTypes.value.indexOf(fileExtension) !== -1);
  if (!accepted) {
    if (!prefill && fileInput.value) fileInput.value.value = "";
    emit("error", {
      type: "fileType",
      fileSize: selected.size,
      fileType: selectedType,
      fileName: selected.name,
      message: strings.value.fileType,
    });
    if (props.alertOnError) alert(strings.value.fileType);
    return;
  }

  file.value = selected;
  fileName.value = selected.name;
  fileSize.value = selected.size;
  fileModified.value = selected.lastModified;
  fileType.value = selectedType;
  imageSelected.value = !prefill;
  imagePreloaded.value = !!prefill;
  if (supportsPreview.value) loadImage(selected, prefill);
  else if (prefill) emit("prefill");
  else emit("change", image.value);
}

function createReader() {
  const reader = new FileReader();
  pendingReaders.add(reader);
  reader.onloadend = () => pendingReaders.delete(reader);
  return reader;
}

function loadImage(source: Blob, prefill = false) {
  if (disposed) return;
  getEXIFOrientation(source, (orientation) => {
    if (disposed) return;
    setOrientation(orientation);
    const reader = createReader();
    reader.onload = () => {
      pendingReaders.delete(reader);
      if (disposed || typeof reader.result !== "string") return;
      image.value = reader.result;
      const loadingImage = new Image();
      imageObject.value = loadingImage;
      pendingImages.add(loadingImage);
      loadingImage.onload = () => {
        pendingImages.delete(loadingImage);
        if (disposed || !imageObject.value) return;
        if (props.autoToggleAspectRatio) {
          const canvasOrientation = getOrientation(canvasWidth.value, canvasHeight.value);
          const imageOrientation = getOrientation(imageObject.value.width, imageObject.value.height);
          if (canvasOrientation !== imageOrientation) rotateCanvas();
        }
        drawImage(imageObject.value);
        if (prefill) emit("prefill");
        else emit("change", image.value);
      };
      loadingImage.src = image.value;
    };
    reader.readAsDataURL(source);
  });
}

function drawImage(source: HTMLImageElement) {
  const canvas = previewCanvas.value;
  const drawingContext = context.value;
  const ratio = pixelRatio.value;
  if (disposed || !canvas || !drawingContext || ratio === undefined) return;
  imageWidth.value = source.width;
  imageHeight.value = source.height;
  imageRatio.value = source.width / source.height;
  let offsetX = 0;
  let offsetY = 0;
  let scaledWidth = previewWidth.value;
  let scaledHeight = previewHeight.value;
  const previewRatio = previewWidth.value / previewHeight.value;
  if (props.crop) {
    if (imageRatio.value >= previewRatio) {
      scaledWidth = scaledHeight * imageRatio.value;
      offsetX = (previewWidth.value - scaledWidth) / 2;
    } else {
      scaledHeight = scaledWidth / imageRatio.value;
      offsetY = (previewHeight.value - scaledHeight) / 2;
    }
  } else {
    if (imageRatio.value >= previewRatio) {
      scaledHeight = scaledWidth / imageRatio.value;
      offsetY = (previewHeight.value - scaledHeight) / 2;
    } else {
      scaledWidth = scaledHeight * imageRatio.value;
      offsetX = (previewWidth.value - scaledWidth) / 2;
    }
  }
  canvas.style.background = "none";
  canvas.width = previewWidth.value * ratio;
  canvas.height = previewHeight.value * ratio;
  drawingContext.setTransform(1, 0, 0, 1, 0, 0);
  drawingContext.clearRect(0, 0, canvas.width, canvas.height);
  if (rotate.value && typeof imageObject.value?.style.imageOrientation === "undefined") {
    drawingContext.translate(offsetX * ratio, offsetY * ratio);
    drawingContext.translate((scaledWidth / 2) * ratio, (scaledHeight / 2) * ratio);
    drawingContext.rotate(rotate.value);
    offsetX = -scaledWidth / 2;
    offsetY = -scaledHeight / 2;
  }
  drawingContext.drawImage(
    source, offsetX * ratio, offsetY * ratio, scaledWidth * ratio, scaledHeight * ratio
  );
}

function selectImage() {
  if (!disposed) fileInput.value?.click();
}

function removeImage() {
  if (disposed) return;
  if (fileInput.value) {
    fileInput.value.value = "";
    fileInput.value.type = "";
    fileInput.value.type = "file";
  }
  fileName.value = "";
  fileType.value = "";
  fileSize.value = 0;
  fileModified.value = 0;
  imageSelected.value = false;
  imagePreloaded.value = false;
  image.value = "";
  file.value = null;
  imageObject.value = null;
  if (previewCanvas.value) {
    previewCanvas.value.style.backgroundColor = "rgba(200,200,200,.25)";
    previewCanvas.value.width = previewWidth.value * (pixelRatio.value ?? 1);
  }
  emit("remove");
}

function rotateImage() {
  if (disposed) return;
  rotateCanvas();
  if (imageObject.value) drawImage(imageObject.value);
  emit("aspectratiochange", getOrientation(canvasWidth.value, canvasHeight.value));
}

function resizeCanvas() {
  if (disposed || !container.value) return false;
  const previewRatio = canvasWidth.value / canvasHeight.value;
  const newWidth = container.value.clientWidth;
  if (!newWidth) return false;
  if (!props.toggleAspectRatio && !props.autoToggleAspectRatio && newWidth === containerWidth.value) {
    return false;
  }
  containerWidth.value = newWidth;
  previewWidth.value = Math.min(containerWidth.value - Number(props.margin) * 2, canvasWidth.value);
  previewHeight.value = previewWidth.value / previewRatio;
  return true;
}

function getOrientation(width: number, height: number) {
  let orientation = "square";
  if (width > height) orientation = "landscape";
  else if (width < height) orientation = "portrait";
  return orientation;
}

function switchCanvasOrientation() {
  const width = canvasWidth.value;
  canvasWidth.value = canvasHeight.value;
  canvasHeight.value = width;
}

function rotateCanvas() {
  switchCanvasOrientation();
  resizeCanvas();
}

function setOrientation(orientation: number) {
  rotate.value = false;
  if (orientation === 8) rotate.value = -Math.PI / 2;
  else if (orientation === 6) rotate.value = Math.PI / 2;
  else if (orientation === 3) rotate.value = -Math.PI;
}

function getEXIFOrientation(source: Blob, callback: (orientation: number) => void) {
  if (disposed) return;
  const reader = createReader();
  reader.onload = () => {
    pendingReaders.delete(reader);
    if (disposed || reader.result === null || typeof reader.result === "string") return;
    const view = new DataView(reader.result);
    if (view.getUint16(0, false) !== 0xffd8) return callback(-2);
    const length = view.byteLength;
    let offset = 2;
    while (offset < length) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        if (view.getUint32((offset += 2), false) !== 0x45786966) return callback(-1);
        const little = view.getUint16((offset += 6), false) === 0x4949;
        offset += view.getUint32(offset + 4, little);
        const tags = view.getUint16(offset, little);
        offset += 2;
        for (let i = 0; i < tags; i++) {
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
  reader.readAsArrayBuffer(source.slice(0, 65536));
}

function preloadImage(source: string | ImageFile, options?: PrefillOptions | null) {
  if (disposed) return;
  // Retain the File-constructor fallback for browsers with only the Blob API.
  let PrefillFile: new (chunks: BlobPart[], filename: string, opts?: FilePropertyBag) => SelectedFile = window.File;
  try {
    new PrefillFile([], "");
  } catch {
    PrefillFile = class extends Blob {
      lastModifiedDate: Date;
      lastModified: number;
      name: string;

      constructor(chunks: BlobPart[], filename: string, opts: FilePropertyBag = {}) {
        super(chunks, opts);
        this.lastModifiedDate = new Date();
        this.lastModified = +this.lastModifiedDate;
        this.name = filename;
      }
    };
  }
  const prefillOptions = Object.assign({}, options);
  if (typeof source === "object") {
    // Update the preview source without changing the native form selection.
    file.value = source;
    fileName.value = source.name || "";
    fileSize.value = source.size;
    fileModified.value = source.lastModified || 0;
    fileType.value = source.type.split(";")[0];
    imageSelected.value = false;
    imagePreloaded.value = true;
    if (supportsPreview.value) loadImage(source, true);
    else emit("prefill");
    return;
  }
  if (source.indexOf("data:") === -1) {
    source += (source.indexOf("?") !== -1 ? "&_=" : "?_=") + new Date().getTime();
  }
  const headers = new Headers();
  headers.append("Accept", "image/*");
  // Older fetch polyfills may not provide AbortController. The disposed guard
  // still prevents their queued callbacks from acting after unmount.
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  if (controller) pendingRequests.add(controller);
  fetch(source, {
    method: "GET",
    mode: "cors",
    headers,
    ...(controller ? { signal: controller.signal } : {}),
  })
    .then((response) => {
      if (disposed) return;
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.blob();
    })
    .then((imageBlob) => {
      if (controller) pendingRequests.delete(controller);
      if (disposed || !imageBlob) return;
      const name = prefillOptions.fileName || source.split("/").slice(-1)[0];
      let mediaType = prefillOptions.mediaType || imageBlob.type || "image/" +
        (prefillOptions.fileType || name.split("?")[0].split(".").slice(-1)[0].split("?")[0]);
      mediaType = mediaType.replace("jpg", "jpeg");
      if (mediaType === "image/svg") mediaType = "image/svg+xml";
      const generatedFile = new PrefillFile([imageBlob], name, { type: mediaType });
      onFileChange({ target: { files: [generatedFile] } }, true);
    })
    .catch((error: unknown) => {
      if (controller) pendingRequests.delete(controller);
      if (disposed || controller?.signal.aborted) return;
      emit("error", {
        type: "failedPrefill",
        message: "Failed loading prefill image: " + error,
      });
      if (props.alertOnError) alert("Failed loading prefill image: " + error);
    });
}

onMounted(() => {
  updateStrings();
  if (props.accept !== "image/*") fileTypes.value = props.accept.split(",").map(s => s.trim());
  canvasWidth.value = Number(props.width) !== Number.MAX_SAFE_INTEGER
    ? Number(props.width) : container.value!.clientWidth;
  canvasHeight.value = Number(props.height) !== Number.MAX_SAFE_INTEGER
    ? Number(props.height) : canvasWidth.value;
  previewWidth.value = canvasWidth.value;
  previewHeight.value = canvasHeight.value;
  if (supportsPreview.value) {
    const screen = window.screen as LegacyScreen;
    pixelRatio.value = Math.round(window.devicePixelRatio ||
      (screen.deviceXDPI ?? NaN) / (screen.logicalXDPI ?? NaN));
    context.value = previewCanvas.value?.getContext?.("2d");
    context.value?.scale(pixelRatio.value, pixelRatio.value);
  }
  window.addEventListener("resize", onResize);
  onResize();
  mounted = true;
  if (props.prefill) preloadImage(props.prefill, props.prefillOptions);
});

watch(() => props.prefill, source => {
  if (!mounted || disposed) return;
  if (source) preloadImage(source, props.prefillOptions);
  else removeImage();
});

onBeforeUnmount(() => {
  disposed = true;
  mounted = false;
  window.removeEventListener("resize", onResize);
  for (const reader of pendingReaders) {
    reader.onload = null;
    reader.onloadend = null;
    reader.abort();
  }
  pendingReaders.clear();
  for (const loadingImage of pendingImages) {
    loadingImage.onload = null;
    loadingImage.onerror = null;
    loadingImage.removeAttribute("src");
  }
  pendingImages.clear();
  for (const controller of pendingRequests) controller.abort();
  pendingRequests.clear();
});

// Preserve the Options API's flat, live parent-ref surface (including helpers
// and props), without exposing the private lifecycle/cancellation resources.
defineExpose({
  ...toRefs(props),
  imageSelected, imagePreloaded, previewHeight, previewWidth, draggingOver,
  canvasWidth, canvasHeight, strings, image, file, fileName, fileSize,
  fileModified, fileType, imageObject, pixelRatio, context, fileTypes,
  containerWidth, imageWidth, imageHeight, imageRatio, rotate,
  supportsUpload, supportsPreview, supportsDragAndDrop, computedClasses, fontSize,
  updateStrings, onClick, onResize, onDragEnter, onDragLeave, onFileDrop,
  onFileChange, loadImage, drawImage, selectImage, removeImage, rotateImage,
  resizeCanvas, getOrientation, switchCanvasOrientation, rotateCanvas,
  setOrientation, getEXIFOrientation, preloadImage,
});
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
