<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Brush, CopyDocument, Delete, EditPen, Refresh, ZoomIn, ZoomOut } from "@element-plus/icons-vue";
import { useElementSize, useEventListener } from "@vueuse/core";
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
const editableSelector = [
  "circle",
  "ellipse",
  "g",
  "image",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "use",
].join(",");

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
const { width: previewContentWidth, height: previewContentHeight } = useElementSize(previewContentRef);
const previewRatio = ref(clampSplit(Number(readLocal(storageKeys.split, "48")) || 48));
const isDragging = ref(false);
const isPanning = ref(false);
const previewScale = ref(1);
const previewOffset = reactive({ x: 0, y: 0 });
const lastPanPoint = reactive({ x: 0, y: 0 });
const selectedSvgElementIds = ref<string[]>([]);
const selectedElementName = ref("");
const selectionBox = reactive({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  visible: false,
});
const activeElementEdit = reactive<{
  mode: "" | "move";
  elementIds: string[];
  startPoint: { x: number; y: number };
  terminalStartPoint: { x: number; y: number };
  startMatrix: DOMMatrix | null;
  startContent: string;
}>({
  mode: "",
  elementIds: [],
  startPoint: { x: 0, y: 0 },
  terminalStartPoint: { x: 0, y: 0 },
  startMatrix: null,
  startContent: "",
});
const contextMenu = reactive({
  left: 0,
  top: 0,
  visible: false,
});
const transformPanel = reactive({
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  left: 20,
  mode: "scale" as "scale" | "move" | "rotate",
  moveStepX: 1,
  moveStepY: 1,
  rotateStep: 15,
  scaleStep: 10,
  top: 20,
  visible: false,
});

const splitGridStyle = computed(() => ({
  gridTemplateColumns: `minmax(260px, ${previewRatio.value}fr) 12px minmax(320px, ${100 - previewRatio.value}fr)`,
}));

const previewCanvasStyle = computed(() => ({
  ...getViewBoxCanvasRect(),
  transform: `matrix(${previewScale.value}, 0, 0, ${previewScale.value}, ${previewOffset.x}, ${previewOffset.y})`,
  "--svg-preview-scale": previewScale.value,
}));

