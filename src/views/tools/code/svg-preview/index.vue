<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Brush, CopyDocument, Delete, EditPen, Refresh, ZoomIn, ZoomOut } from "@element-plus/icons-vue";
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
const previewRatio = ref(clampSplit(Number(readLocal(storageKeys.split, "48")) || 48));
const isDragging = ref(false);
const isPanning = ref(false);
const previewScale = ref(1);
const previewOffset = reactive({ x: 0, y: 0 });
const lastPanPoint = reactive({ x: 0, y: 0 });
const selectedSvgElementId = ref("");
const selectedElementName = ref("");
const selectionBox = reactive({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  visible: false,
});
const activeElementEdit = reactive<{
  mode: "" | "move" | "scale" | "rotate";
  elementId: string;
  startPoint: { x: number; y: number };
  centerPoint: { x: number; y: number };
  terminalStartPoint: { x: number; y: number };
  startDistance: number;
  startAngle: number;
  startMatrix: DOMMatrix | null;
  startContent: string;
}>({
  mode: "",
  elementId: "",
  startPoint: { x: 0, y: 0 },
  centerPoint: { x: 0, y: 0 },
  terminalStartPoint: { x: 0, y: 0 },
  startDistance: 1,
  startAngle: 0,
  startMatrix: null,
  startContent: "",
});

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
const hasSelectedElement = computed(() => Boolean(selectedSvgElementId.value && selectionBox.visible));
const isSelectedTerminal = computed(() => selectedSvgElementId.value.startsWith("terminal:"));

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

const getSelectedPreviewElement = () => {
  if (!selectedSvgElementId.value) return null;
  return (
    previewCanvasRef.value?.querySelector<SVGGraphicsElement>(`[data-svg-edit-id="${selectedSvgElementId.value}"]`) ||
    null
  );
};

const updateSelectionBox = () => {
  const contentRect = previewContentRef.value?.getBoundingClientRect();
  const selectedElement = getSelectedPreviewElement();
  if (!contentRect || !selectedElement) {
    selectionBox.visible = false;
    return;
  }

  try {
    const box = selectedElement.getBBox();
    const matrix = selectedElement.getScreenCTM();
    if (!matrix) {
      selectionBox.visible = false;
      return;
    }

    const padding = 0.5;
    const corners = [
      new DOMPoint(box.x - padding, box.y - padding),
      new DOMPoint(box.x + box.width + padding, box.y - padding),
      new DOMPoint(box.x + box.width + padding, box.y + box.height + padding),
      new DOMPoint(box.x - padding, box.y + box.height + padding),
    ].map((point) => point.matrixTransform(matrix));
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
    const rect = selectedElement.getBoundingClientRect();
    selectionBox.left = rect.left - contentRect.left;
    selectionBox.top = rect.top - contentRect.top;
    selectionBox.width = Math.max(rect.width, 1);
    selectionBox.height = Math.max(rect.height, 1);
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

const getElementCenterPoint = (element: SVGGraphicsElement) => {
  const box = element.getBBox();
  const matrix = element.getCTM();
  const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2);
  const point = matrix ? center.matrixTransform(matrix) : center;
  return {
    x: point.x,
    y: point.y,
  };
};

const formatSvgNumber = (value: number) => String(Number(value.toFixed(4)));

const setXmlAttribute = (attrs: string, name: string, value: string) => {
  const attrPattern = new RegExp(`(\\s${name}\\s*=\\s*)(["'])(.*?)\\2`, "i");
  if (attrPattern.test(attrs)) {
    return attrs.replace(attrPattern, `$1$2${value}$2`);
  }

  return `${attrs.trimEnd()} ${name}="${value}"`;
};

const updateTerminalPosition = (terminalId: string, x: number, y: number, source = editorOption.editValue) => {
  const terminalIndex = Number(terminalId.replace("terminal:", ""));
  if (!Number.isFinite(terminalIndex)) return;

  let currentIndex = -1;
  const terminalPattern = /<TerminalPosition\b([^>]*)\/>|<TerminalPosition\b([^>]*)>\s*<\/TerminalPosition>/gi;
  const nextContent = source.replace(terminalPattern, (full, selfClosingAttrs = "", pairedAttrs = "") => {
    const attrs = parseTagAttributes(selfClosingAttrs || pairedAttrs);
    if (!Number.isFinite(Number(attrs.x)) || !Number.isFinite(Number(attrs.y))) return full;

    currentIndex += 1;
    if (currentIndex !== terminalIndex) return full;

    const nextAttrs = setXmlAttribute(
      setXmlAttribute(selfClosingAttrs || pairedAttrs, "x", formatSvgNumber(x)),
      "y",
      formatSvgNumber(y),
    );
    return selfClosingAttrs ? `<TerminalPosition${nextAttrs}/>` : `<TerminalPosition${nextAttrs}></TerminalPosition>`;
  });

  editorOption.editValue = nextContent;
};

const translatePathData = (value: string, dx: number, dy: number) => {
  let coordinateIndex = 0;
  return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (match) => {
    const nextValue = Number(match) + (coordinateIndex % 2 === 0 ? dx : dy);
    coordinateIndex += 1;
    return formatSvgNumber(nextValue);
  });
};

