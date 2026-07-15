import { onMounted, onUnmounted, ref, type Ref } from "vue";
import { gsap } from "gsap";

const TYPE_SPEED = 105;

export const useHomeAnimations = (
  pageRoot: Ref<HTMLElement | null>,
  heroRoot: Ref<HTMLElement | null>,
  initialName: string,
  subtitles: string[],
) => {
  const typedWord = ref("");
  const typedSubtitle = ref("");
  const availableSubtitles = subtitles.filter(Boolean);
  let typingName = initialName;
  let titleCharacterIndex = 0;
  let subtitleCharacterIndex = 0;
  let subtitleTextIndex = 0;
  let isDeletingSubtitle = false;
  let typeTimer: ReturnType<typeof setTimeout> | undefined;
  let isMounted = false;
  let shouldPlayTyping = false;
  let animationContext: gsap.Context | undefined;
  let introTimeline: gsap.core.Timeline | undefined;
  let illustrationTimeline: gsap.core.Timeline | undefined;
  let revealObserver: IntersectionObserver | undefined;
  let introObserver: IntersectionObserver | undefined;
  let illustrationObserver: IntersectionObserver | undefined;
  let removePointerMove: (() => void) | undefined;

  const activeSubtitle = () => availableSubtitles[subtitleTextIndex] || "";

  // 首页标题打字动画：Array.from 可正确按中文等 Unicode 字符处理。
  const runTitleTypewriter = () => {
    const characters = Array.from(typingName);
    titleCharacterIndex += 1;
    typedWord.value = characters.slice(0, titleCharacterIndex).join("");

    if (titleCharacterIndex >= characters.length) {
      typeTimer = setTimeout(runSubtitleTypewriter, 140);
      return;
    }
    typeTimer = setTimeout(runTitleTypewriter, TYPE_SPEED);
  };

  // 副标题循环打字：完整显示后删除，再切换到下一条文案。
  const runSubtitleTypewriter = () => {
    const characters = Array.from(activeSubtitle());
    if (!characters.length) return;

    subtitleCharacterIndex += isDeletingSubtitle ? -1 : 1;
    typedSubtitle.value = characters.slice(0, subtitleCharacterIndex).join("");

    if (!isDeletingSubtitle && subtitleCharacterIndex >= characters.length) {
      isDeletingSubtitle = true;
      typeTimer = setTimeout(runSubtitleTypewriter, 1600);
      return;
    }
    if (isDeletingSubtitle && subtitleCharacterIndex <= 0) {
      isDeletingSubtitle = false;
      subtitleTextIndex = (subtitleTextIndex + 1) % availableSubtitles.length;
      typeTimer = setTimeout(runSubtitleTypewriter, 360);
      return;
    }
    typeTimer = setTimeout(runSubtitleTypewriter, isDeletingSubtitle ? 55 : TYPE_SPEED);
  };

  const setTypingName = (name: string) => {
    typingName = name || initialName;
    titleCharacterIndex = 0;
    subtitleCharacterIndex = 0;
    subtitleTextIndex = 0;
    isDeletingSubtitle = false;
    typedWord.value = "";
    typedSubtitle.value = "";
    if (typeTimer) clearTimeout(typeTimer);
  };

  const playTyping = () => {
    shouldPlayTyping = true;
    if (!isMounted) return;

    titleCharacterIndex = 0;
    subtitleCharacterIndex = 0;
    subtitleTextIndex = 0;
    isDeletingSubtitle = false;
    typedWord.value = "";
    typedSubtitle.value = "";
    if (typeTimer) clearTimeout(typeTimer);
    typeTimer = setTimeout(runTitleTypewriter, 160);
  };

  // 滚动进入动画：元素第一次进入可视区后固定为显示状态。
  const setupRevealObserver = () => {
    if (!pageRoot.value) return;
    if (!("IntersectionObserver" in window)) {
      pageRoot.value.querySelectorAll("[data-reveal]").forEach((element) => element.classList.add("is-visible"));
      return;
    }

    revealObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver?.unobserve(entry.target);
      }),
      { threshold: 0.14, rootMargin: "0px 0px -48px" },
    );
    pageRoot.value.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => revealObserver?.observe(element));
  };

  // 自我介绍数字故障入场：仅在区块进入可视区后执行一次。
  const setupIntroductionGlitchReveal = () => {
    const section = pageRoot.value?.querySelector<HTMLElement>("[data-glitch-reveal]");
    const content = section?.querySelector<HTMLElement>(".introduce_right");
    const title = content?.querySelector<HTMLElement>(".introduce-title");
    if (!section || !title) return;

    const showContent = () => {
      introTimeline = gsap.timeline({
        onComplete: () => gsap.set(title, { clearProps: "clipPath,filter,transform,visibility,opacity" }),
      });
      introTimeline
        .addLabel("introduction-enter", 0)
        .set(title, { autoAlpha: 1 }, "introduction-enter")
        .to(title, { clipPath: "inset(0 0% 0 0)", filter: "blur(0px)", x: 0, duration: 1.25, ease: "power3.out" }, "introduction-enter")
        .to(title, { x: 11, duration: 0.05, ease: "none" }, "introduction-enter+=0.2")
        .to(title, { x: -7, duration: 0.06, ease: "none" }, "introduction-enter+=0.27")
        .to(title, { x: 0, duration: 0.14, ease: "power2.out" }, "introduction-enter+=0.34");
    };

    if (!("IntersectionObserver" in window)) {
      gsap.set(title, { autoAlpha: 1, clearProps: "clipPath,filter,transform" });
      return;
    }

    gsap.set(title, { autoAlpha: 0, x: -12, clipPath: "inset(0 100% 0 0)", filter: "blur(7px)" });
    const rect = title.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      showContent();
      return;
    }

    introObserver = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      introObserver?.disconnect();
      showContent();
    }, { threshold: 0, rootMargin: "0px" });
    introObserver.observe(section);
  };

  // 插画单独按自身可视状态入场，不与右侧简介文字共用动画时机。
  const setupIntroductionIllustrationReveal = () => {
    const illustration = pageRoot.value?.querySelector<HTMLElement>("[data-glitch-reveal] .introduce_left");
    if (!illustration) return;

    const showIllustration = () => {
      illustrationTimeline = gsap.timeline({
        onComplete: () => gsap.set(illustration, { clearProps: "transform,visibility,opacity" }),
      });
      illustrationTimeline
        .set(illustration, { autoAlpha: 1 })
        .to(illustration, { x: 0, duration: 1.45, ease: "power3.out" });
    };

    if (!("IntersectionObserver" in window)) {
      gsap.set(illustration, { autoAlpha: 1, clearProps: "transform" });
      return;
    }

    gsap.set(illustration, { autoAlpha: 0, x: -72 });
    const rect = illustration.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      showIllustration();
      return;
    }

    illustrationObserver = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      illustrationObserver?.disconnect();
      showIllustration();
    }, { threshold: 0, rootMargin: "0px" });
    illustrationObserver.observe(illustration);
  };

  // 鼠标移动微交互：复用 quickTo，避免高频事件创建大量动画。
  const setupPointerInteraction = () => {
    const hero = heroRoot.value;
    if (!hero || !window.matchMedia("(pointer: fine)").matches) return;
    const spotlight = hero.querySelector<HTMLElement>(".hero-spotlight");
    const figure = hero.querySelector<HTMLElement>(".user-welcome-right");
    if (!spotlight || !figure) return;

    const spotlightX = gsap.quickTo(spotlight, "x", { duration: 0.5, ease: "power2.out" });
    const spotlightY = gsap.quickTo(spotlight, "y", { duration: 0.5, ease: "power2.out" });
    const figureX = gsap.quickTo(figure, "x", { duration: 0.7, ease: "power2.out" });
    const figureY = gsap.quickTo(figure, "y", { duration: 0.7, ease: "power2.out" });

    const onPointerMove = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
      const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;
      spotlightX(event.clientX - rect.left - 140);
      spotlightY(event.clientY - rect.top - 140);
      figureX(normalizedX * 10);
      figureY(normalizedY * 8);
    };
    hero.addEventListener("pointermove", onPointerMove, { passive: true });
    removePointerMove = () => hero.removeEventListener("pointermove", onPointerMove);
  };

  onMounted(() => {
    if (!pageRoot.value || !heroRoot.value) return;
    isMounted = true;
    setupRevealObserver();
    setupIntroductionGlitchReveal();
    setupIntroductionIllustrationReveal();
    animationContext = gsap.context(() => {
      gsap.timeline().from(".hero-enter", { autoAlpha: 0, y: 22, duration: 0.75, stagger: 0.1, ease: "power2.out" });
    }, heroRoot.value);
    if (shouldPlayTyping) playTyping();
    setupPointerInteraction();
  });

  onUnmounted(() => {
    if (typeTimer) clearTimeout(typeTimer);
    introTimeline?.kill();
    illustrationTimeline?.kill();
    revealObserver?.disconnect();
    introObserver?.disconnect();
    illustrationObserver?.disconnect();
    removePointerMove?.();
    animationContext?.revert();
  });

  return { playTyping, setTypingName, typedSubtitle, typedWord };
};