const getViewBoxCanvasRect = () => {
  const [, , viewBoxWidth, viewBoxHeight] = normalizeViewBoxText(viewBoxText.value)
    .split(",")
    .map(Number);
  const ratio = viewBoxWidth > 0 && viewBoxHeight > 0 ? viewBoxWidth / viewBoxHeight : 1;
  const containerWidth = previewContentWidth.value;
  const containerHeight = previewContentHeight.value;

  if (!containerWidth || !containerHeight) {
    return {
      aspectRatio: `${viewBoxWidth || 1} / ${viewBoxHeight || 1}`,
      height: "90%",
      left: "5%",
      top: "5%",
      width: "90%",
    };
  }

  let width = containerWidth * 0.96;
  let height = width / ratio;
  const maxHeight = containerHeight * 0.96;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return {
    aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}`,
    height: `${height}px`,
    left: `${(containerWidth - width) / 2}px`,
    top: `${(containerHeight - height) / 2}px`,
    width: `${width}px`,
  };
};

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
const hasSelectedElement = computed(() => Boolean(selectedSvgElementIds.value.length && selectionBox.visible));

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
const renderTerminalPositions = (source: string, options: { editable?: boolean } = {}) => {
  const terminalDots: string[] = [];
  const terminalPattern = /<TerminalPosition\b([^>]*)\/>|<TerminalPosition\b([^>]*)>\s*<\/TerminalPosition>/gi;
  let terminalIndex = 0;

  const content = source.replace(terminalPattern, (_, selfClosingAttrs = "", pairedAttrs = "") => {
    const attrs = parseTagAttributes(selfClosingAttrs || pairedAttrs);
    const x = Number(attrs.x);
    const y = Number(attrs.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return "";

    const editAttrs = options.editable
      ? ` data-svg-edit-id="terminal:${terminalIndex}" data-svg-edit-kind="TerminalPosition"`
      : "";
    terminalIndex += 1;
    terminalDots.push(
      `<circle${editAttrs} cx="${x}" cy="${y}" r="0.5" fill="#fff" stroke="var(--yh-brand-color)" stroke-width="0.25"/>`,
    );
    return "";
  });

  return [content.trim(), ...terminalDots].filter(Boolean).join("\n");
};

const markEditableElements = (source: string) => {
  if (!source || typeof DOMParser === "undefined") return source;

  const doc = new DOMParser().parseFromString(`<svg>${source}</svg>`, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return source;

  Array.from(svg.querySelectorAll(editableSelector)).forEach((node, index) => {
    node.setAttribute("data-svg-edit-id", `node:${index}`);
  });

  return Array.from(svg.childNodes)
    .map((node) => new XMLSerializer().serializeToString(node))
    .join("\n")
    .trim();
};

const buildSvgSource = (
  innerSource = editorOption.editValue,
  options: { renderTerminals?: boolean; editable?: boolean } = {},
) => {
  const rawContent = removeXmlns(getEditorContent(innerSource));
  const editableContent = options.editable ? markEditableElements(rawContent) : rawContent;
  const content = options.renderTerminals
    ? renderTerminalPositions(editableContent, { editable: options.editable })
    : editableContent;
  if (!content.trim()) return "";
  return `<svg viewBox="${previewViewBox.value}">\n${content.trim()}\n</svg>`;
};

/**
 * 预览使用 v-html 渲染，因此渲染前需要移除脚本、foreignObject 和事件属性。
 */
const sanitizeSvg = (source: string) => {
  if (!source) {
    return {
      error: "",
      svg: "",
    };
  }
  if (typeof DOMParser === "undefined") {
    return {
      error: "当前浏览器不支持 SVG 解析，无法生成预览。",
      svg: "",
    };
  }

  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return {
      error: parserError.textContent?.trim() || "SVG 解析失败，请检查标签是否闭合、属性引号是否完整。",
      svg: "",
    };
  }

  doc.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
  const svg = doc.querySelector("svg");
  if (!svg) {
    return {
      error: "没有找到可预览的 svg 内容。",
      svg: "",
    };
  }

  [svg, ...Array.from(svg.querySelectorAll("*"))].forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });

  return {
    error: "",
    svg: new XMLSerializer().serializeToString(svg),
  };
};

const previewResult = computed(() => sanitizeSvg(buildSvgSource(editorOption.editValue, { renderTerminals: true, editable: true })));
const previewSvg = computed(() => previewResult.value.svg);
const previewError = computed(() => previewResult.value.error);

const getSelectedPreviewElements = () =>
  selectedSvgElementIds.value
    .map((id) => previewCanvasRef.value?.querySelector<SVGGraphicsElement>(`[data-svg-edit-id="${id}"]`) || null)
    .filter((element): element is SVGGraphicsElement => Boolean(element));

const getSelectedPreviewElement = () => getSelectedPreviewElements()[0] || null;

const updateSelectionBox = () => {
  const contentRect = previewContentRef.value?.getBoundingClientRect();
  const selectedElements = getSelectedPreviewElements();
  if (!contentRect || !selectedElements.length) {
    selectionBox.visible = false;
    return;
  }

  try {
    const corners = selectedElements.flatMap((selectedElement) => {
      const box = selectedElement.getBBox();
      const matrix = selectedElement.getScreenCTM();
      if (!matrix) return [];

      const padding = getSelectionPadding(selectedElement);
      return [
        new DOMPoint(box.x - padding, box.y - padding),
        new DOMPoint(box.x + box.width + padding, box.y - padding),
        new DOMPoint(box.x + box.width + padding, box.y + box.height + padding),
        new DOMPoint(box.x - padding, box.y + box.height + padding),
      ].map((point) => point.matrixTransform(matrix));
    });
    if (!corners.length) {
      selectionBox.visible = false;
      return;
    }
    const left = Math.min(...corners.map((point) => point.x));
    const top = Math.min(...corners.map((point) => point.y));
    const right = Math.max(...corners.map((point) => point.x));
    const bottom = Math.max(...corners.map((point) => point.y));

    selectionBox.left = left - contentRect.left;
    selectionBox.top = top - contentRect.top;
    selectionBox.width = Math.max(right - left, 1);
    selectionBox.height = Math.max(bottom - top, 1);
    selectionBox.visible = true;
  } catch {
    const rects = selectedElements.map((element) => element.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    selectionBox.left = left - contentRect.left;
    selectionBox.top = top - contentRect.top;
    selectionBox.width = Math.max(right - left, 1);
    selectionBox.height = Math.max(bottom - top, 1);
    selectionBox.visible = true;
  }
};

const scheduleSelectionBoxUpdate = () => {
  requestAnimationFrame(updateSelectionBox);
};

const getSvgPoint = (element: SVGGraphicsElement, clientX: number, clientY: number) => {
  const svg = element.ownerSVGElement;
  const matrix = svg?.getScreenCTM()?.inverse();
  if (!svg || !matrix) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const svgPoint = point.matrixTransform(matrix);
  return {
    x: svgPoint.x,
    y: svgPoint.y,
  };
};

const getSelectionPadding = (element: SVGGraphicsElement) => {
  const readStrokeWidth = (node: Element) => {
    const attrStrokeWidth = Number(node.getAttribute("stroke-width"));
    if (Number.isFinite(attrStrokeWidth) && attrStrokeWidth > 0) return attrStrokeWidth / 2;

    const computedStrokeWidth = Number.parseFloat(window.getComputedStyle(node).strokeWidth);
    return Number.isFinite(computedStrokeWidth) && computedStrokeWidth > 0 ? computedStrokeWidth / 2 : 0;
  };

  const nodeStrokeWidths = [element, ...Array.from(element.querySelectorAll("*"))].map((node) => readStrokeWidth(node) + 0.25);
  return Math.max(0.5, ...nodeStrokeWidths);
};

const getSelectionSvgBounds = () => {
  const points = getSelectedPreviewElements().flatMap((element) => {
    try {
      const box = element.getBBox();
      const matrix = element.getCTM();
      if (!matrix) return [];

      return [
        new DOMPoint(box.x, box.y),
        new DOMPoint(box.x + box.width, box.y),
        new DOMPoint(box.x + box.width, box.y + box.height),
        new DOMPoint(box.x, box.y + box.height),
      ].map((point) => point.matrixTransform(matrix));
    } catch {
      return [];
    }
  });

  if (!points.length) return null;

  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
};

const getPointBounds = (points: Array<{ x: number; y: number }>) => {
  const validPoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!validPoints.length) return null;

  const left = Math.min(...validPoints.map((point) => point.x));
  const top = Math.min(...validPoints.map((point) => point.y));
  const right = Math.max(...validPoints.map((point) => point.x));
  const bottom = Math.max(...validPoints.map((point) => point.y));
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
};

const getNumericAttribute = (node: Element, name: string, fallback = 0) => {
  const value = Number(node.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
};

const getCoordinatePairPoints = (value: string) => {
  const numbers = value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const points: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < numbers.length - 1; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }

  return points;
};

const getElementCoordinatePoints = (node: Element): Array<{ x: number; y: number }> => {
  const nodeTagName = node.tagName.toLowerCase();

  if (["rect", "image", "use"].includes(nodeTagName)) {
    const x = getNumericAttribute(node, "x");
    const y = getNumericAttribute(node, "y");
    const width = getNumericAttribute(node, "width");
    const height = getNumericAttribute(node, "height");
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  if (nodeTagName === "text") {
    return [{ x: getNumericAttribute(node, "x"), y: getNumericAttribute(node, "y") }];
  }

  if (nodeTagName === "circle") {
    const cx = getNumericAttribute(node, "cx");
    const cy = getNumericAttribute(node, "cy");
    const r = getNumericAttribute(node, "r");
    return [
      { x: cx - r, y: cy - r },
      { x: cx + r, y: cy + r },
    ];
  }

  if (nodeTagName === "ellipse") {
    const cx = getNumericAttribute(node, "cx");
    const cy = getNumericAttribute(node, "cy");
    const rx = getNumericAttribute(node, "rx");
    const ry = getNumericAttribute(node, "ry");
    return [
      { x: cx - rx, y: cy - ry },
      { x: cx + rx, y: cy + ry },
    ];
  }

  if (nodeTagName === "line") {
    return [
      { x: getNumericAttribute(node, "x1"), y: getNumericAttribute(node, "y1") },
      { x: getNumericAttribute(node, "x2"), y: getNumericAttribute(node, "y2") },
    ];
  }

  if (["polyline", "polygon"].includes(nodeTagName)) {
    return getCoordinatePairPoints(node.getAttribute("points") || "");
  }

  if (nodeTagName === "path") {
    return getCoordinatePairPoints(node.getAttribute("d") || "");
  }

  if (nodeTagName === "g") {
    return Array.from(node.querySelectorAll(editableSelector)).flatMap(getElementCoordinatePoints);
  }

  return [];
};

const getTerminalCoordinatePoints = (source: string, includedIds?: Set<string>, excludedIds?: Set<string>) => {
  const points: Array<{ x: number; y: number }> = [];
  const terminalPattern = /<TerminalPosition\b([^>]*)\/>|<TerminalPosition\b([^>]*)>\s*<\/TerminalPosition>/gi;
  let terminalIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = terminalPattern.exec(source))) {
    const elementId = `terminal:${terminalIndex}`;
    const attrs = parseTagAttributes(match[1] || match[2] || "");
    const x = Number(attrs.x);
    const y = Number(attrs.y);
    terminalIndex += 1;
    if (includedIds && !includedIds.has(elementId)) continue;
    if (excludedIds?.has(elementId)) continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    points.push(
      { x: x - 0.5, y: y - 0.5 },
      { x: x + 0.5, y: y + 0.5 },
    );
  }

  return points;
};

const getSourceSvgBounds = (elementIds?: string[], excludedElementIds: string[] = []) => {
  const rawSource = removeXmlns(getEditorContent(editorOption.editValue));
  const includedIds = elementIds ? new Set(elementIds) : null;
  const excludedIds = new Set(excludedElementIds);
  const nodeIndexes = includedIds
    ? new Set(
        elementIds
          .filter((elementId) => elementId.startsWith("node:"))
          .map(getSvgElementIndex)
          .filter((index) => Number.isFinite(index)),
      )
    : null;
  const excludedNodeIndexes = new Set(
    excludedElementIds
      .filter((elementId) => elementId.startsWith("node:"))
      .map(getSvgElementIndex)
      .filter((index) => Number.isFinite(index)),
  );
  const points = getTerminalCoordinatePoints(rawSource, includedIds || undefined, excludedIds);
  const doc = new DOMParser().parseFromString(`<svg>${rawSource}</svg>`, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (svg && !doc.querySelector("parsererror")) {
    const editableNodes = Array.from(svg.querySelectorAll(editableSelector));
    const excludedNodes = editableNodes.filter((_, index) => excludedNodeIndexes.has(index));
    editableNodes.forEach((node, index) => {
      if (excludedNodes.some((excludedNode) => excludedNode === node || excludedNode.contains(node))) return;
      if (!nodeIndexes || nodeIndexes.has(index)) {
        points.push(...getElementCoordinatePoints(node));
      }
    });
  }

  return getPointBounds(points);
};

const formatSvgNumber = (value: number) => String(Number(value.toFixed(4)));

const setXmlAttribute = (attrs: string, name: string, value: string) => {
  const attrPattern = new RegExp(`(\\s${name}\\s*=\\s*)(["'])(.*?)\\2`, "i");
  if (attrPattern.test(attrs)) {
    return attrs.replace(attrPattern, `$1$2${value}$2`);
  }

  return `${attrs.trimEnd()} ${name}="${value}"`;
};

const transformCoordinatePairs = (
  value: string,
  transform: (point: { x: number; y: number }) => { x: number; y: number },
) => {
  const numbers = value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!numbers) return value;

  let coordinateIndex = 0;
  return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (match) => {
    const pairIndex = Math.floor(coordinateIndex / 2) * 2;
    const x = Number(numbers[pairIndex]);
    const y = Number(numbers[pairIndex + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      coordinateIndex += 1;
      return match;
    }

    const nextPoint = transform({ x, y });
    const nextValue = coordinateIndex % 2 === 0 ? nextPoint.x : nextPoint.y;
    coordinateIndex += 1;
    return formatSvgNumber(nextValue);
  });
};

const rotatePoint = (point: { x: number; y: number }, center: { x: number; y: number }, rotate = 0) => {
  if (!rotate) return point;

  const angle = (rotate * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

const getSvgElementIndex = (elementId: string) => Number(elementId.replace("node:", ""));
const getTerminalIndex = (elementId: string) => Number(elementId.replace("terminal:", ""));

const updateTerminalPositionsByCoordinates = (
  elementIds: string[],
  change: { dx?: number; dy?: number; rotate?: number; scale?: number; center?: { x: number; y: number } },
  source: string,
) => {
  const terminalIndexes = new Set(
    elementIds
      .filter((elementId) => elementId.startsWith("terminal:"))
      .map(getTerminalIndex)
      .filter((index) => Number.isFinite(index)),
  );
  if (!terminalIndexes.size) return source;

  let currentIndex = -1;
  const dx = change.dx || 0;
  const dy = change.dy || 0;
  const rotate = change.rotate || 0;
  const scale = change.scale || 1;
  const center = change.center || { x: 0, y: 0 };
  const terminalPattern = /<TerminalPosition\b([^>]*)\/>|<TerminalPosition\b([^>]*)>\s*<\/TerminalPosition>/gi;

  return source.replace(terminalPattern, (full, selfClosingAttrs = "", pairedAttrs = "") => {
    const attrs = parseTagAttributes(selfClosingAttrs || pairedAttrs);
    const x = Number(attrs.x);
    const y = Number(attrs.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return full;

    currentIndex += 1;
    if (!terminalIndexes.has(currentIndex)) return full;

    const scaledPoint = {
      x: center.x + (x - center.x) * scale,
      y: center.y + (y - center.y) * scale,
    };
    const nextPoint = rotatePoint(scaledPoint, center, rotate);
    const nextAttrs = setXmlAttribute(
      setXmlAttribute(selfClosingAttrs || pairedAttrs, "x", formatSvgNumber(nextPoint.x + dx)),
      "y",
      formatSvgNumber(nextPoint.y + dy),
    );
    return selfClosingAttrs ? `<TerminalPosition${nextAttrs}/>` : `<TerminalPosition${nextAttrs}></TerminalPosition>`;
  });
};

const updateSvgElementsByCoordinates = (
  elementIds: string[],
  change: { dx?: number; dy?: number; rotate?: number; scale?: number; center?: { x: number; y: number } },
  source = editorOption.editValue,
) => {
  const nodeIndexes = new Set(
    elementIds
      .filter((elementId) => elementId.startsWith("node:"))
      .map(getSvgElementIndex)
      .filter((index) => Number.isFinite(index)),
  );
  const rawSource = removeXmlns(getEditorContent(source));

  let nextSource = updateTerminalPositionsByCoordinates(elementIds, change, rawSource);
  if (!nodeIndexes.size) {
    editorOption.editValue = nextSource;
    return;
  }

  const doc = new DOMParser().parseFromString(`<svg>${nextSource}</svg>`, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return;

  const dx = change.dx || 0;
  const dy = change.dy || 0;
  const rotate = change.rotate || 0;
  const scale = change.scale || 1;
  const center = change.center || { x: 0, y: 0 };
  const transformPoint = (point: { x: number; y: number }) => {
    const scaledPoint = {
      x: center.x + (point.x - center.x) * scale,
      y: center.y + (point.y - center.y) * scale,
    };
    const rotatedPoint = rotatePoint(scaledPoint, center, rotate);
    return {
      x: rotatedPoint.x + dx,
      y: rotatedPoint.y + dy,
    };
  };
  const updateTarget = (node: Element) => {
    const nodeTagName = node.tagName.toLowerCase();
    const transformAttr = (name: string, transform: (value: number) => number) => {
      const current = Number(node.getAttribute(name) || 0);
      node.setAttribute(name, formatSvgNumber(transform(current)));
    };

    if (["rect", "image", "text", "use"].includes(nodeTagName)) {
      const x = Number(node.getAttribute("x") || 0);
      const y = Number(node.getAttribute("y") || 0);
      const nextPoint = transformPoint({ x, y });
      node.setAttribute("x", formatSvgNumber(nextPoint.x));
      node.setAttribute("y", formatSvgNumber(nextPoint.y));
      if (["rect", "image", "use"].includes(nodeTagName)) {
        transformAttr("width", (value) => value * scale);
        transformAttr("height", (value) => value * scale);
      }
    } else if (["circle", "ellipse"].includes(nodeTagName)) {
      const cx = Number(node.getAttribute("cx") || 0);
      const cy = Number(node.getAttribute("cy") || 0);
      const nextPoint = transformPoint({ x: cx, y: cy });
      node.setAttribute("cx", formatSvgNumber(nextPoint.x));
      node.setAttribute("cy", formatSvgNumber(nextPoint.y));
      if (nodeTagName === "circle") {
        transformAttr("r", (value) => value * scale);
      } else {
        transformAttr("rx", (value) => value * scale);
        transformAttr("ry", (value) => value * scale);
      }
    } else if (nodeTagName === "line") {
      const point1 = transformPoint({
        x: Number(node.getAttribute("x1") || 0),
        y: Number(node.getAttribute("y1") || 0),
      });
      const point2 = transformPoint({
        x: Number(node.getAttribute("x2") || 0),
        y: Number(node.getAttribute("y2") || 0),
      });
      node.setAttribute("x1", formatSvgNumber(point1.x));
      node.setAttribute("y1", formatSvgNumber(point1.y));
      node.setAttribute("x2", formatSvgNumber(point2.x));
      node.setAttribute("y2", formatSvgNumber(point2.y));
    } else if (["polyline", "polygon"].includes(nodeTagName)) {
      node.setAttribute(
        "points",
        transformCoordinatePairs(node.getAttribute("points") || "", transformPoint),
      );
    } else if (nodeTagName === "path") {
      node.setAttribute(
        "d",
        transformCoordinatePairs(node.getAttribute("d") || "", transformPoint),
      );
    } else if (nodeTagName === "g") {
      Array.from(node.querySelectorAll(editableSelector)).forEach(updateTarget);
    }
  };

  Array.from(svg.querySelectorAll(editableSelector)).forEach((node, index) => {
    if (nodeIndexes.has(index)) updateTarget(node);
  });

  editorOption.editValue = formatXml(
    Array.from(svg.childNodes)
      .map((node) => new XMLSerializer().serializeToString(node))
      .join("\n")
      .trim(),
  );
};

const startElementEdit = (event: PointerEvent, element: SVGGraphicsElement) => {
  const point = getSvgPoint(element, event.clientX, event.clientY);
  if (!point) return;

  activeElementEdit.mode = "move";
  activeElementEdit.elementIds = [...selectedSvgElementIds.value];
  activeElementEdit.startPoint = point;
  activeElementEdit.terminalStartPoint = {
    x: Number(element.getAttribute("cx")) || point.x,
    y: Number(element.getAttribute("cy")) || point.y,
  };
  activeElementEdit.startMatrix = new DOMMatrix();
  activeElementEdit.startContent = editorOption.editValue;
};

const syncSelectedElementName = () => {
  if (selectedSvgElementIds.value.length > 1) {
    selectedElementName.value = `已选 ${selectedSvgElementIds.value.length} 项`;
    return;
  }

  const element = getSelectedPreviewElement();
  selectedElementName.value = element ? element.dataset.svgEditKind || element.tagName.toLowerCase() : "";
};

const selectElement = (element: SVGGraphicsElement, append = false) => {
  const elementId = element.dataset.svgEditId || "";
  if (!elementId) return;

  if (append) {
    selectedSvgElementIds.value = selectedSvgElementIds.value.includes(elementId)
      ? selectedSvgElementIds.value.filter((id) => id !== elementId)
      : [...selectedSvgElementIds.value, elementId];
  } else {
    selectedSvgElementIds.value = [elementId];
  }

  syncSelectedElementName();
  updateSelectionBox();
};

const stopElementEdit = () => {
  activeElementEdit.mode = "";
  activeElementEdit.elementIds = [];
  activeElementEdit.startMatrix = null;
  activeElementEdit.startContent = "";
};

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
  scheduleSelectionBoxUpdate();
};

const resetPreviewTransform = () => {
  previewScale.value = 1;
  previewOffset.x = 0;
  previewOffset.y = 0;
  scheduleSelectionBoxUpdate();
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
  scheduleSelectionBoxUpdate();
};

const startPan = (event: PointerEvent) => {
  if (event.button !== 0) return;
  selectedSvgElementIds.value = [];
  selectedElementName.value = "";
  contextMenu.visible = false;
  selectionBox.visible = false;
  isPanning.value = true;
  lastPanPoint.x = event.clientX;
  lastPanPoint.y = event.clientY;
};

const stopPan = () => {
  isPanning.value = false;
};

const getEditableTarget = (event: PointerEvent) => {
  const target = event.target instanceof Element ? event.target.closest<SVGGraphicsElement>("[data-svg-edit-id]") : null;
  if (!target || !previewCanvasRef.value?.contains(target)) return null;
  return target;
};

const handlePreviewPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;
  contextMenu.visible = false;

  const selectionTarget =
    event.target instanceof Element ? event.target.closest<HTMLElement>(".svg-selection-box") : null;
  if (selectionTarget && hasSelectedElement.value) {
    const selectedElement = getSelectedPreviewElement();
    if (!selectedElement) return;
    event.preventDefault();
    event.stopPropagation();
    startElementEdit(event, selectedElement);
    return;
  }

  const editableTarget = getEditableTarget(event);
  if (editableTarget) {
    event.preventDefault();
    event.stopPropagation();
    selectElement(editableTarget, event.shiftKey || event.ctrlKey || event.metaKey);
    return;
  }

  startPan(event);
};

const handlePreviewContextMenu = (event: MouseEvent) => {
  const editableTarget =
    event.target instanceof Element ? event.target.closest<SVGGraphicsElement>("[data-svg-edit-id]") : null;
  const selectionTarget =
    event.target instanceof Element ? event.target.closest<HTMLElement>(".svg-selection-box") : null;

  if (!editableTarget && !selectionTarget && !hasSelectedElement.value) return;

  event.preventDefault();
  const contentRect = previewContentRef.value?.getBoundingClientRect();
  if (!contentRect) return;

  if (editableTarget && !selectedSvgElementIds.value.includes(editableTarget.dataset.svgEditId || "")) {
    selectElement(editableTarget);
  }

  contextMenu.left = event.clientX - contentRect.left;
  contextMenu.top = event.clientY - contentRect.top;
  contextMenu.visible = true;
};

const updateElementEdit = (event: PointerEvent) => {
  const selectedElement = getSelectedPreviewElement();
  if (!selectedElement || !activeElementEdit.startMatrix) return;

  const point = getSvgPoint(selectedElement, event.clientX, event.clientY);
  if (!point) return;

  if (activeElementEdit.mode === "move") {
    updateSvgElementsByCoordinates(
      activeElementEdit.elementIds,
      {
        dx: point.x - activeElementEdit.startPoint.x,
        dy: point.y - activeElementEdit.startPoint.y,
      },
      activeElementEdit.startContent,
    );
    scheduleSelectionBoxUpdate();
    return;
  }

  scheduleSelectionBoxUpdate();
};

const closeContextMenu = () => {
  contextMenu.visible = false;
};

const getSelectionCenterPoint = () => {
  const bounds = getSourceSvgBounds(selectedSvgElementIds.value);
  if (!bounds) return null;

  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
};

const applySelectedTransform = (change: { rotate?: number; scale?: number }) => {
  const center = getSelectionCenterPoint();
  if (!center) return;

  updateSvgElementsByCoordinates(selectedSvgElementIds.value, {
    center,
    ...change,
  });
  scheduleSelectionBoxUpdate();
};

const scaleSelectedElements = (scale: number) => {
  const center = getSelectionCenterPoint();
  if (!center) return;

  updateSvgElementsByCoordinates(selectedSvgElementIds.value, {
    center,
    scale,
  });
  scheduleSelectionBoxUpdate();
};

const rotateSelectedElements = (rotate: number) => {
  applySelectedTransform({ rotate });
};

const moveSelectedElements = (dx: number, dy: number) => {
  updateSvgElementsByCoordinates(selectedSvgElementIds.value, { dx, dy });
  scheduleSelectionBoxUpdate();
};

const openTransformPanel = (mode: "scale" | "move" | "rotate") => {
  const contentRect = previewContentRef.value?.getBoundingClientRect();
  transformPanel.mode = mode;
  transformPanel.left = Math.max(8, Math.min(contextMenu.left + 12, (contentRect?.width || 360) - 248));
  transformPanel.top = Math.max(8, Math.min(contextMenu.top, (contentRect?.height || 260) - 174));
  transformPanel.visible = true;
  closeContextMenu();
};

const startTransformPanelDrag = (event: PointerEvent) => {
  if (event.button !== 0) return;
  transformPanel.dragging = true;
  transformPanel.dragOffsetX = event.clientX - transformPanel.left;
  transformPanel.dragOffsetY = event.clientY - transformPanel.top;
};

const stopTransformPanelDrag = () => {
  transformPanel.dragging = false;
};

const alignSelectedElements = (direction: "horizontal" | "vertical") => {
  const selectedBounds = getSourceSvgBounds(selectedSvgElementIds.value);
  if (!selectedBounds) return;

  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = normalizeViewBoxText(viewBoxText.value).split(",").map(Number);
  const svgCenterX = viewBoxX + viewBoxWidth / 2;
  const svgCenterY = viewBoxY + viewBoxHeight / 2;
  const selectionCenterX = selectedBounds.left + selectedBounds.width / 2;
  const selectionCenterY = selectedBounds.top + selectedBounds.height / 2;

  updateSvgElementsByCoordinates(selectedSvgElementIds.value, {
    dx: direction === "horizontal" ? svgCenterX - selectionCenterX : 0,
    dy: direction === "vertical" ? svgCenterY - selectionCenterY : 0,
  });
  closeContextMenu();
  scheduleSelectionBoxUpdate();
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
  if (transformPanel.dragging) {
    const contentRect = previewContentRef.value?.getBoundingClientRect();
    const maxLeft = Math.max((contentRect?.width || 0) - 248, 8);
    const maxTop = Math.max((contentRect?.height || 0) - 174, 8);
    transformPanel.left = Math.min(maxLeft, Math.max(8, event.clientX - transformPanel.dragOffsetX));
    transformPanel.top = Math.min(maxTop, Math.max(8, event.clientY - transformPanel.dragOffsetY));
    return;
  }

  if (activeElementEdit.mode) {
    updateElementEdit(event);
    return;
  }

  if (!isDragging.value) return;
  updateSplit(event.clientX);
});

useEventListener(window, "pointermove", (event) => {
  if (!isPanning.value) return;
  previewOffset.x += event.clientX - lastPanPoint.x;
  previewOffset.y += event.clientY - lastPanPoint.y;
  lastPanPoint.x = event.clientX;
  lastPanPoint.y = event.clientY;
  scheduleSelectionBoxUpdate();
});

useEventListener(window, "pointerup", () => {
  stopTransformPanelDrag();
  stopElementEdit();
  stopResize();
  stopPan();
});
useEventListener(window, "blur", () => {
  stopTransformPanelDrag();
  stopElementEdit();
  stopResize();
  stopPan();
});

watch(previewSvg, scheduleSelectionBoxUpdate);
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
            <span v-if="hasSelectedElement" class="selected-element-name">
              <el-icon><EditPen /></el-icon>
              {{ selectedElementName }}
            </span>
            <span>{{ Math.round(previewScale * 100) }}%</span>
            <el-button :icon="ZoomOut" text circle size="small" @click="zoomPreview(-0.1)" />
            <el-button :icon="ZoomIn" text circle size="small" @click="zoomPreview(0.1)" />
            <el-button :icon="Refresh" text circle size="small" @click="resetPreviewTransform" />
          </div>
        </div>
        <div
          ref="previewContentRef"
          class="svg-content"
          @wheel.prevent="handlePreviewWheel"
          @pointerdown="handlePreviewPointerDown"
          @contextmenu="handlePreviewContextMenu">
          <div ref="previewCanvasRef" class="svg-canvas" :style="previewCanvasStyle">
            <div class="svg-viewbox-boundary"></div>
            <div class="svg-render-layer" v-html="previewSvg"></div>
          </div>
          <div v-if="previewError" class="svg-preview-error">
            <strong>SVG 预览失败</strong>
            <span>{{ previewError }}</span>
          </div>
          <div
            v-if="hasSelectedElement"
            class="svg-selection-box"
            :style="{
              left: `${selectionBox.left}px`,
              top: `${selectionBox.top}px`,
              width: `${selectionBox.width}px`,
              height: `${selectionBox.height}px`,
            }"></div>
          <div
            v-if="contextMenu.visible"
            class="svg-context-menu"
            :style="{ left: `${contextMenu.left}px`, top: `${contextMenu.top}px` }"
            @pointerdown.stop
            @contextmenu.prevent.stop>
            <button type="button" @click="openTransformPanel('scale')">缩放</button>
            <button type="button" @click="openTransformPanel('move')">平移</button>
            <button type="button" @click="openTransformPanel('rotate')">旋转</button>
            <button type="button" @click="alignSelectedElements('horizontal')">左右居中</button>
            <button type="button" @click="alignSelectedElements('vertical')">上下居中</button>
          </div>
          <div
            v-if="transformPanel.visible"
            class="svg-transform-panel"
            :style="{ left: `${transformPanel.left}px`, top: `${transformPanel.top}px` }"
            @pointerdown.stop
            @contextmenu.prevent.stop>
            <div class="svg-transform-panel-header" @pointerdown="startTransformPanelDrag">
              <span>
                {{
                  transformPanel.mode === "scale"
                    ? "缩放选中元素"
                    : transformPanel.mode === "move"
                      ? "平移选中元素"
                      : "旋转选中元素"
                }}
              </span>
              <button type="button" @click.stop="transformPanel.visible = false">×</button>
            </div>
            <div v-if="transformPanel.mode === 'scale'" class="svg-transform-panel-body">
              <label>
                <span>步进</span>
                <input v-model.number="transformPanel.scaleStep" min="1" max="90" step="1" type="number" />
                <em>%</em>
              </label>
              <div class="svg-transform-actions">
                <button type="button" @click="scaleSelectedElements(1 + transformPanel.scaleStep / 100)">放大</button>
                <button type="button" @click="scaleSelectedElements(Math.max(0.01, 1 - transformPanel.scaleStep / 100))">缩小</button>
              </div>
            </div>
            <div v-else-if="transformPanel.mode === 'move'" class="svg-transform-panel-body svg-move-panel-body">
              <div class="svg-move-steps">
                <label>
                  <span>X</span>
                  <input v-model.number="transformPanel.moveStepX" step="0.1" type="number" />
                </label>
                <label>
                  <span>Y</span>
                  <input v-model.number="transformPanel.moveStepY" step="0.1" type="number" />
                </label>
              </div>
              <div class="svg-move-wheel">
                <button class="is-up" type="button" @click="moveSelectedElements(0, -transformPanel.moveStepY)">上</button>
                <button class="is-left" type="button" @click="moveSelectedElements(-transformPanel.moveStepX, 0)">左</button>
                <span></span>
                <button class="is-right" type="button" @click="moveSelectedElements(transformPanel.moveStepX, 0)">右</button>
                <button class="is-down" type="button" @click="moveSelectedElements(0, transformPanel.moveStepY)">下</button>
              </div>
            </div>
            <div v-else class="svg-transform-panel-body">
              <label>
                <span>角度</span>
                <input v-model.number="transformPanel.rotateStep" min="1" max="180" step="1" type="number" />
                <em>deg</em>
              </label>
              <div class="svg-transform-actions">
                <button type="button" @click="rotateSelectedElements(-transformPanel.rotateStep)">左旋</button>
                <button type="button" @click="rotateSelectedElements(transformPanel.rotateStep)">右旋</button>
              </div>
            </div>
          </div>
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

.selected-element-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: auto;
  min-width: 0 !important;
  max-width: 112px;
  padding: 2px 7px;
  border: 1px solid rgba(71, 135, 240, 0.2);
  border-radius: 999px;
  overflow: hidden;
  color: var(--yh-brand-color) !important;
  background: rgba(71, 135, 240, 0.1);
  text-overflow: ellipsis;
  white-space: nowrap;
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

.svg-selection-box {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  border: 1px solid var(--yh-brand-color);
  background: rgba(71, 135, 240, 0.06);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.84),
    0 10px 24px rgba(15, 23, 42, 0.12);
  cursor: move;
  pointer-events: auto;
}

