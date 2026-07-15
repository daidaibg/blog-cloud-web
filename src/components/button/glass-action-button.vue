<script setup lang="ts">
import { computed } from "vue";

defineOptions({ name: "GlassActionButton" });

const props = withDefaults(
  defineProps<{
    theme?: "default" | "primary" | "success" | "warning" | "danger" | "info";
    loading?: boolean;
    disabled?: boolean;
    nativeType?: "button" | "submit" | "reset";
  }>(),
  { theme: "default", loading: false, disabled: false, nativeType: "button" }
);

const emit = defineEmits<{ click: [event: MouseEvent] }>();
const isDisabled = computed(() => props.disabled || props.loading);

function handleClick(event: MouseEvent) {
  if (!isDisabled.value) emit("click", event);
}
</script>

<template>
  <button
    class="glass-action-button"
    :class="`glass-action-button--${theme}`"
    :type="nativeType"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    @click="handleClick"
  >
    <span v-if="loading" class="glass-action-button__spinner" aria-hidden="true" />
    <span><slot /></span>
  </button>
</template>

<style scoped lang="scss">
.glass-action-button {
  --button-base: var(--yh-bg-color-container, #dce8f5);
  --button-start: color-mix(in srgb, #fff 78%, var(--yh-bg-color-container, #dce8f5));
  --button-end: color-mix(in srgb, #d6e2ee 84%, var(--yh-bg-color-container, #dce8f5));
  --button-highlight: color-mix(in srgb, #fff 62%, var(--button-base));
  --button-inset-shadow: color-mix(in srgb, var(--button-base) 32%, #12365fa6);
  --button-shadow: color-mix(in srgb, var(--button-base) 28%, transparent);
  --button-focus-ring: color-mix(in srgb, var(--button-base) 34%, transparent);
  --button-text: var(--yh-text-color-primary);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 102px;
  min-height: 40px;
  padding: 10px 17px;
  border: 1px solid color-mix(in srgb, #fff 70%, var(--button-end));
  border-radius: 999px;
  background: linear-gradient(145deg, var(--button-start), var(--button-end));
  box-shadow:
    inset 2px 2px 2px var(--button-highlight),
    inset -2px -2px 2px var(--button-inset-shadow),
    2px 3px 6px var(--button-shadow);
  color: var(--button-text);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  outline: none;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.34);
  transition: box-shadow 0.2s ease, filter 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.05);
    box-shadow:
      inset 4px 4px 8px var(--button-inset-shadow),
      inset -2px -2px 3px var(--button-highlight),
      1px 2px 5px var(--button-shadow);

  }

  &:active:not(:disabled) {
    box-shadow:
      inset 4px 4px 8px var(--button-inset-shadow),
      inset -2px -2px 3px var(--button-highlight),
      1px 2px 5px var(--button-shadow);
        transform: scale(0.99);
  }

  &:focus-visible {
    box-shadow:
      0 0 0 3px var(--button-focus-ring),
      inset 2px 2px 2px var(--button-highlight),
      inset -2px -2px 3px var(--button-inset-shadow),
      2px 5px 12px var(--button-shadow);
  }

  &:disabled {
    --button-start: #afc3d8;
    --button-end: #91abc7;
    --button-shadow: rgba(83, 111, 145, 0.12);

    border-color: rgba(224, 235, 245, 0.86);
    box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.46);
    color: rgba(255, 255, 255, 0.82);
    cursor: not-allowed;
  }

  &--primary,
  &--success,
  &--warning,
  &--danger,
  &--info {
    --button-base: var(--yh-brand-color, var(--el-color-primary));
    --button-start: color-mix(in srgb, #fff 24%, var(--button-base));
    --button-end: var(--button-base);
    --button-highlight: color-mix(in srgb, #fff 38%, var(--button-base));
    --button-inset-shadow: color-mix(in srgb, var(--button-base) 45%, #062451);
    --button-shadow: color-mix(in srgb, var(--button-base) 30%, transparent);
    --button-focus-ring: color-mix(in srgb, var(--button-base) 42%, transparent);
    --button-text: #fff;
    border-color: color-mix(in srgb, #fff 72%, var(--button-base));
    text-shadow: 0 1px 1px color-mix(in srgb, #103d78 42%, transparent);
  }

  &--success {
    --button-base: var(--yh-success-color, var(--el-color-success));
  }

  &--warning {
    --button-base: var(--yh-warning-color, var(--el-color-warning));
  }

  &--danger {
    --button-base: var(--yh-danger-color, var(--el-color-danger));
  }

  &--info {
    --button-base: var(--yh-info-color, var(--el-color-info));
  }

  &__spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.38);
    border-top-color: #fff;
    border-radius: 50%;
    animation: glass-action-button-spin 0.7s linear infinite;
  }
}

@keyframes glass-action-button-spin {
  to { transform: rotate(360deg); }
}
</style>
