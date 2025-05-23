<script setup lang="ts">
const props = defineProps({
  width: {
    type: [String, Number],
    default: 24,
  },
  color: {
    type: String,
    default: "#000",
  },
});
</script>
<template>
  <svg
    t="1747983293547"
    class="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    p-id="2460"
    :width="props.width"
    :height="props.width">
    <path
      d="M744.453 225.26H353.375c-29.953 0-54.422 26.79-54.422 59.801v508.781a21.094 21.094 0 0 0 30.48 18.88L436.38 759.46l102.832 53.05c5.484 2.848 11.812 3.164 17.508 0.844l112.324-45.035 99.984 44.719a21.473 21.473 0 0 0 20.145-1.582c6.012-3.903 9.598-10.547 9.598-17.719V285.061c0.105-32.906-24.364-59.8-54.317-59.8z m12.235 535.993l-78.47-35.016a21.2 21.2 0 0 0-16.452-0.316l-111.692 44.718-103.781-53.578a21.146 21.146 0 0 0-19.09-0.105l-85.957 42.82V285.061c0-10.336 6.434-17.613 12.234-17.613H744.56c5.8 0 12.234 7.172 12.234 17.613v476.192z"
      p-id="2461"></path>
    <path d="M428.258 379.878H669.57v42.187H428.258z m0 116.015H669.57v42.188H428.258z" p-id="2462"></path>
  </svg>
</template>

<style lang="scss" scoped>
.gb-svg-icon {
  --color: inherit;
  line-height: 1;
  justify-content: center;
  align-items: center;
  position: relative;
  fill: currentColor;
  color: var(--color);
  font-size: inherit;
}
</style>