.svg-preview-error {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 34%;
  padding: 10px 12px;
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: 8px;
  overflow: auto;
  color: #991b1b;
  background: rgba(254, 242, 242, 0.94);
  box-shadow: 0 16px 36px rgba(127, 29, 29, 0.14);
  pointer-events: auto;

  strong {
    font-size: 13px;
    line-height: 1.2;
  }

  span {
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }
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

  .svg-render-layer {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
  }

  :deep(svg) {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  :deep([data-svg-edit-id]) {
    cursor: pointer;
  }

  :deep([data-svg-edit-id]:hover) {
    filter: drop-shadow(0 0 3px rgba(71, 135, 240, 0.45));
  }
}

.svg-context-menu {
  position: absolute;
  z-index: 5;
  min-width: 104px;
  padding: 5px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(10px);

  button {
    display: block;
    width: 100%;
    height: 28px;
    border: 0;
    border-radius: 4px;
    padding: 0 9px;
    color: var(--yh-text-color-primary);
    background: transparent;
    font-size: 12px;
    text-align: left;
    cursor: pointer;

    &:hover {
      color: var(--yh-brand-color);
      background: rgba(71, 135, 240, 0.1);
    }
  }
}

.svg-transform-panel {
  position: absolute;
  z-index: 6;
  width: 240px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(12px);
}

.svg-transform-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 8px 0 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  cursor: move;

  span {
    font-size: 12px;
    font-weight: 800;
    color: var(--yh-text-color-primary);
  }

  button {
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 4px;
    color: var(--yh-text-color-secondary);
    background: transparent;
    cursor: pointer;

    &:hover {
      color: var(--yh-brand-color);
      background: rgba(71, 135, 240, 0.1);
    }
  }
}

