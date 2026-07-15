<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { gsap } from "gsap";

const props = defineProps<{
  text: string;
  loading: boolean;
  placeholder: string;
}>();

const rootRef = ref<HTMLElement | null>(null);
const placeholderRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const hasPlayed = ref(false);
const showPlaceholder = ref(true);
const lockedHeight = ref<number>();
const placeholderCharacters = computed(() => Array.from(props.placeholder).map((value) => ({
  value,
  isLineBreak: value === "\n",
})));
const contentCharacters = computed(() => Array.from(props.text).map((value) => ({
  value,
  isLineBreak: value === "\n",
})));
let animationContext: gsap.Context | undefined;

// 在 DOM 替换前锁住占位文案的高度，避免不同字数的简介切换时突跳。
watch(
  () => props.loading,
  (loading, previousLoading) => {
    if (previousLoading && !loading && rootRef.value) {
      lockedHeight.value = Math.ceil(rootRef.value.getBoundingClientRect().height);
    }
  },
);

const playTextShatter = async () => {
  if (hasPlayed.value || props.loading || !props.text.trim() || !rootRef.value) return;

  await nextTick();
  const root = rootRef.value;
  const content = contentRef.value;
  if (hasPlayed.value || props.loading || !root || !content) return;

  const chars = Array.from(content.querySelectorAll<HTMLElement>(".intro-text-shatter__char"));
  if (!chars.length) return;

  const targetHeight = Math.ceil(root.scrollHeight);
  const placeholder = placeholderRef.value;
  animationContext?.revert();
  hasPlayed.value = true;

  animationContext = gsap.context(() => {
    const timeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => {
        showPlaceholder.value = false;
        lockedHeight.value = undefined;
      },
    });

    timeline.set(chars, {
      autoAlpha: 0,
      x: () => gsap.utils.random(-18, 18),
      y: () => gsap.utils.random(-12, 12),
      rotation: () => gsap.utils.random(-14, 14),
      scale: () => gsap.utils.random(0.72, 1.16),
      filter: "blur(4px)",
    });

    if (placeholder) {
      timeline.to(placeholder, { autoAlpha: 0, duration: 1.1, ease: "sine.out" }, 0);
    }
    if (lockedHeight.value !== undefined && lockedHeight.value !== targetHeight) {
      timeline.to(root, { height: targetHeight, duration: 1.1, clearProps: "height" }, 0);
    }

    timeline.to(chars, {
      autoAlpha: 1,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      filter: "blur(0px)",
      duration: 1.3,
      stagger: { amount: 1.15, from: "random" },
      clearProps: "transform,filter,visibility,opacity",
    }, 0);
  }, root);
};

watch(
  () => [props.loading, props.text] as const,
  () => void playTextShatter(),
  { immediate: true, flush: "post" },
);

onUnmounted(() => {
  animationContext?.revert();
});
</script>

<template>
  <div
    ref="rootRef"
    class="intro-text-shatter"
    :class="{
      'intro-text-shatter--loading': loading,
      'intro-text-shatter--transitioning': !loading && showPlaceholder,
    }"
    :style="lockedHeight ? { height: `${lockedHeight}px` } : undefined"
    aria-live="polite"
  >
    <p
      v-if="showPlaceholder && placeholder.trim()"
      ref="placeholderRef"
      class="intro-text-shatter__content intro-text-shatter__placeholder"
      aria-hidden="true"
    >
      <template v-for="(character, index) in placeholderCharacters" :key="`placeholder-${character.value}-${index}`">
        <br v-if="character.isLineBreak" />
        <span
          v-else
          class="intro-text-shatter__char"
          :style="{
            '--shatter-x': `${(index * 17) % 31 - 15}px`,
            '--shatter-y': `${(index * 11) % 21 - 10}px`,
            '--shatter-rotate': `${(index * 13) % 25 - 12}deg`,
            '--shatter-delay': `${(index % 9) * -0.12}s`,
          }"
        >{{ character.value === " " ? "\u00a0" : character.value }}</span>
      </template>
    </p>

    <p v-if="!loading && text.trim()" ref="contentRef" class="intro-text-shatter__content">
      <template v-for="(character, index) in contentCharacters" :key="`content-${character.value}-${index}`">
        <br v-if="character.isLineBreak" />
        <span v-else class="intro-text-shatter__char">{{ character.value === " " ? "\u00a0" : character.value }}</span>
      </template>
    </p>
  </div>
</template>

<style lang="scss">
.intro-text-shatter {
  position: relative;
  overflow: hidden;
}

.intro-text-shatter__content {
  margin-bottom: 14px;
  color: var(--yh-text-color-secondary);
  font-size: 15px;
  line-height: 26px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.intro-text-shatter__char {
  display: inline-block;
  will-change: transform, filter, opacity;
}

.intro-text-shatter--loading .intro-text-shatter__placeholder .intro-text-shatter__char,
.intro-text-shatter--transitioning .intro-text-shatter__placeholder .intro-text-shatter__char {
  animation: intro-text-fragment 1.35s ease-in-out var(--shatter-delay) infinite alternate;
  color: color-mix(in srgb, var(--yh-text-color-secondary) 62%, transparent);
}

/* 真正内容入场时，占位文案作为上层淡出，避免不同长度文字的突兀替换。 */
.intro-text-shatter--transitioning .intro-text-shatter__placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
}

@keyframes intro-text-fragment {
  0%, 100% {
    filter: blur(2.5px);
    opacity: 0.3;
    transform: translate(var(--shatter-x), var(--shatter-y)) rotate(var(--shatter-rotate)) scale(0.88);
  }

  55% {
    filter: blur(0.6px);
    opacity: 0.68;
    transform: translate(calc(var(--shatter-x) * 0.32), calc(var(--shatter-y) * 0.32)) rotate(calc(var(--shatter-rotate) * 0.24)) scale(1.03);
  }
}
</style>
