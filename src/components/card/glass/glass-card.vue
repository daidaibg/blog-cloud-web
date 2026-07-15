<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 卡片圆角；数值会自动转换为 px。 */
    radius?: number | string;
    /** 背景毛玻璃模糊程度，单位为 px。 */
    blur?: number;
    /** 背景饱和度百分比。 */
    saturation?: number;
    /** 卡片内边距；数值会自动转换为 px。 */
    padding?: number | string;
    /** 阴影深度系数。 */
    depth?: number;
    /** 是否显示卡片边框。 */
    border?: boolean;
  }>(),
  {
    radius: 60,
    blur: 12,
    saturation: 150,
    padding: 24,
    depth: 1,
    border: true,
  },
);

const formatSize = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;

const cardStyle = computed(() => ({
  "--glass-radius": formatSize(props.radius),
  "--glass-blur": `${props.blur}px`,
  "--glass-saturation": `${props.saturation}%`,
  "--glass-padding": formatSize(props.padding),
  "--glass-depth": props.depth,
}));
</script>

<template>
  <section
    class="glass-card"
    :class="{ 'glass-card--no-border': !border }"
    :style="cardStyle"
  >
    <div class="glass-card__content"><slot /></div>
  </section>
</template>

<style scoped lang="scss">
.glass-card {
  --glass-radius: 60px;
  --glass-blur: 34px;
  --glass-saturation: 180%;
  --glass-padding: 24px;
  --glass-depth: 1;
  --glass-card-bg: rgba(226, 238, 248, 0.035);
  --glass-card-top: rgba(255, 255, 255, 0.08);
  --glass-card-middle: rgba(255, 255, 255, 0.02);
  --glass-card-bottom: rgba(255, 255, 255, 0.018);
  --glass-card-border: rgba(226, 244, 255, 0.76);
  --glass-card-shadow: rgba(13, 35, 55, 0.22);

  position: relative;
  z-index: 1;
  isolation: isolate;
  overflow: hidden;
  min-width: 0;
  padding: var(--glass-padding);
  border: 1px solid var(--glass-card-border);
  border-radius: var(--glass-radius);
  background:
    linear-gradient(145deg, var(--glass-card-top) 0%, var(--glass-card-middle) 24%, transparent 48%, var(--glass-card-bottom) 100%),
    var(--glass-card-bg);
  box-shadow:
    0 calc(30px * var(--glass-depth)) calc(72px * var(--glass-depth)) var(--glass-card-shadow),
    0 6px 18px rgba(0, 0, 0, 0.08),
    inset 1px 1px 0 rgba(255, 255, 255, 0.62),
    inset -1px -1px 0 rgba(206, 235, 255, 0.34),
    inset 0 18px 34px rgba(255, 255, 255, 0.035),
    inset 0 -24px 46px rgba(18, 32, 43, 0.06);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation)) brightness(1.03);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation)) brightness(1.03);
  transition: background 300ms ease, border-color 300ms ease, box-shadow 300ms ease, backdrop-filter 300ms ease;

  &--no-border { border-color: transparent; }
  &--no-border::before { display: none; }

  &::before {
    position: absolute;
    z-index: 2;
    inset: 0;
    padding: 1.5px;
    border-radius: inherit;
    pointer-events: none;
    background: conic-gradient(from 205deg at 50% 50%, rgba(225, 246, 255, 0.96) 0deg, rgba(121, 196, 255, 0.98) 54deg, rgba(205, 132, 255, 0.74) 108deg, rgba(255, 130, 171, 0.78) 148deg, rgba(255, 255, 255, 0.92) 198deg, rgba(201, 231, 255, 0.82) 253deg, rgba(99, 182, 255, 0.96) 312deg, rgba(225, 246, 255, 0.96) 360deg);
    content: "";
    opacity: 0.92;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
  }

  &::after {
    content: "";
    position: absolute;
    z-index: -1;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
  }

  &::after {
    background: radial-gradient(ellipse at 28% 4%, rgba(255, 255, 255, 0.25), transparent 35%), radial-gradient(ellipse at 76% 100%, rgba(255, 255, 255, 0.15), transparent 42%), linear-gradient(180deg, rgba(222, 240, 255, 0.04), rgba(255, 255, 255, 0.11));
  }

  &__content {
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }
}

:global(:root[theme-mode="dark"]) .glass-card {
  --glass-card-bg: rgba(24, 34, 42, 0.24);
  --glass-card-top: rgba(255, 255, 255, 0.11);
  --glass-card-middle: rgba(255, 255, 255, 0.07);
  --glass-card-bottom: rgba(255, 255, 255, 0.035);
  --glass-card-border: rgba(174, 215, 246, 0.5);
  --glass-card-shadow: rgba(0, 0, 0, 0.46);
  /* 深色背景下关闭 backdrop-filter，避免浏览器合成层覆盖页面交互。 */
  backdrop-filter: blur(36px) saturate(150%) brightness(0.88);
  -webkit-backdrop-filter: blur(36px) saturate(150%) brightness(0.88);
  box-shadow: 0 34px 82px var(--glass-card-shadow), 0 8px 22px rgba(0, 0, 0, 0.16), inset 1px 1px 0 rgba(255, 255, 255, 0.34), inset -1px -1px 0 rgba(123, 179, 220, 0.18), inset 0 18px 34px rgba(255, 255, 255, 0.018), inset 0 -24px 46px rgba(0, 0, 0, 0.1);
}
</style>