.svg-transform-panel-body {
  display: grid;
  gap: 10px;
  padding: 10px;

  label {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 34px;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--yh-text-color-secondary);
  }

  input {
    width: 100%;
    height: 28px;
    box-sizing: border-box;
    border: 1px solid var(--yh-border-level-1-color);
    border-radius: 5px;
    padding: 0 7px;
    color: var(--yh-text-color-primary);
    background: var(--yh-bg-color-page);
    outline: none;

    &:focus {
      border-color: rgba(71, 135, 240, 0.58);
      box-shadow: 0 0 0 3px rgba(71, 135, 240, 0.1);
    }
  }

  em {
    font-style: normal;
    color: var(--yh-text-color-secondary);
  }
}

.svg-transform-actions {
  display: grid;
  gap: 8px;

  button {
    height: 30px;
    border: 1px solid rgba(71, 135, 240, 0.18);
    border-radius: 5px;
    color: var(--yh-brand-color);
    background: rgba(71, 135, 240, 0.08);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      border-color: rgba(71, 135, 240, 0.34);
      background: rgba(71, 135, 240, 0.14);
    }
  }
}

.svg-transform-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.svg-move-panel-body {
  display: grid;
  grid-template-columns: 76px 112px;
  align-items: center;
  gap: 10px;
}

