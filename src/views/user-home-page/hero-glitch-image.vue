<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";

const props = defineProps<{
  /** 插画图片地址。 */
  src: string;
  /** 插画的无障碍替代文本。 */
  alt: string;
  /** 是否等待图片进入可视区后再播放一次动画。 */
  playOnVisible?: boolean;
  /** 是否忽略系统“减少动态效果”设置，强制播放动画。 */
  forceAnimation?: boolean;
  /** 是否撑满父容器；设为 false 时保留图片自然尺寸。 */
  fullWidth?: boolean;
}>();

interface SliceState {
  y: number;
  height: number;
  x: number;
  scaleX: number;
  alpha: number;
  blur: number;
  glitchOffset: number;
  topEdge: number[];
  bottomEdge: number[];
}

const imageRef = ref<HTMLImageElement | null>(null);
let revealTimeline: gsap.core.Timeline | undefined;
let startTimer: number | undefined;
let layoutAttempts = 0;
let activeCanvas: HTMLCanvasElement | undefined;
let visibilityObserver: IntersectionObserver | undefined;

// 横向扫描切片：复制原图到 Canvas，避免与父级 Hero 动画竞争样式。
const initGlitchImageReveal = (image: HTMLImageElement) => {
  const host = image.parentElement;
  if (!host || (!props.forceAnimation && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    gsap.set(image, { autoAlpha: 1 });
    return;
  }

  const width = Math.round(host.clientWidth);
  const height = Math.round(host.clientHeight);
  if (!width || !height || !image.naturalWidth || !image.naturalHeight) {
    gsap.set(image, { autoAlpha: 1 });
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const sourceCanvas = document.createElement("canvas");
  const sourceContext = sourceCanvas.getContext("2d");
  if (!context || !sourceContext) return;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:20;pointer-events:none;will-change:opacity;";
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  sourceContext.drawImage(image, 0, 0, width, height);
  host.appendChild(canvas);
  activeCanvas = canvas;

  const count = Math.max(20, Math.min(40, Math.round(height / 16)));
  const weights = Array.from({ length: count }, () => gsap.utils.random(0.72, 1.28));
  const weightTotal = weights.reduce((total, value) => total + value, 0);
  let y = 0;
  const slices: SliceState[] = weights.map((weight, index) => {
    const sliceHeight = index === count - 1 ? height - y : Math.round((weight / weightTotal) * height);
    const slice = {
      y,
      height: sliceHeight,
      x: gsap.utils.random(-width * 0.32, width * 0.32),
      scaleX: gsap.utils.random(0.9, 1.1),
      alpha: gsap.utils.random(0.46, 0.82),
      blur: gsap.utils.random(2, 5),
      glitchOffset: gsap.utils.random(-15, 15),
      // 参差边缘让横向切片不再是规则矩形。
      topEdge: Array.from({ length: 7 }, () => gsap.utils.random(-5, 5)),
      bottomEdge: Array.from({ length: 7 }, () => gsap.utils.random(-5, 5)),
    };
    y += sliceHeight;
    return slice;
  });
  const crackLines = slices
    .filter((_, index) => index % 5 === 1 || index % 7 === 3)
    .map((slice) => ({
      y: slice.y + gsap.utils.random(-3, 3),
      points: Array.from({ length: 7 }, (_, index) => ({
        x: (width / 6) * index,
        y: gsap.utils.random(-8, 8),
      })),
    }));
  const state = { rgb: 1, glitch: 1, crack: 0, scanX: -width * 0.2, maskEnabled: 0, flash: 0 };

  const drawSlice = (slice: SliceState, channelX = 0, tint?: string) => {
    context.save();
    context.beginPath();
    context.moveTo(0, slice.y + slice.topEdge[0]);
    slice.topEdge.forEach((offset, index) => context.lineTo((width / 6) * index, slice.y + offset));
    [...slice.bottomEdge].reverse().forEach((offset, reverseIndex) => {
      const index = 6 - reverseIndex;
      context.lineTo((width / 6) * index, slice.y + slice.height + offset);
    });
    context.closePath();
    context.clip();
    context.globalAlpha = slice.alpha;
    context.filter = `blur(${slice.blur}px)`;
    context.translate(width / 2 + slice.x + channelX, 0);
    context.scale(slice.scaleX, 1);
    context.translate(-width / 2, 0);
    context.drawImage(sourceCanvas, 0, 0);
    if (tint) {
      context.globalCompositeOperation = "source-atop";
      context.fillStyle = tint;
      context.fillRect(0, slice.y - 1, width, slice.height + 2);
    }
    context.restore();
  };

  // 少量不规则能量裂纹，强化扫描经过时的科技感。
  const drawCracks = () => {
    if (!state.crack) return;
    context.save();
    context.globalAlpha = state.crack;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(105, 225, 255, .88)";
    context.lineWidth = 1.25;
    context.shadowColor = "rgba(62, 191, 255, .95)";
    context.shadowBlur = 10;
    crackLines.forEach((line) => {
      context.beginPath();
      line.points.forEach((point, index) => {
        if (index) context.lineTo(point.x, line.y + point.y);
        else context.moveTo(point.x, line.y + point.y);
      });
      context.stroke();
    });
    context.restore();
  };

  // 每帧仅重绘当前插画的 Canvas，不影响其它页面元素。
  const render = () => {
    context.clearRect(0, 0, width, height);
    slices.forEach((slice, index) => {
      const jump = index % 5 === 0 ? slice.glitchOffset * state.glitch : 0;
      drawSlice(slice, jump);
      if (state.rgb > 0.01) {
        drawSlice(slice, jump - 10 * state.rgb, `rgba(255, 48, 88, ${0.28 * state.rgb})`);
        drawSlice(slice, jump + 10 * state.rgb, `rgba(45, 116, 255, ${0.24 * state.rgb})`);
      }
    });
    drawCracks();
    if (state.maskEnabled) {
      context.save();
      context.globalCompositeOperation = "destination-in";
      const mask = context.createLinearGradient(state.scanX - 150, 0, state.scanX + 110, 0);
      mask.addColorStop(0, "rgba(255,255,255,1)");
      mask.addColorStop(0.62, "rgba(255,255,255,.96)");
      mask.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = mask;
      context.fillRect(0, 0, width, height);
      context.restore();
    }
    context.save();
    context.globalCompositeOperation = "screen";
    const light = context.createLinearGradient(state.scanX - 24, 0, state.scanX + 24, 0);
    light.addColorStop(0, "rgba(132,220,255,0)");
    light.addColorStop(0.5, "rgba(231,250,255,.72)");
    light.addColorStop(1, "rgba(132,220,255,0)");
    context.fillStyle = light;
    context.fillRect(state.scanX - 24, 0, 48, height);
    context.fillStyle = `rgba(255,255,255,${state.flash * 0.14})`;
    context.fillRect(0, 0, width, height);
    context.restore();
  };

  const timeline = gsap.timeline({
    onUpdate: render,
    onComplete: () => {
      canvas.remove();
      activeCanvas = undefined;
    },
  });
  timeline
    .addLabel("glitch", 0)
    .to(state, { flash: 0.9, crack: 1, duration: 0.06, ease: "none" }, "glitch")
    .to(state, { flash: 0, glitch: 0.22, crack: 0.58, duration: 0.19, ease: "power2.out" }, "glitch+=0.06")
    .set(state, { maskEnabled: 1 }, "glitch+=0.21")
    .to(slices, { x: 0, scaleX: 1, alpha: 1, blur: 0, duration: 1.9, ease: "power3.out", stagger: { amount: 0.48, from: "random" } }, "glitch+=0.21")
    .to(state, { rgb: 0, glitch: 0, crack: 0, duration: 0.52, ease: "power3.out" }, "glitch+=0.57")
    .to(state, { scanX: width * 1.22, duration: 2.18, ease: "power2.inOut" }, "glitch+=0.21")
    .to(canvas, { autoAlpha: 0, duration: 0.2, ease: "none" }, 2.52);
  render();
  return timeline;
};

const startReveal = () => {
  const image = imageRef.value;
  const host = image?.parentElement;
  if (!image || !host) return;
  if ((!host.clientWidth || !host.clientHeight) && layoutAttempts < 12) {
    layoutAttempts += 1;
    startTimer = window.setTimeout(startReveal, 50);
    return;
  }
  revealTimeline = initGlitchImageReveal(image);
};

onMounted(() => {
  const image = imageRef.value;
  if (!image) return;
  const queueReveal = () => { startTimer = window.setTimeout(startReveal, 160); };
  const startAfterImageLoaded = () => {
    if (!props.playOnVisible || !("IntersectionObserver" in window)) return queueReveal();
    visibilityObserver = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      visibilityObserver?.disconnect();
      queueReveal();
    }, { threshold: 0.18 });
    visibilityObserver.observe(image);
  };
  if (image.complete && image.naturalWidth) startAfterImageLoaded();
  else image.addEventListener("load", startAfterImageLoaded, { once: true });
});

onUnmounted(() => {
  if (startTimer !== undefined) window.clearTimeout(startTimer);
  visibilityObserver?.disconnect();
  revealTimeline?.kill();
  activeCanvas?.remove();
});
</script>

<template>
  <div class="hero-glitch-image" :class="{ 'hero-glitch-image--natural': fullWidth === false }">
    <img ref="imageRef" :src="src" :alt="alt" class="hero-glitch-image__source" />
  </div>
</template>

<style lang="scss">
.hero-glitch-image { position: relative; width: 100%; isolation: isolate; }
.hero-glitch-image--natural { display: inline-block; width: auto; max-width: 100%; }
.hero-glitch-image--natural .hero-glitch-image__source { width: auto; max-width: 100%; }
.hero-glitch-image__source { display: block; width: 100%; max-width: none; filter: drop-shadow(0 18px 24px rgb(15 23 42 / 8%)); }
</style>
