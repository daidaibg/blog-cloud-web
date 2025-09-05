<script setup lang="ts">
import { ref } from "vue";
</script>

<template>
  <div class="stage">
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="layer"></div>
  </div>
</template>

<style scoped lang="scss">
.stage,
.layer {
  animation-play-state: running !important;
}

.stage {
  perspective: 9999px;
  transform-style: preserve-3d;
  width: 300px;
  height: 100px;
}

.layer {
  width: 100%;
  height: 100%;
  position: absolute;
  transform-style: preserve-3d;
  animation: logo3d-ani 5s infinite alternate ease-in-out -7.5s;
  animation-fill-mode: forwards;
  transform: rotateY(40deg) rotateX(33deg) translateZ(0);
}

.layer:after {
  font: 60px "Pacifico", "Kaushan Script", Futura, "Roboto", "Trebuchet MS", Helvetica, sans-serif;
  content: "搞bug!";
  white-space: pre;
  text-align: center;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0px;
  color: var(--yh-text-color-anti);
  letter-spacing: -2px;
  text-shadow: 4px 0 10px rgba(0, 0, 0, 0.13);
}

.layer:nth-child(1):after {
  transform: translateZ(0px);
}

.layer:nth-child(2):after {
  transform: translateZ(-1.5px);
}

.layer:nth-child(3):after {
  transform: translateZ(-3px);
}

.layer:nth-child(4):after {
  transform: translateZ(-4.5px);
}

.layer:nth-child(5):after {
  transform: translateZ(-6px);
}

.layer:nth-child(6):after {
  transform: translateZ(-7.5px);
}

.layer:nth-child(7):after {
  transform: translateZ(-9px);
}

.layer:nth-child(8):after {
  transform: translateZ(-10.5px);
}

.layer:nth-child(9):after {
  transform: translateZ(-12px);
}

.layer:nth-child(10):after {
  transform: translateZ(-13.5px);
}

.layer:nth-child(11):after {
  transform: translateZ(-15px);
}

.layer:nth-child(12):after {
  transform: translateZ(-16.5px);
}

.layer:nth-child(13):after {
  transform: translateZ(-18px);
}

.layer:nth-child(14):after {
  transform: translateZ(-19.5px);
}

.layer:nth-child(15):after {
  transform: translateZ(-21px);
}

.layer:nth-child(16):after {
  transform: translateZ(-22.5px);
}

.layer:nth-child(17):after {
  transform: translateZ(-24px);
}

.layer:nth-child(18):after {
  transform: translateZ(-25.5px);
}

.layer:nth-child(19):after {
  transform: translateZ(-27px);
}

.layer:nth-child(20):after {
  transform: translateZ(-28.5px);
}

.layer:nth-child(n + 10):after {
  -webkit-text-stroke: 3px rgba(0, 0, 0, 0.25);
}

.layer:nth-child(n + 11):after {
  -webkit-text-stroke: 15px var(--yh-brand-color-6);
  text-shadow: 6px 0 6px var(--yh-brand-color-9), 5px 5px 5px var(--yh-brand-color-10), 0 6px 6px var(--yh-brand-color-9);
}

.layer:nth-child(n + 12):after {
  -webkit-text-stroke: 15px var(--yh-brand-color);//0077ea
}

.layer:last-child:after {
  -webkit-text-stroke: 17px rgba(0, 0, 0, 0.1);
}

.layer:first-child:after {
  color: #fff;
  text-shadow: none;
}

@keyframes logo3d-ani {
  100% {
    transform: rotateY(-40deg) rotateX(-50deg);
  }
}
</style>
