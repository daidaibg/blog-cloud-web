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

/**
 * SVG 预览编辑页约定：
 * 1. Monaco 只编辑 SVG 子元素，完整 <svg> 由当前 viewBox 动态包裹生成。
 * 2. 粘贴完整 SVG 时会抽取 viewBox 到工具栏，并把子元素回填到编辑器，避免两处 viewBox 不同步。
 * 3. 预览缩放使用 `.svg-content` 作为稳定坐标系，`.svg-canvas` 绝对定位在其中。
 *    transform 状态只保存 scale 和 offset，滚轮时用鼠标在 canvas 内的坐标反算新 offset，
 *    保证鼠标下的 SVG 点在缩放前后保持不动。
 * 4. TerminalPosition 是业务自定义节点，SVG 不会直接渲染它；预览和复制时会转成主题色圆点追加到 SVG 末尾。
 * 5. SVG 内容、viewBox 和左右分栏比例都写入 localStorage，刷新后恢复上次编辑状态。
 */

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

/**
 * 拆解用户输入，兼容完整 <svg> 和 SVG 子元素两种输入方式。
 */
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
const previewContentRef = ref<HTMLElement | null>(null);
const previewCanvasRef = ref<HTMLElement | null>(null);
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
  transform: `matrix(${previewScale.value}, 0, 0, ${previewScale.value}, ${previewOffset.x}, ${previewOffset.y})`,
}));

/**
 * 返回鼠标在未缩放 canvas 内的坐标。
 * canvas 使用绝对定位，offsetLeft/offsetTop 是缩放数学的固定基准。
 */
const getCanvasAnchorPoint = (clientX: number, clientY: number) => {
  const contentRect = previewContentRef.value?.getBoundingClientRect();
  const canvas = previewCanvasRef.value;
  if (!contentRect || !canvas) return null;

  return {
    x: clientX - contentRect.left - canvas.offsetLeft,
    y: clientY - contentRect.top - canvas.offsetTop,
  };
};

const parsedViewBox = computed(() => normalizeViewBoxText(viewBoxText.value).split(","));
const previewViewBox = computed(() => parsedViewBox.value.join(" "));

const parseTagAttributes = (source: string) => {
  const attrs: Record<string, string | true> = {};
  const attrPattern = /([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(source))) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? true;
  }

  return attrs;
};

/**
 * TerminalPosition 不是标准 SVG 节点，浏览器不会把它画出来。
 * 预览渲染时将它替换为圆点，并追加到内容末尾，保证端子点显示在其它图形上方。
 */
