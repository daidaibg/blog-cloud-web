<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Brush, CopyDocument, Delete, Refresh, View, ZoomIn, ZoomOut } from "@element-plus/icons-vue";
import { useEventListener } from "@vueuse/core";
import Loading from "@/components/loading";

const MonacoEditor = defineAsyncComponent({
  loader: () => import("@/components/monaco-editor"),
  loadingComponent: Loading,
});

const storageKeys = {
  svg: "gaobug:svg-preview:svg",
  viewBox: "gaobug:svg-preview:view-box",
  split: "gaobug:svg-preview:split",
};

const defaultViewBox = "0,0,120,120";
const exampleSvg = `<svg viewBox="0 0 120 120">
  <rect x="14" y="18" width="92" height="84" rx="18" fill="#f8fafc" stroke="#0f172a" stroke-width="4"/>
  <path d="M36 72L54 50L68 64L82 42L92 78H28L36 72Z" fill="#22c55e"/>
  <circle cx="40" cy="40" r="9" fill="#38bdf8"/>
  <path d="M31 88H90" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/>
</svg>`;

const readLocal = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式或受限环境下 localStorage 可能不可用。
  }
};

const clampSplit = (value: number) => Math.min(72, Math.max(28, value));
const clampScale = (value: number) => Math.min(8, Math.max(0.2, value));
const removeXmlns = (source: string) => source.replace(/\sxmlns(:\w+)?="[^"]*"/gi, "");

