<template>
  <div class="neon-glass-card">
    <span class="shine shine-top"></span>
    <span class="shine shine-bottom"></span>
    <span class="glow glow-top"></span>
    <span class="glow glow-bottom"></span>
    <span class="glow glow-bright glow-top"></span>
    <span class="glow glow-bright glow-bottom"></span>

    <div class="inner">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
.neon-glass-card {
  --brand-light: var(--yh-brand-color-1);
  --brand-mid: var(--yh-brand-color-5);
  --brand-dark: var(--yh-brand-color-7);

  --border: 1px;
  --border-color: var(--brand-mid);
  --radius: 10px;

  --hue1: 255;
  --hue2: 222;

  position: relative;
  border-radius: var(--radius);
  border: var(--border) solid var(--border-color);
  backdrop-filter: blur(12px);
  background-color: var(--yh-text-color-anti);
  background-color: rgba(var(--yh-text-color-anti-rgb), 0.45);
}

/* 光效 */
.neon-glass-card .shine,
.neon-glass-card .shine::before,
.neon-glass-card .shine::after {
  border-radius: inherit;
  border: 1px solid transparent;
  width: 75%;
  aspect-ratio: 1;
  display: block;
  position: absolute;
  right: -1px;
  top: -1px;
  background: conic-gradient(from -45deg, transparent 12%, var(--brand-mid), transparent 50%);
}

.neon-glass-card {
  .shine,
  .glow {
    --hue: var(--hue1);
  }

  .shine-bottom,
  .glow-bottom {
    --hue: var(--hue2);
    --conic: 135deg;
  }

  .shine,
  .shine::before,
  .shine::after {
    pointer-events: none;

    border-radius: 0;
    border-top-right-radius: inherit;
    border-bottom-left-radius: inherit;
    border: 1px solid transparent;

    width: 75%;
    height: auto;
    min-height: 0px;
    aspect-ratio: 1;
    display: block;
    position: absolute;
    right: calc(var(--border) * -1);
    top: calc(var(--border) * -1);
    left: auto;

    z-index: 1;

    --start: 12%;
    background: conic-gradient(
        from var(--conic, -45deg) at center in oklch,
        transparent var(--start, 0%),
        hsl(var(--hue), var(--sat, 80%), var(--lit, 60%)),
        transparent var(--end, 50%)
      )
      border-box;

    mask: linear-gradient(transparent), linear-gradient(black);
    mask-repeat: no-repeat;
    mask-clip: padding-box, border-box;
    mask-composite: subtract;
  }

  .shine::before,
  .shine::after {
    content: "";
    width: auto;
    inset: -2px;
    mask: none;
  }

  .shine::after {
    z-index: 2;
    --start: 17%;
    --end: 33%;
    background: conic-gradient(
      from var(--conic, -45deg) at center in oklch,
      transparent var(--start, 0%),
      hsl(var(--hue), var(--sat, 80%), var(--lit, 85%)),
      transparent var(--end, 50%)
    );
  }

  .shine-bottom {
    top: auto;
    bottom: calc(var(--border) * -1);
    left: calc(var(--border) * -1);
    right: auto;
  }

  .glow {
    /* glow is the sparse colour bleed with noise */

    pointer-events: none;

    border-top-right-radius: calc(var(--radius) * 2.5);
    border-bottom-left-radius: calc(var(--radius) * 2.5);
    border: calc(var(--radius) * 1.25) solid transparent;
    inset: calc(var(--radius) * -2);

    width: 75%;
    height: auto;
    min-height: 0px;
    aspect-ratio: 1;
    display: block;
    position: absolute;
    left: auto;
    bottom: auto;

    mask: url("./noise-base.webp");
    mask-mode: luminance;
    mask-size: 29%;

    opacity: 1;
    filter: blur(5px) saturate(1.25) brightness(1.5);
    mix-blend-mode: plus-lighter;
    z-index: 3;

    &.glow-bottom {
      inset: calc(var(--radius) * -2);
      top: auto;
      right: auto;
    }

    &::before,
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      border: inherit;
      border-radius: inherit;
      background: conic-gradient(
          from var(--conic, -45deg) at center in oklch,
          transparent var(--start, 0%),
          hsl(var(--hue), var(--sat, 95%), var(--lit, 60%)),
          transparent var(--end, 50%)
        )
        border-box;
      mask: linear-gradient(transparent), linear-gradient(black);
      mask-repeat: no-repeat;
      mask-clip: padding-box, border-box;
      mask-composite: subtract;
      filter: saturate(2) brightness(1);
    }

    &::after {
      --lit: 70%;
      --sat: 100%;
      --start: 15%;
      --end: 35%;
      border-width: calc(var(--radius) * 1.75);
      border-radius: calc(var(--radius) * 2.75);
      inset: calc(var(--radius) * -0.25);
      z-index: 4;
      opacity: 0.75;
    }
  
  }

  .glow-bright {

    --lit: 80%;
    --sat: 100%;
    --start: 13%;
    --end: 37%;

    border-width: 5px;
    border-radius: calc(var(--radius) + 2px);
    inset: -7px;
    left: auto;
    filter: blur(2px) brightness(0.66);

    &::after {
      content: none;
    }

    &.glow-bottom {
      inset: -7px;
      right: auto;
      top: auto;
    }
  }

  .inner {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }
}
</style>