const translatePoints = (value: string, dx: number, dy: number) => {
  let coordinateIndex = 0;
  return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (match) => {
    const nextValue = Number(match) + (coordinateIndex % 2 === 0 ? dx : dy);
    coordinateIndex += 1;
    return formatSvgNumber(nextValue);
  });
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

const updateSvgElementByCoordinates = (
  elementId: string,
  change: { dx?: number; dy?: number; scale?: number; center?: { x: number; y: number } },
  source = editorOption.editValue,
) => {
  if (!elementId.startsWith("node:")) return;

  const rawContent = removeXmlns(getEditorContent(source));
  const doc = new DOMParser().parseFromString(`<svg>${rawContent}</svg>`, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return;

  const target = Array.from(svg.querySelectorAll(editableSelector))[Number(elementId.replace("node:", ""))];
  if (!target) return;

  const tagName = target.tagName.toLowerCase();
  const dx = change.dx || 0;
  const dy = change.dy || 0;
  const scale = change.scale || 1;
  const center = change.center || { x: 0, y: 0 };
  const scaleNumberAttr = (name: string) => {
    const current = Number(target.getAttribute(name) || 0);
    target.setAttribute(name, formatSvgNumber(center.x + (current - center.x) * scale));
  };
  const scaleVerticalNumberAttr = (name: string) => {
    const current = Number(target.getAttribute(name) || 0);
    target.setAttribute(name, formatSvgNumber(center.y + (current - center.y) * scale));
  };
  const moveTarget = (node: Element) => {
    const nodeTagName = node.tagName.toLowerCase();
    const addAttr = (name: string, delta: number) => {
      const current = Number(node.getAttribute(name) || 0);
      node.setAttribute(name, formatSvgNumber(current + delta));
    };

    if (["rect", "image", "text", "use"].includes(nodeTagName)) {
      addAttr("x", dx);
      addAttr("y", dy);
    } else if (["circle", "ellipse"].includes(nodeTagName)) {
      addAttr("cx", dx);
      addAttr("cy", dy);
    } else if (nodeTagName === "line") {
      addAttr("x1", dx);
      addAttr("y1", dy);
      addAttr("x2", dx);
      addAttr("y2", dy);
    } else if (["polyline", "polygon"].includes(nodeTagName)) {
      node.setAttribute("points", translatePoints(node.getAttribute("points") || "", dx, dy));
    } else if (nodeTagName === "path") {
      node.setAttribute("d", translatePathData(node.getAttribute("d") || "", dx, dy));
    } else if (nodeTagName === "g") {
      Array.from(node.querySelectorAll(editableSelector)).forEach(moveTarget);
    }
  };

  if (activeElementEdit.mode === "move") {
    moveTarget(target);
  } else if (activeElementEdit.mode === "scale" && ["rect", "image", "use"].includes(tagName)) {
    scaleNumberAttr("x");
    scaleVerticalNumberAttr("y");
    target.setAttribute("width", formatSvgNumber(Number(target.getAttribute("width") || 0) * scale));
    target.setAttribute("height", formatSvgNumber(Number(target.getAttribute("height") || 0) * scale));
  } else if (activeElementEdit.mode === "scale" && tagName === "circle") {
    scaleNumberAttr("cx");
    scaleVerticalNumberAttr("cy");
    target.setAttribute("r", formatSvgNumber(Number(target.getAttribute("r") || 0) * scale));
  } else if (activeElementEdit.mode === "scale" && tagName === "ellipse") {
    scaleNumberAttr("cx");
    scaleVerticalNumberAttr("cy");
    target.setAttribute("rx", formatSvgNumber(Number(target.getAttribute("rx") || 0) * scale));
    target.setAttribute("ry", formatSvgNumber(Number(target.getAttribute("ry") || 0) * scale));
  } else if (activeElementEdit.mode === "scale" && tagName === "line") {
    scaleNumberAttr("x1");
    scaleVerticalNumberAttr("y1");
    scaleNumberAttr("x2");
    scaleVerticalNumberAttr("y2");
  } else if (activeElementEdit.mode === "scale" && ["polyline", "polygon"].includes(tagName)) {
    target.setAttribute(
      "points",
      transformCoordinatePairs(target.getAttribute("points") || "", ({ x, y }) => ({
        x: center.x + (x - center.x) * scale,
        y: center.y + (y - center.y) * scale,
      })),
    );
  } else if (activeElementEdit.mode === "scale" && tagName === "path") {
    target.setAttribute(
      "d",
      transformCoordinatePairs(target.getAttribute("d") || "", ({ x, y }) => ({
        x: center.x + (x - center.x) * scale,
        y: center.y + (y - center.y) * scale,
      })),
    );
  }

  editorOption.editValue = formatXml(
    Array.from(svg.childNodes)
      .map((node) => new XMLSerializer().serializeToString(node))
      .join("\n")
      .trim(),
  );
};

const startElementEdit = (mode: "move" | "scale" | "rotate", event: PointerEvent, element: SVGGraphicsElement) => {
  const point = getSvgPoint(element, event.clientX, event.clientY);
  if (!point) return;

  const centerPoint = getElementCenterPoint(element);
  activeElementEdit.mode = mode;
  activeElementEdit.elementId = element.dataset.svgEditId || "";
  activeElementEdit.startPoint = point;
  activeElementEdit.centerPoint = centerPoint;
  activeElementEdit.terminalStartPoint = {
    x: Number(element.getAttribute("cx")) || centerPoint.x,
    y: Number(element.getAttribute("cy")) || centerPoint.y,
  };
  activeElementEdit.startDistance = Math.max(Math.hypot(point.x - centerPoint.x, point.y - centerPoint.y), 0.1);
  activeElementEdit.startAngle = Math.atan2(point.y - centerPoint.y, point.x - centerPoint.x);
  activeElementEdit.startMatrix = new DOMMatrix();
  activeElementEdit.startContent = editorOption.editValue;
};

const selectElement = (element: SVGGraphicsElement) => {
  selectedSvgElementId.value = element.dataset.svgEditId || "";
  selectedElementName.value = element.dataset.svgEditKind || element.tagName.toLowerCase();
  updateSelectionBox();
};

const stopElementEdit = () => {
  activeElementEdit.mode = "";
  activeElementEdit.elementId = "";
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
  selectedSvgElementId.value = "";
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

  const handle = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-svg-edit-handle]") : null;
  if (handle) {
    const selectedElement = getSelectedPreviewElement();
    if (!selectedElement) return;
    event.preventDefault();
    event.stopPropagation();
    startElementEdit(handle.dataset.svgEditHandle as "scale" | "rotate", event, selectedElement);
    return;
  }

  const editableTarget = getEditableTarget(event);
  if (editableTarget) {
    event.preventDefault();
    event.stopPropagation();
    selectElement(editableTarget);
    startElementEdit("move", event, editableTarget);
    return;
  }

  startPan(event);
};