.svg-move-steps {
  display: grid;
  gap: 8px;

  label {
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 6px;
  }
}

.svg-move-wheel {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  grid-template-rows: repeat(3, 30px);
  place-content: center;
  gap: 4px;
  padding: 6px;
  border: 1px solid rgba(71, 135, 240, 0.14);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(71, 135, 240, 0.12), rgba(71, 135, 240, 0.04) 58%, transparent 59%);

  button {
    border: 1px solid rgba(71, 135, 240, 0.2);
    border-radius: 7px;
    color: var(--yh-brand-color);
    background: var(--yh-bg-color-container);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;

    &:hover {
      border-color: rgba(71, 135, 240, 0.42);
      background: rgba(71, 135, 240, 0.12);
    }
  }

  span {
    grid-column: 2;
    grid-row: 2;
    align-self: center;
    justify-self: center;
    width: 10px;
    height: 10px;
    border: 2px solid rgba(71, 135, 240, 0.28);
    border-radius: 50%;
    background: var(--yh-bg-color-container);
  }

  .is-up {
    grid-column: 2;
    grid-row: 1;
  }

  .is-left {
    grid-column: 1;
    grid-row: 2;
  }

  .is-right {
    grid-column: 3;
    grid-row: 2;
  }

  .is-down {
    grid-column: 2;
    grid-row: 3;
  }
}

.svg-viewbox-boundary {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: calc(1.5px / var(--svg-preview-scale, 1)) dashed rgba(71, 135, 240, 0.62);
  border-radius: 4px;
  background: transparent;
  box-shadow: none;
  pointer-events: none;
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
