<script setup lang="ts">
import { UploadFilled, ZoomIn, ZoomOut } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import { uploadImg } from "@/api";
import { updateUserAvatar } from "@/api/user";
import { beforeAvatarUpload } from "@/utils/upload";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean]; success: [url: string] }>();

// The visible canvas is intentionally larger than the crop frame so the shaded
// area makes the eventual avatar boundary unambiguous.
const canvasSize = 288;
const defaultFrameSize = 228;
const minFrameRatio = 0.52;
const maxFrameRatio = 0.84;
const maxZoomRatio = 6;
const fileInput = ref<HTMLInputElement>();
const cropperCanvas = ref<HTMLElement>();
const previewUrl = ref("");
const image = new Image();
const uploading = ref(false);
const dragging = ref(false);
const position = reactive({ x: 0, y: 0, startX: 0, startY: 0, originX: 0, originY: 0 });
const imageMeta = reactive({ width: 0, height: 0, scale: 1, minScale: 1 });
const cropperSize = reactive({ canvas: canvasSize, frame: defaultFrameSize });
const resizing = reactive({ active: false, startX: 0, startY: 0, startSize: defaultFrameSize, direction: "" });
let resizeObserver: ResizeObserver | undefined;

const imageStyle = computed(() => ({
  width: `${imageMeta.width * imageMeta.scale}px`,
  height: `${imageMeta.height * imageMeta.scale}px`,
  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
}));
const frameStyle = computed(() => {
  const offset = (cropperSize.canvas - cropperSize.frame) / 2;
  return { width: `${cropperSize.frame}px`, height: `${cropperSize.frame}px`, left: `${offset}px`, top: `${offset}px` };
});

function getMinScale() {
  // Deliberately allow the picture to sit smaller than the crop box. The pale
  // backing then becomes part of the square avatar instead of forcing a zoom.
  return Math.max(cropperSize.frame / imageMeta.width, cropperSize.frame / imageMeta.height) * 0.35;
}

function closeDialog() {
  emit("update:modelValue", false);
}

function openFilePicker() {
  fileInput.value?.click();
}

function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
}

function setImage(file: File) {
  if (!beforeAvatarUpload(file, ElMessage)) return;
  releasePreview();
  previewUrl.value = URL.createObjectURL(file);
  image.onload = () => {
    imageMeta.width = image.naturalWidth;
    imageMeta.height = image.naturalHeight;
    imageMeta.minScale = getMinScale();
    // Start with the image width exactly matching the square crop width. The
    // natural height is intentionally preserved and may be shorter or taller.
    imageMeta.scale = cropperSize.frame / image.naturalWidth;
    position.x = 0;
    position.y = 0;
  };
  image.src = previewUrl.value;
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) setImage(file);
  (event.target as HTMLInputElement).value = "";
}

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0];
  if (file) setImage(file);
}

function clampPosition() {
  const displayWidth = imageMeta.width * imageMeta.scale;
  const displayHeight = imageMeta.height * imageMeta.scale;
  const maxX = displayWidth >= cropperSize.frame ? (displayWidth - cropperSize.frame) / 2 : Math.max(0, (displayWidth + cropperSize.frame) / 2 - Math.min(24, displayWidth / 2));
  const maxY = displayHeight >= cropperSize.frame ? (displayHeight - cropperSize.frame) / 2 : Math.max(0, (displayHeight + cropperSize.frame) / 2 - Math.min(24, displayHeight / 2));
  position.x = Math.max(-maxX, Math.min(maxX, position.x));
  position.y = Math.max(-maxY, Math.min(maxY, position.y));
}

function onPointerDown(event: PointerEvent) {
  if (!previewUrl.value) return;
  event.preventDefault();
  dragging.value = true;
  position.startX = event.clientX;
  position.startY = event.clientY;
  position.originX = position.x;
  position.originY = position.y;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (resizing.active) {
    const dx = event.clientX - resizing.startX;
    const dy = event.clientY - resizing.startY;
    const direction = resizing.direction;
    const change = ((direction.includes("right") ? dx : -dx) + (direction.includes("bottom") ? dy : -dy));
    const minSize = cropperSize.canvas * minFrameRatio;
    const maxSize = cropperSize.canvas * maxFrameRatio;
    cropperSize.frame = Math.max(minSize, Math.min(maxSize, resizing.startSize + change));
    if (imageMeta.width) {
      imageMeta.minScale = getMinScale();
      imageMeta.scale = Math.max(imageMeta.minScale, imageMeta.scale);
      clampPosition();
    }
    return;
  }
  if (!dragging.value) return;
  position.x = position.originX + event.clientX - position.startX;
  position.y = position.originY + event.clientY - position.startY;
  clampPosition();
}

function onPointerUp() {
  dragging.value = false;
  resizing.active = false;
}