const updateElementEdit = (event: PointerEvent) => {
  const selectedElement = getSelectedPreviewElement();
  if (!selectedElement || !activeElementEdit.startMatrix) return;

  const point = getSvgPoint(selectedElement, event.clientX, event.clientY);
  if (!point) return;

  if (activeElementEdit.elementId.startsWith("terminal:")) {
    if (activeElementEdit.mode !== "move") return;

    updateTerminalPosition(
      activeElementEdit.elementId,
      activeElementEdit.terminalStartPoint.x + point.x - activeElementEdit.startPoint.x,
      activeElementEdit.terminalStartPoint.y + point.y - activeElementEdit.startPoint.y,
      activeElementEdit.startContent,
    );
    scheduleSelectionBoxUpdate();
    return;
  }

  if (activeElementEdit.mode === "move") {
    updateSvgElementByCoordinates(
      activeElementEdit.elementId,
      {
        dx: point.x - activeElementEdit.startPoint.x,
        dy: point.y - activeElementEdit.startPoint.y,
      },
      activeElementEdit.startContent,
    );
    scheduleSelectionBoxUpdate();
    return;
  }

  if (activeElementEdit.mode === "scale") {
    const distance = Math.max(
      Math.hypot(point.x - activeElementEdit.centerPoint.x, point.y - activeElementEdit.centerPoint.y),
      0.1,
    );
    updateSvgElementByCoordinates(
      activeElementEdit.elementId,
      {
        scale: Math.max(distance / activeElementEdit.startDistance, 0.05),
        center: activeElementEdit.centerPoint,
      },
      activeElementEdit.startContent,
    );
    scheduleSelectionBoxUpdate();
    return;
  }

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
  stopElementEdit();
  stopResize();
  stopPan();
});
useEventListener(window, "blur", () => {
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
        <div ref="previewContentRef" class="svg-content" @wheel.prevent="handlePreviewWheel" @pointerdown="handlePreviewPointerDown">
          <div ref="previewCanvasRef" class="svg-canvas" :style="previewCanvasStyle" v-html="previewSvg"></div>
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
            }">
            <template v-if="!isSelectedTerminal">
              <span class="svg-selection-handle scale-handle" data-svg-edit-handle="scale"></span>
            </template>
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
  pointer-events: none;
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

.svg-selection-handle {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--yh-brand-color);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
  pointer-events: auto;
}

.scale-handle {
  right: -6px;
  bottom: -6px;
  cursor: nwse-resize;
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

  :deep([data-svg-edit-id]) {
    cursor: move;
  }

  :deep([data-svg-edit-id]:hover) {
    filter: drop-shadow(0 0 3px rgba(71, 135, 240, 0.45));
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
