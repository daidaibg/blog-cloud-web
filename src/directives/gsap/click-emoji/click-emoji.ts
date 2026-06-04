import type { Directive } from "vue";
import gsap from "gsap";
import confetti from "canvas-confetti";

export interface ClickEmojiOptions {
  type?: "like" | "cancel";
  emojis?: string[];
  count?: number;
  radius?: number;
  confettiChance?: number; // 触发礼花桶的概率，0~1，默认0.3
}

// 你的默认 emojis
const defaultEmojis = [
  "🎉",
  "😘",
  "🎊",
  "🤡",
  "🥳",
  "🤪",
  "💗",
  "❤️",
  "💖",
  "💛",
  "👍",
  "👏",
  "🙌",
  "🤝",
  "✌️",
  "👌",
  "🔥",
  "✨",
  "🌟",
  "💯",
  "🎈",
  "🎈🎈",
  "🎈🎉",
  "🎁",
  "🎂",
];

function createEmoji(x: number, y: number, options: ClickEmojiOptions) {
  const dot = document.createElement("div");
  dot.textContent =
    options.emojis?.[Math.floor(Math.random() * options.emojis.length)] ??
    defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];

  const offsetX = (Math.random() - 0.5) * 8;
  const offsetY = 6;

  Object.assign(dot.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${y}px`,
    fontSize: "24px",
    pointerEvents: "none",
    transform: `translate(calc(-50% + ${offsetX}px), calc(-50% - ${offsetY}px))`,
  });

  document.body.appendChild(dot);

  const dx = (Math.random() - 0.5) * (options.radius ?? 300);
  const delay = Math.random() * 0.2;
  const peak = -(50 + Math.random() * 50);
  const drop = 50 + Math.random() * 50;

  gsap.to(dot, { x: dx, duration: 1, ease: "linear", delay });
  gsap.to(dot, {
    y: peak,
    rotation: 180,
    opacity: 1,
    duration: 0.4,
    ease: "cubic-bezier(0.56, -1.35, 0.85, 0.36)",
    delay,
    onComplete: () => {
      gsap.to(dot, {
        y: drop,
        rotation: 360,
        opacity: 0,
        duration: 0.6,
        ease: "power2.in",
        onComplete: () => dot.remove(),
      });
    },
  });
}

function createSadEmojiBurst(x: number, y: number) {
  const emojis = ["😢", "😭", "😥", "😿", "💀", "☠️", "🖤", "🩶", "🥀", "🌑", "🕳️"];
  const count = Math.floor(randomInRange(6, 13));

  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    Object.assign(dot.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      fontSize: "18px",
      pointerEvents: "none",
      transform: "translate(-50%, -50%) scale(0.4)",
      opacity: "0",
    });

    document.body.appendChild(dot);

    const delay = randomInRange(0, 0.12);
    const direction = randomInRange(0, Math.PI * 2);
    const distance = randomInRange(18, 52);
    const burstX = Math.cos(direction) * distance;
    const burstY = Math.sin(direction) * randomInRange(8, 22);
    const followDistance = randomInRange(46, 96);
    const driftX = burstX + Math.cos(direction) * followDistance;
    const dropY = burstY + Math.sin(direction) * followDistance + randomInRange(130, 210);
    const burstDuration = randomInRange(0.08, 0.14);
    const dropDuration = randomInRange(0.5, 0.72);

    gsap
      .timeline({
        delay,
        onComplete: () => dot.remove(),
      })
      .to(dot, {
        opacity: 1,
        scale: randomInRange(0.8, 1.15),
        duration: 0,
        ease: "power2.out",
      })
      .to(
        dot,
        {
          x: burstX,
          y: burstY,
          rotation: randomInRange(-35, 35),
          duration: burstDuration,
          ease: "power2.out",
        },
        "<"
      )
      .to(dot, {
        x: driftX,
        duration: dropDuration,
        ease: "sine.out",
      })
      .to(
        dot,
        {
          y: dropY,
          rotation: randomInRange(-100, 100),
          scale: randomInRange(0.35, 0.65),
          opacity: 0,
          duration: dropDuration,
          ease: "power3.in",
        },
        "<"
      );
  }
}

function createNum(x: number, y: number, options: ClickEmojiOptions = {}) {
  const isCancel = options.type === "cancel";
  const current = document.querySelector(".custom-num") as HTMLDivElement | null;
  let num = 1;

  if (!isCancel && current) {
    num = parseInt(current.getAttribute("num") || "0") + 1;
    current.remove();
  }

  const numDiv = document.createElement("div");
  numDiv.className = "custom-num";
  numDiv.setAttribute("num", num.toString());
  numDiv.textContent = isCancel ? "😢" : `+${num}`;

  Object.assign(numDiv.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${y}px`,
    fontSize: isCancel ? "30px" : "28px",
    fontWeight: "bold",
    color: isCancel ? "#333" : "#fff",
    textShadow: isCancel ? "1px 1px 0 rgba(0, 0, 0, 0.25)" : "2px 2px 0 red",
    pointerEvents: "none",
    transform: "translate(-50%, -60%) scale(0.4)",
    transformOrigin: "50% 80%",
    opacity: "0",
  });

  document.body.appendChild(numDiv);

  if (isCancel) {
    gsap
      .timeline({
        onComplete: () => numDiv.remove(),
      })
      .to(numDiv, {
        y: "-=8",
        scale: 1.15,
        opacity: 1,
        duration: 0.18,
        ease: "back.out(2)",
      })
      .to(numDiv, {
        x: "-=10",
        rotation: -12,
        duration: 0.12,
        ease: "sine.inOut",
      })
      .to(numDiv, {
        x: "+=20",
        rotation: 12,
        duration: 0.12,
        ease: "sine.inOut",
        repeat: 2,
        yoyo: true,
      })
      .to(numDiv, {
        x: "-=10",
        rotation: 0,
        scale: 1.35,
        opacity: 0,
        duration: 0.16,
        ease: "power2.out",
        onStart: () => createSadEmojiBurst(x, y - 8),
      });
    return;
  }

  gsap.to(numDiv, {
    y: "-=30",
    scale: 1,
    opacity: 1,
    duration: 0.3,
    ease: "back.out(2)",
    onComplete: () => {
      gsap.to(numDiv, {
        y: "-=50",
        scale: 1,
        opacity: 0,
        duration: 0.7,
        ease: "power1.in",
        onComplete: () => numDiv.remove(),
      });
    },
  });
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function createConfettiBucket(x: number, y: number) {
  // 创建 canvas（只创建一次）
  let canvas = document.getElementById("confetti-canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999";

    document.body.appendChild(canvas);
  }

  const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });

  // 礼花桶：随机角度、散布和粒子数
  myConfetti({
    angle: randomInRange(55, 125),
    spread: randomInRange(50, 70),
    particleCount: randomInRange(50, 100),
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    colors: ["#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"],
  });

  // 爆炸延迟效果
  myConfetti({
    angle: randomInRange(55, 125),
    spread: randomInRange(50, 70),
    particleCount: randomInRange(100, 200),
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    colors: ["#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"],
  });
}

export const vClickEmoji: Directive<HTMLElement, ClickEmojiOptions> = {
  mounted(el, binding) {
    (el as any)._clickEmojiOptions = binding.value || {};
    const handler = (ev: MouseEvent) => {
      const options = (el as any)._clickEmojiOptions || {};
      const x = ev.pageX;
      const y = ev.pageY;

      if (options.type === "cancel") {
        createNum(x, y, options);
        return;
      }

      // 随机选择触发原 emoji 或者礼花桶
      if (Math.random() < (options.confettiChance ?? 0.5)) {
        createConfettiBucket(ev.clientX, ev.clientY);
      } else {
        const maxCount = options.count ?? 6;
        const emojiCount = Math.floor(Math.random() * maxCount) + 1;
        for (let i = 0; i < emojiCount; i++) {
          createEmoji(x, y, options);
        }
      }
      createNum(x, y, options);
    };
    el.addEventListener("click", handler);
    (el as any)._clickEmojiHandler = handler;
  },
  updated(el, binding) {
    (el as any)._clickEmojiOptions = binding.value || {};
  },
  unmounted(el) {
    const handler = (el as any)._clickEmojiHandler;
    if (handler) el.removeEventListener("click", handler);
  },
};