function onResizeStart(event: PointerEvent) {
  if (!previewUrl.value) return;
  const target = event.currentTarget as HTMLElement;
  resizing.active = true;
  resizing.startX = event.clientX;
  resizing.startY = event.clientY;
  resizing.startSize = cropperSize.frame;
  resizing.direction = target.dataset.direction || "bottom-right";
  cropperCanvas.value?.setPointerCapture(event.pointerId);
}

function updateScale(value: number) {
  imageMeta.scale = Number(value);
  clampPosition();
}

function zoomImage(direction: 1 | -1) {
  const step = imageMeta.minScale * 0.2;
  const maxScale = imageMeta.minScale * maxZoomRatio;
  updateScale(Math.max(imageMeta.minScale, Math.min(maxScale, imageMeta.scale + direction * step)));
}

async function saveAvatar() {
  if (!previewUrl.value || !imageMeta.width) {
    ElMessage.warning({ message: "请先选择一张图片", plain: true });
    return;
  }
  const displayWidth = imageMeta.width * imageMeta.scale;
  const displayHeight = imageMeta.height * imageMeta.scale;
  // The image and crop box are both centred in the canvas. Convert the crop
  // box's top-left point into source-image coordinates without applying the
  // canvas centre twice, otherwise saved output shifts down and right.
  const sourceX = (displayWidth / 2 - cropperSize.frame / 2 - position.x) / imageMeta.scale;
  const sourceY = (displayHeight / 2 - cropperSize.frame / 2 - position.y) / imageMeta.scale;
  const sourceSize = cropperSize.frame / imageMeta.scale;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#eaf4ff";
  context.fillRect(0, 0, 512, 512);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);

  uploading.value = true;
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
    if (!blob) throw new Error("头像裁剪失败");
    const form = new FormData();
    form.append("file", new File([blob], "avatar.png", { type: "image/png" }));
    const result = await uploadImg(form);
    const url = result?.data?.url;
    if (result?.code !== 200 || !url) throw new Error(result?.msg || "头像上传失败");
    const profileResult = await updateUserAvatar({ avatar: url });
    if (profileResult?.code !== 200) throw new Error(profileResult?.msg || "头像保存失败");
    emit("success", url);
    ElMessage.success({ message: "头像已更新", plain: true });
    closeDialog();
  } catch (error) {
    ElMessage.error({ message: (error as Error).message || "头像上传失败，请稍后重试", plain: true });
  } finally {
    uploading.value = false;
  }
}

function syncCropperSize() {
  const renderedCanvasSize = cropperCanvas.value?.clientWidth || canvasSize;
  const previousMinScale = imageMeta.minScale;
  const previousCanvasSize = cropperSize.canvas;
  cropperSize.canvas = renderedCanvasSize;
  cropperSize.frame = Math.max(renderedCanvasSize * minFrameRatio, Math.min(renderedCanvasSize * maxFrameRatio, cropperSize.frame * (renderedCanvasSize / previousCanvasSize)));

  if (!imageMeta.width) return;
  const zoomRatio = previousMinScale ? imageMeta.scale / previousMinScale : 1;
  imageMeta.minScale = getMinScale();
  imageMeta.scale = Math.max(imageMeta.minScale, imageMeta.minScale * zoomRatio);
  clampPosition();
}

watch(previewUrl, async hasPreview => {
  if (!hasPreview) return;
  await nextTick();
  if (cropperCanvas.value) resizeObserver?.observe(cropperCanvas.value);
  syncCropperSize();
});