const renderTerminalPositions = (source: string) => {
  const terminalDots: string[] = [];
  const terminalPattern = /<TerminalPosition\b([^>]*)\/>|<TerminalPosition\b([^>]*)>\s*<\/TerminalPosition>/gi;

  const content = source.replace(terminalPattern, (_, selfClosingAttrs = "", pairedAttrs = "") => {
    const attrs = parseTagAttributes(selfClosingAttrs || pairedAttrs);
    const x = Number(attrs.x);
    const y = Number(attrs.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return "";

    terminalDots.push(
      `<circle cx="${x}" cy="${y}" r="0.5" fill="#fff" stroke="var(--yh-brand-color)" stroke-width="0.25"/>`,
    );
    return "";
  });

  return [content.trim(), ...terminalDots].filter(Boolean).join("\n");
};

const buildSvgSource = (innerSource = editorOption.editValue, options: { renderTerminals?: boolean } = {}) => {
  const rawContent = removeXmlns(getEditorContent(innerSource));
  const content = options.renderTerminals ? renderTerminalPositions(rawContent) : rawContent;
  if (!content.trim()) return "";
  return `<svg viewBox="${previewViewBox.value}">\n${content.trim()}\n</svg>`;
};

/**
 * 预览使用 v-html 渲染，因此渲染前需要移除脚本、foreignObject 和事件属性。
 */
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

const previewSvg = computed(() => sanitizeSvg(buildSvgSource(editorOption.editValue, { renderTerminals: true })));

const syncEditorContent = () => {
  editorOption.editValue = formatXml(getEditorContent(editorOption.editValue));
};

const formatSvg = () => {
  syncEditorContent();
  ElMessage.success({ message: "格式化完成", plain: true });
};

const copySvg = async () => {
  await navigator.clipboard.writeText(formatXml(buildSvgSource(editorOption.editValue, { renderTerminals: true })));
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

const zoomPreview = (delta: number) => {
  const currentScale = previewScale.value;
  const nextClampedScale = clampScale(Math.round((currentScale + delta) * 100) / 100);
  const anchor = {
    x: (previewCanvasRef.value?.offsetWidth || 0) / 2,
    y: (previewCanvasRef.value?.offsetHeight || 0) / 2,
  };
  const svgPointX = (anchor.x - previewOffset.x) / currentScale;
  const svgPointY = (anchor.y - previewOffset.y) / currentScale;

  previewScale.value = nextClampedScale;
  previewOffset.x = anchor.x - svgPointX * nextClampedScale;
  previewOffset.y = anchor.y - svgPointY * nextClampedScale;
};

const resetPreviewTransform = () => {
  previewScale.value = 1;
  previewOffset.x = 0;
  previewOffset.y = 0;
};

const handlePreviewWheel = (event: WheelEvent) => {
  const anchor = getCanvasAnchorPoint(event.clientX, event.clientY);
  if (!anchor) return;

  const currentScale = previewScale.value;
  const nextScale = previewScale.value * (event.deltaY > 0 ? 0.9 : 1.1);
  const nextClampedScale = clampScale(Math.round(nextScale * 100) / 100);
  const svgPointX = (anchor.x - previewOffset.x) / currentScale;
  const svgPointY = (anchor.y - previewOffset.y) / currentScale;

  previewScale.value = nextClampedScale;
  previewOffset.x = anchor.x - svgPointX * nextClampedScale;
  previewOffset.y = anchor.y - svgPointY * nextClampedScale;
};

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
      <div class="svg-preview-actions">
        <el-button type="primary" :icon="Brush" size="small" @click="formatSvg">格式化</el-button>
        <el-button :icon="CopyDocument" size="small" @click="copySvg">复制完整 SVG</el-button>
        <el-button :icon="Refresh" size="small" @click="resetExample">示例</el-button>
        <el-button :icon="Delete" size="small" @click="clearSvg">清空</el-button>
      </div>
      <label class="svg-preview-viewbox">
        <span>viewBox</span>
        <el-input v-model="viewBoxText" placeholder="0,0,10,20" size="small" />
      </label>
    </div>

    <div ref="workbenchRef" class="svg-preview-workbench" :style="splitGridStyle">
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
      <button class="svg-preview-resizer" type="button" aria-label="调整代码和预览宽度" @pointerdown="startResize">
        <span></span>
      </button>
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
        <div ref="previewContentRef" class="svg-content" @wheel.prevent="handlePreviewWheel" @pointerdown="startPan">
          <div ref="previewCanvasRef" class="svg-canvas" :style="previewCanvasStyle" v-html="previewSvg"></div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.svg-preview-page {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 14% 0, rgba(71, 135, 240, 0.14), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent 160px),
    var(--yh-bg-color-page);
  color: var(--yh-text-color-primary);
}

.svg-preview-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(320px, auto) auto;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  margin-bottom: 8px;
  padding: 8px 10px;
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
    font-size: 17px;
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
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
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
  justify-content: center;
  min-width: 0;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.svg-preview-workbench {
  display: grid;
  gap: 0;
  flex: 1 1 0;
  min-height: 0;
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
  position: relative;
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
  position: absolute;
  left: 5%;
  top: 5%;
  display: grid;
  place-items: center;
  width: 90%;
  height: 90%;
  transform-origin: 0 0;

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
