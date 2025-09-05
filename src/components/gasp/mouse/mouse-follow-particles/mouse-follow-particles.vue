<template>
  <div ref="particlesRef" class="particles">
    <div class="p" id="p0"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { gsap } from "gsap";

import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

const particlesRef = ref<HTMLDivElement | null>(null);
const numP = 60;

const initParticles = () => {
  if (!particlesRef.value) return;
  const base = particlesRef.value.querySelector("#p0") as HTMLElement;

  for (let i = 1; i < numP; i++) {
    const _p = base.cloneNode(false) as HTMLElement;
    _p.id = "p" + i;
    particlesRef.value.appendChild(_p);

    gsap.set(_p, {
      scale: 0 + 1.5 * Math.random(),
      opacity: 0.25 + Math.random(),
      x: window.innerWidth / 2 + (-40 + 80 * Math.random()),
      y: window.innerHeight / 2 + (-40 + 80 * Math.random()),
    });
  }
};

const move = (e: MouseEvent) => {
  for (let ii = 1; ii < numP; ii++) {
    let scaleFactor: number;

    if (ii <5) {
      // 第一个粒子最大
      scaleFactor = 1.2;
    } else {
      // 后面的粒子比第一个小，但彼此差不多，随机微调 ±0.05
      scaleFactor = 0.3 + (Math.random() - 0.3) * 0.2; // 范围 0.65 ~ 0.75
    }

    // 运动路径动画
    gsap.to(`#p${ii}`, {
      duration: 0.5,
      delay: 0.005 * ii,
      ease: "back.out(3)",
      scale: scaleFactor,
      motionPath: {
        path: [
          { x: e.clientX + 25 - 50 * Math.random(), y: e.clientY + 25 - 50 * Math.random() },
          { x: e.clientX, y: e.clientY },
        ],
        curviness: 1,
      },
    });

    // 放大瞬间
    gsap.to(`#p${ii}`, {
      duration: 0.005 * ii,
      scale: scaleFactor * 4,
    });

    // 缩小消失
    gsap.to(`#p${ii}`, {
      duration: 0.5,
      delay: 0.005 * ii,
      scale: 0,
      motionPath: {
        path: [
          { x: e.clientX + 25 - 50 * Math.random(), y: e.clientY + 25 - 50 * Math.random() },
          { x: e.clientX, y: e.clientY },
        ],
        curviness: 1,
      },
    });
  }
};

onMounted(() => {
  initParticles();
  window.addEventListener("mousemove", move);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", move);
});
</script>

<style scoped>
.particles {
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  overflow: hidden;
  pointer-events: none; /* 不阻挡鼠标事件 */
}

.p {
  position: absolute;
  top: -6px;
  left: -3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0));
}
</style>
