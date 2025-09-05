import type { Directive } from "vue";
import gsap from "gsap";
import confetti from "canvas-confetti";

export interface ClickEmojiOptions {
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

function createNum(x: number, y: number) {
  const current = document.querySelector(".custom-num") as HTMLDivElement | null;
  let num = 1;

  if (current) {
    num = parseInt(current.getAttribute("num") || "0") + 1;
    current.remove();
  }

  const numDiv = document.createElement("div");
  numDiv.className = "custom-num";
  numDiv.setAttribute("num", num.toString());
  numDiv.textContent = `+${num}`;

  Object.assign(numDiv.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${y}px`,
    fontSize: "28px",
    fontWeight: "bold",
    color: "#fff",
    textShadow: "2px 2px 0 red",
    pointerEvents: "none",
    transform: "translate(-50%, -60%) scale(0.4)",
    opacity: "0",
  });

  document.body.appendChild(numDiv);

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
    const handler = (ev: MouseEvent) => {
      const options = binding.value || {};
      const x = ev.pageX;
      const y = ev.pageY;

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
      createNum(x, y);
    };
    el.addEventListener("click", handler);
    (el as any)._clickEmojiHandler = handler;
  },
  unmounted(el) {
    const handler = (el as any)._clickEmojiHandler;
    if (handler) el.removeEventListener("click", handler);
  },
};
