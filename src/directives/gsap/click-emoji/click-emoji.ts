import type { Directive } from "vue";
import gsap from "gsap";

export interface ClickEmojiOptions {
  emojis?: string[];
  count?: number;
  radius?: number;
}

const defaultEmojis = [
  "🎉", "😘", "🎊", "🤡", "🥳", "🤪", "💗",
  "❤️", "💖", "💛", "💚", "💙", "💜",    
  "👍", "👏", "🙌", "🤝", "✌️", "👌",     
  "🔥", "✨", "🌟", "💯", "🎈", "🎵" ,
    "🎈", "🎈🎈", "🎈🎉", "🎁", "🎂"    
]

function createEmoji(x: number, y: number, options: ClickEmojiOptions) {
  const dot = document.createElement("div");
  dot.textContent =
    options.emojis?.[Math.floor(Math.random() * options.emojis.length)] ??
    defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];

  Object.assign(dot.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${y}px`,
    fontSize: "24px",
    pointerEvents: "none",
    transform: "translate(0,0)",
  });

  document.body.appendChild(dot);

  const dx = (Math.random() - 0.5) * (options.radius ?? 300); // 水平偏移减少
  const delay = Math.random() * 0.2;
  const peak = -(50 + Math.random() * 50); // 飞升高度减少
  const drop = 50 + Math.random() * 50; // 落下高度

  // 模拟 CSS custom-x + custom-y
  gsap.to(dot, {
    x: dx,
    duration: 1,
    ease: "linear",
    delay,
  });

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
    transform: "translate(-50%, -60%) scale(0.4)", // 水平居中，垂直稍微靠下
    opacity: "0",
  });

  document.body.appendChild(numDiv);

  // 模拟 count-shark CSS 动画
  gsap.to(numDiv, {
    y: "-=30", // 向上漂浮
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

export const vClickEmoji: Directive<HTMLElement, ClickEmojiOptions> = {
  mounted(el, binding) {
    const handler = (ev: MouseEvent) => {
      const options = binding.value || {};
      const { clientX, clientY } = ev;
      const maxCount = options.count ?? 6;
      const emojiCount = Math.floor(Math.random() * maxCount) + 1; 
      for (let i = 0; i < emojiCount; i++) {
        createEmoji(clientX, clientY, options);
      }
      createNum(clientX, clientY);
    };
    el.addEventListener("click", handler);
    (el as any)._clickEmojiHandler = handler;
  },
  unmounted(el) {
    const handler = (el as any)._clickEmojiHandler;
    if (handler) el.removeEventListener("click", handler);
  },
};