const normalizeViewBoxText = (source: string) => {
  const values = source
    .split(/[,\s]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  if (values.length !== 4 || values[2] <= 0 || values[3] <= 0) {
    return defaultViewBox;
  }

  return values.join(",");
};

// 兼容完整 <svg> 和内部元素输入，编辑器最终只保留内部元素。
const extractSvgParts = (source: string) => {
  const cleanedSource = removeXmlns(source.trim());
  if (!cleanedSource || typeof DOMParser === "undefined") {
    return {
      inner: cleanedSource,
      viewBox: "",
    };
  }

  const doc = new DOMParser().parseFromString(cleanedSource, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) {
    return {
      inner: cleanedSource,
      viewBox: "",
    };
  }

  return {
    inner: Array.from(svg.childNodes)
      .map((node) => new XMLSerializer().serializeToString(node))
      .join("\n")
      .trim(),
    viewBox: svg.getAttribute("viewBox") || "",
  };
};

const formatXml = (source: string) => {
  const compactSource = removeXmlns(source)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("");

  const tokens = compactSource.match(/<[^>]+>|[^<]+/g) || [];
  const lines: string[] = [];
  let level = 0;

  tokens.forEach((token) => {
    const current = token.trim();
    if (!current) return;

    if (/^<\//.test(current)) {
      level = Math.max(level - 1, 0);
      lines.push(`${"  ".repeat(level)}${current}`);
      return;
    }

    lines.push(`${"  ".repeat(level)}${current}`);

    const isSelfClosingTag = /\/>$/.test(current);
    const isOpeningTag = /^<[^!?/]/.test(current) && !isSelfClosingTag;
    const isInlineClosed = /^<([^>\s/]+)[^>]*>.*<\/\1>$/.test(current);
    if (isOpeningTag && !isInlineClosed) {
      level += 1;
    }
  });

  return lines.join("\n\n");
};

const getEditorContent = (source: string) => {
  const { inner } = extractSvgParts(source);
  return inner || source.trim();
};

const storedSvg = readLocal(storageKeys.svg, exampleSvg);
const storedSvgParts = extractSvgParts(storedSvg);
const initialViewBox = normalizeViewBoxText(storedSvgParts.viewBox || readLocal(storageKeys.viewBox, defaultViewBox));

const editorOption = reactive<any>({
  theme: "vs",
  editValue: getEditorContent(storedSvg),
  languageModel: "xml",
  hightChange: false,
  options: {
    minimap: {
      enabled: true,
    },
    wordWrap: "on",
  },
});

const viewBoxText = ref(initialViewBox);
const workbenchRef = ref<HTMLElement | null>(null);
const previewRatio = ref(clampSplit(Number(readLocal(storageKeys.split, "48")) || 48));
const isDragging = ref(false);
const isPanning = ref(false);
const previewScale = ref(1);
const previewOffset = reactive({ x: 0, y: 0 });
const lastPanPoint = reactive({ x: 0, y: 0 });

const splitGridStyle = computed(() => ({
  gridTemplateColumns: `minmax(260px, ${previewRatio.value}fr) 12px minmax(320px, ${100 - previewRatio.value}fr)`,
}));

const previewCanvasStyle = computed(() => ({
  transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale.value})`,
}));

const parsedViewBox = computed(() => normalizeViewBoxText(viewBoxText.value).split(","));
const previewViewBox = computed(() => parsedViewBox.value.join(" "));

// 编辑器只存内部元素，预览和复制时再按当前 viewBox 包成完整 SVG。
const buildSvgSource = (innerSource = editorOption.editValue) => {
  const content = removeXmlns(getEditorContent(innerSource));
  if (!content.trim()) return "";
  return `<svg viewBox="${previewViewBox.value}">\n${content.trim()}\n</svg>`;
};

// 预览前过滤高风险节点和事件属性，只渲染安全的 SVG 子集。
const sanitizeSvg = (source: string) => {
  if (!source || typeof DOMParser === "undefined") return "";

  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (doc.querySelector("parsererror")) return "";

  doc.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
  const svg = doc.querySelector("svg");
  if (!svg) return "";

  [svg, ...Array.from(svg.querySelectorAll("*"))].forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });

  return new XMLSerializer().serializeToString(svg);
};

const previewSvg = computed(() => sanitizeSvg(buildSvgSource()));

const syncEditorContent = () => {
  editorOption.editValue = formatXml(getEditorContent(editorOption.editValue));
};

const formatSvg = () => {
  syncEditorContent();
  ElMessage.success({ message: "格式化完成", plain: true });
};

const copySvg = async () => {
  await navigator.clipboard.writeText(formatXml(buildSvgSource()));
  ElMessage.success({ message: "已复制完整 SVG", plain: true });
};

const clearSvg = () => {
  editorOption.editValue = "";
};

const resetExample = () => {
  const parts = extractSvgParts(exampleSvg);
  viewBoxText.value = normalizeViewBoxText(parts.viewBox || defaultViewBox);
  editorOption.editValue = formatXml(parts.inner);
};

// VueUse 有拖拽基础工具，但没有完整缩放平移组合，这里保留显式的 transform 状态。
const zoomPreview = (delta: number) => {
  previewScale.value = clampScale(Math.round((previewScale.value + delta) * 100) / 100);
};

const resetPreviewTransform = () => {
  previewScale.value = 1;
  previewOffset.x = 0;
  previewOffset.y = 0;
};

const handlePreviewWheel = (event: WheelEvent) => {
  const nextScale = previewScale.value * (event.deltaY > 0 ? 0.9 : 1.1);
  previewScale.value = clampScale(Math.round(nextScale * 100) / 100);
};

// 在 window 上监听移动，鼠标拖出预览面板后仍能保持平移流畅。
const startPan = (event: PointerEvent) => {
  if (event.button !== 0) return;
  isPanning.value = true;
  lastPanPoint.x = event.clientX;
  lastPanPoint.y = event.clientY;
};

const stopPan = () => {
  isPanning.value = false;
};

const updateSplit = (clientX: number) => {
  const rect = workbenchRef.value?.getBoundingClientRect();
  if (!rect) return;

  const nextRatio = ((clientX - rect.left) / rect.width) * 100;
  previewRatio.value = clampSplit(nextRatio);
};

const startResize = (event: PointerEvent) => {
  isDragging.value = true;
  updateSplit(event.clientX);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
};

const stopResize = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
};

watch(
  () => editorOption.editValue,
  (value) => {
    const parts = extractSvgParts(value);
    if (parts.viewBox) {
      viewBoxText.value = normalizeViewBoxText(parts.viewBox);
    }
    // 粘贴完整 SVG 时，把 viewBox 移到工具栏，Monaco 里只保留子元素。
    if (/^\s*<svg[\s>]/i.test(value)) {
      editorOption.editValue = formatXml(parts.inner);
      return;
    }
    writeLocal(storageKeys.svg, value);
  },
);

watch(viewBoxText, (value) => {
  const normalizedViewBox = normalizeViewBoxText(value);
  writeLocal(storageKeys.viewBox, normalizedViewBox);
  writeLocal(storageKeys.svg, buildSvgSource());
});

watch(previewRatio, (value) => writeLocal(storageKeys.split, String(Math.round(value * 100) / 100)));

useEventListener(window, "pointermove", (event) => {
  if (!isDragging.value) return;
  updateSplit(event.clientX);
});

useEventListener(window, "pointermove", (event) => {
  if (!isPanning.value) return;
  previewOffset.x += event.clientX - lastPanPoint.x;
  previewOffset.y += event.clientY - lastPanPoint.y;
  lastPanPoint.x = event.clientX;
  lastPanPoint.y = event.clientY;
});

useEventListener(window, "pointerup", () => {
  stopResize();
  stopPan();
});
useEventListener(window, "blur", () => {
  stopResize();
  stopPan();
});
</script>

<template>
  <div class="svg-preview-page gaobug" :class="{ 'is-resizing': isDragging, 'is-panning': isPanning }">
    <div class="svg-preview-toolbar">
      <div class="svg-preview-title">
        <span>SVG 预览编辑</span>
        <small>实时保存 · 内联预览 · 支持缩放平移 · 支持拖拽分栏</small>
      </div>
      <label class="svg-preview-viewbox">
        <span>viewBox</span>
        <el-input v-model="viewBoxText" placeholder="0,0,10,20" size="small" />
      </label>
      <div class="svg-preview-actions">
        <el-button type="primary" :icon="Brush" @click="formatSvg">格式化</el-button>
        <el-button :icon="CopyDocument" @click="copySvg">复制完整 SVG</el-button>
        <el-button :icon="Refresh" @click="resetExample">示例</el-button>
        <el-button :icon="Delete" @click="clearSvg">清空</el-button>
      </div>
    </div>

    <div ref="workbenchRef" class="svg-preview-workbench" :style="splitGridStyle">
      <section class="svg-preview-panel svg-preview-result">
        <div class="svg-preview-panel-header preview-header">
          <div>
            <span>预览</span>
            <small>{{ previewViewBox }}</small>
          </div>
          <div class="preview-tools">
            <span>{{ Math.round(previewScale * 100) }}%</span>
            <el-button :icon="ZoomOut" text circle size="small" @click="zoomPreview(-0.1)" />
            <el-button :icon="ZoomIn" text circle size="small" @click="zoomPreview(0.1)" />
            <el-button :icon="Refresh" text circle size="small" @click="resetPreviewTransform" />
            <el-icon><View /></el-icon>
          </div>
        </div>
        <div class="svg-content" @wheel.prevent="handlePreviewWheel" @pointerdown="startPan">
          <div class="svg-canvas" :style="previewCanvasStyle" v-html="previewSvg"></div>
        </div>
      </section>
      <button class="svg-preview-resizer" type="button" aria-label="调整预览和代码宽度" @pointerdown="startResize">
        <span></span>
      </button>
      <section class="svg-preview-panel svg-preview-editor">
        <div class="svg-preview-panel-header">
          <div>
            <span>代码</span>
            <small>SVG inner elements</small>
          </div>
        </div>
        <MonacoEditor
          v-model="editorOption.editValue"
          :language="editorOption.languageModel"
          :hight-change="editorOption.hightChange"
          :options="(editorOption.options as any)"
          :theme="editorOption.theme"
          :read-only="false"
          @save="formatSvg"
          class="svg-preview-monaco" />
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.svg-preview-page {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 14% 0, rgba(71, 135, 240, 0.14), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent 160px),
    var(--yh-bg-color-page);
  color: var(--yh-text-color-primary);
}

.svg-preview-toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto minmax(280px, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 48px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(12px);
}

.svg-preview-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  span {
    font-size: 18px;
    font-weight: 900;
    line-height: 1.2;
  }

  small {
    color: var(--yh-text-color-secondary);
    font-size: 12px;
    line-height: 1.2;
  }
}

.svg-preview-viewbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--yh-border-level-1-color);
  border-radius: 6px;
  background: var(--yh-bg-color-container);

  span {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--yh-text-color-secondary);
  }

  :deep(.el-input) {
    width: 180px;
  }

  :deep(.el-input__wrapper) {
    box-shadow: none;
    background: var(--yh-bg-color-page);
  }
}

.svg-preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.svg-preview-workbench {
  display: grid;
  gap: 0;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.svg-preview-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--yh-border-level-1-color);
  border-radius: 8px;
  background: var(--yh-bg-color-container);
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.08);
}

.svg-preview-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid var(--yh-border-level-1-color);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.42));

  div {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  span {
    font-size: 13px;
    font-weight: 800;
  }

  small {
    color: var(--yh-text-color-secondary);
    font-size: 12px;
  }
}

.preview-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;

  span {
    min-width: 42px;
    color: var(--yh-text-color-secondary);
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }
}

.svg-preview-resizer {
  width: 12px;
  min-width: 12px;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: col-resize;
  display: grid;
  place-items: center;
  touch-action: none;

  span {
    width: 4px;
    height: 52px;
    border-radius: 999px;
    background: rgba(100, 116, 139, 0.28);
    transition:
      width 0.2s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  &:hover span {
    width: 5px;
    background: var(--yh-brand-color);
    box-shadow: 0 0 0 4px rgba(71, 135, 240, 0.1);
  }
}

.svg-preview-monaco {
  width: 100%;
  height: calc(100% - 39px);
  min-height: 0;
}

.svg-preview-result {
  display: flex;
  flex-direction: column;
}

.svg-content {
  width: 100%;
  height: calc(100% - 39px);
  flex: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  background:
    linear-gradient(45deg, rgba(226, 232, 240, 0.72) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(226, 232, 240, 0.72) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(226, 232, 240, 0.72) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(226, 232, 240, 0.72) 75%),
    #ffffff;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0, 0 0;
  background-size: 20px 20px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.03), inset 0 18px 40px rgba(15, 23, 42, 0.035);
  cursor: grab;
  user-select: none;
}

.svg-canvas {
  display: grid;
  place-items: center;
  width: 86%;
  height: 86%;
  transform-origin: center center;

  :deep(svg) {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
}

.is-resizing {
  cursor: col-resize;

  .svg-content {
    pointer-events: none;
  }

  .svg-preview-resizer span {
    width: 5px;
    background: var(--yh-brand-color);
    box-shadow: 0 0 0 4px rgba(71, 135, 240, 0.12);
  }
}

.is-panning {
  cursor: grabbing;

  .svg-content {
    cursor: grabbing;
  }
}

@media (max-width: 900px) {
  .svg-preview-page {
    padding: 8px;
  }

  .svg-preview-toolbar {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }

  .svg-preview-actions {
    justify-content: flex-start;
  }

  .svg-preview-workbench {
    grid-template-columns: 1fr !important;
    grid-template-rows: minmax(0, 1fr) 12px minmax(0, 1fr);
  }

  .svg-preview-resizer {
    width: 100%;
    min-width: 0;
    height: 12px;
    cursor: row-resize;

    span {
      width: 52px;
      height: 4px;
    }
  }

  .svg-preview-editor,
  .svg-preview-result,
  .svg-preview-monaco {
    min-height: 0;
  }
}
</style>