onMounted(() => {
  resizeObserver = new ResizeObserver(syncCropperSize);
  if (cropperCanvas.value) resizeObserver.observe(cropperCanvas.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  releasePreview();
});
</script>

<template>
  <el-dialog :model-value="props.modelValue" class="avatar-crop-dialog" title="修改头像" width="520px" :close-on-click-modal="false" @update:model-value="closeDialog">
    <div class="avatar-crop-dialog__body">
      <div v-if="previewUrl" class="avatar-cropper">
        <div ref="cropperCanvas" class="avatar-cropper__canvas" @dragstart.prevent @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
          <img :src="previewUrl" :style="imageStyle" draggable="false" />
          <span class="avatar-cropper__frame" :style="frameStyle">
            <i class="avatar-cropper__safe-circle" />
            <i class="avatar-cropper__handle avatar-cropper__handle--top-left" data-direction="top-left" @pointerdown.stop="onResizeStart" />
            <i class="avatar-cropper__handle avatar-cropper__handle--top-right" data-direction="top-right" @pointerdown.stop="onResizeStart" />
            <i class="avatar-cropper__handle avatar-cropper__handle--bottom-left" data-direction="bottom-left" @pointerdown.stop="onResizeStart" />
            <i class="avatar-cropper__handle avatar-cropper__handle--bottom-right" data-direction="bottom-right" @pointerdown.stop="onResizeStart" />
          </span>
        </div>
        <div class="avatar-cropper__controls">
          <span>缩放图片</span>
          <div class="avatar-cropper__zoom-actions">
            <el-button circle aria-label="缩小图片" :disabled="imageMeta.scale <= imageMeta.minScale" @click="zoomImage(-1)"><el-icon><ZoomOut /></el-icon></el-button>
            <el-button circle type="primary" aria-label="放大图片" :disabled="imageMeta.scale >= imageMeta.minScale * maxZoomRatio" @click="zoomImage(1)"><el-icon><ZoomIn /></el-icon></el-button>
          </div>
        </div>
      </div>
      <button v-else type="button" class="avatar-crop-dialog__dropzone" @click="openFilePicker" @dragover.prevent @drop.prevent="onDrop">
        <el-icon><UploadFilled /></el-icon>
        <strong>选择或拖拽图片</strong>
        <span>支持 JPG、PNG、GIF，文件不超过 10MB</span>
      </button>
      <input ref="fileInput" class="avatar-crop-dialog__input" type="file" accept="image/png,image/jpeg,image/gif" @change="onFileChange" />
    </div>
    <template #footer>
      <div class="avatar-crop-dialog__actions">
        <el-button text class="avatar-crop-dialog__cancel" @click="closeDialog">取消</el-button>
        <el-button v-if="previewUrl" class="avatar-crop-dialog__reselect" @click="openFilePicker">重新选择</el-button>
        <el-button class="avatar-crop-dialog__save" :loading="uploading" :disabled="!previewUrl" @click="saveAvatar">保存头像</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.avatar-crop-dialog__actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.avatar-crop-dialog__body { padding: 4px 6px 10px; }
.avatar-crop-dialog__input { display: none; }
.avatar-crop-dialog__dropzone { display: grid; place-items: center; gap: 10px; width: 100%; min-height: 310px; border: 1px dashed color-mix(in srgb, var(--yh-brand-color) 52%, transparent); border-radius: 20px; background: linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(229, 242, 255, 0.9)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88), inset 0 -12px 22px rgba(74, 144, 226, 0.06); color: var(--yh-text-color-secondary); cursor: pointer; transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }
.avatar-crop-dialog__dropzone:hover { border-color: var(--yh-brand-color); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.94), 0 12px 24px rgba(53, 123, 204, 0.12); transform: translateY(-1px); }
.avatar-crop-dialog__dropzone .el-icon { color: var(--yh-brand-color); font-size: 42px; }
.avatar-crop-dialog__dropzone strong { color: var(--yh-text-color-primary); font-size: 16px; }
.avatar-cropper__canvas { position: relative; width: 288px; height: 288px; margin: 0 auto; overflow: hidden; border: 1px solid rgba(82, 143, 218, 0.45); border-radius: 18px; background: #cddcf0; box-shadow: inset 0 1px 2px rgba(18, 55, 103, 0.18), 0 14px 28px rgba(46, 100, 173, 0.18); cursor: grab; touch-action: none; }
.avatar-cropper__canvas:active { cursor: grabbing; }
.avatar-cropper__canvas img { position: absolute; top: 50%; left: 50%; max-width: none; user-select: none; pointer-events: none; }
.avatar-cropper__frame { position: absolute; box-sizing: border-box; border: 2px solid rgba(255, 255, 255, 0.98); border-radius: 6px; box-shadow: 0 0 0 1px rgba(40, 116, 208, 0.9), 0 0 0 4px rgba(145, 205, 255, 0.22), 0 0 0 999px rgba(8, 24, 51, 0.56); pointer-events: none; }
.avatar-cropper__safe-circle { position: absolute; inset: -2px; border: 2px dashed rgba(255, 255, 255, 0.98); border-radius: 50%; box-shadow: 0 0 0 1px rgba(30, 112, 210, 0.72), 0 0 14px rgba(88, 172, 255, 0.54); }
.avatar-cropper__handle { position: absolute; z-index: 2; width: 12px; height: 12px; border: 2px solid #fff; border-radius: 4px; background: var(--yh-brand-color); box-shadow: 0 1px 5px rgba(7, 42, 85, 0.45); pointer-events: auto; touch-action: none; }
.avatar-cropper__handle--top-left { top: -7px; left: -7px; cursor: nwse-resize; }
.avatar-cropper__handle--top-right { top: -7px; right: -7px; cursor: nesw-resize; }
.avatar-cropper__handle--bottom-left { bottom: -7px; left: -7px; cursor: nesw-resize; }
.avatar-cropper__handle--bottom-right { right: -7px; bottom: -7px; cursor: nwse-resize; }
.avatar-cropper__controls { display: flex; align-items: center; justify-content: space-between; width: 288px; margin: 18px auto 0; padding: 0 4px; color: var(--yh-text-color-secondary); font-size: 13px; }
.avatar-cropper__zoom-actions { display: flex; gap: 8px; }
.avatar-cropper__zoom-actions :deep(.el-button) { width: 34px; height: 34px; margin: 0; border-color: rgba(94, 155, 220, 0.45); background: rgba(255, 255, 255, 0.72); color: var(--yh-brand-color); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88), 0 3px 8px rgba(48, 108, 183, 0.14); }
.avatar-cropper__zoom-actions :deep(.el-button--primary) { border-color: rgba(188, 223, 255, 0.88); background: linear-gradient(145deg, #63b1ff, #2879df); color: #fff; }
.avatar-cropper__zoom-actions :deep(.el-button.is-disabled) { background: rgba(217, 229, 242, 0.68); color: rgba(93, 126, 161, 0.55); box-shadow: none; }

:global(.avatar-crop-dialog) { overflow: hidden; border: 1px solid rgba(139, 194, 246, 0.72); border-radius: 24px; background: linear-gradient(145deg, rgba(250, 253, 255, 0.98), rgba(225, 239, 255, 0.96)); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.96), inset 0 -18px 36px rgba(90, 153, 222, 0.1), 0 26px 64px rgba(20, 62, 113, 0.3); backdrop-filter: blur(18px); }
:global(.avatar-crop-dialog .el-dialog__header) { margin-right: 0; padding: 24px 26px 16px; border-bottom: 1px solid rgba(109, 166, 223, 0.26); }
:global(.avatar-crop-dialog .el-dialog__title) { color: var(--yh-text-color-primary); font-size: 19px; font-weight: 650; letter-spacing: 0.01em; }
:global(.avatar-crop-dialog .el-dialog__headerbtn) { top: 20px; right: 22px; border-radius: 10px; }
:global(.avatar-crop-dialog .el-dialog__headerbtn:hover .el-dialog__close) { color: var(--yh-brand-color); }
:global(.avatar-crop-dialog .el-dialog__body) { padding: 22px 26px; }
:global(.avatar-crop-dialog .el-dialog__footer) { padding: 16px 26px 24px; border-top: 1px solid rgba(109, 166, 223, 0.2); }
:global(.avatar-crop-dialog__cancel.el-button), :global(.avatar-crop-dialog__reselect.el-button) { min-height: 40px; border-radius: 14px; color: var(--yh-text-color-regular); }
:global(.avatar-crop-dialog__reselect.el-button) { border-color: rgba(94, 155, 220, 0.48); background: rgba(255, 255, 255, 0.64); }
:global(.avatar-crop-dialog__save.el-button) { min-width: 112px; min-height: 42px; border: 1px solid rgba(195, 229, 255, 0.92); border-radius: 15px; background: linear-gradient(145deg, rgba(95, 177, 255, 0.98), rgba(29, 103, 210, 0.98)); color: #fff; font-weight: 600; letter-spacing: 0.02em; text-shadow: 0 1px 1px rgba(12, 54, 112, 0.32); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.55), inset 0 -2px 5px rgba(10, 61, 144, 0.26), 0 8px 16px rgba(31, 104, 205, 0.28); transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease; }
:global(.avatar-crop-dialog__save.el-button:hover:not(.is-disabled)) { filter: brightness(1.06); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.62), inset 0 -2px 5px rgba(10, 61, 144, 0.24), 0 12px 21px rgba(31, 104, 205, 0.36); transform: translateY(-1px); }
:global(.avatar-crop-dialog__save.el-button:active:not(.is-disabled)) { box-shadow: inset 0 2px 6px rgba(10, 56, 132, 0.34), 0 3px 8px rgba(31, 104, 205, 0.24); transform: translateY(1px); }
:global(.avatar-crop-dialog__save.el-button.is-disabled) { border-color: rgba(178, 201, 226, 0.58); background: rgba(144, 172, 205, 0.62); color: rgba(255, 255, 255, 0.82); box-shadow: none; }

@media (max-width: 600px) {
  :global(.avatar-crop-dialog) { width: calc(100% - 28px) !important; border-radius: 20px; }
  :global(.avatar-crop-dialog .el-dialog__header) { padding: 20px 20px 14px; }
  :global(.avatar-crop-dialog .el-dialog__body) { padding: 18px 20px; }
  :global(.avatar-crop-dialog .el-dialog__footer) { padding: 14px 20px 20px; }
  .avatar-cropper__canvas { width: min(288px, calc(100vw - 70px)); height: min(288px, calc(100vw - 70px)); }
  .avatar-cropper__controls { width: min(288px, calc(100vw - 70px)); }
  .avatar-crop-dialog__actions { flex-wrap: wrap; }
  :global(.avatar-crop-dialog__cancel.el-button) { margin-right: auto; }
}
</style>
