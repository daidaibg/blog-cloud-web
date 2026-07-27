<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getUserBlogList } from "@/api/modules/manage";
import { getUserProfile } from "@/api/user";
import { Theme } from "@/components/header/theme/index";
import { Logo as HeaderLogo } from "@/components/header/logo";
import LogoSvg from "@/components/logo/logo-svg.vue";
import { getTimeInterval } from "@/utils/time";
import heroIllustrationUrl from "@/assets/img/user-home-page/home-right.png";
import { heroParticles, subtitleTexts } from "./home-config";
import type { ArticleList, BlogData } from "./type";
import { useHomeAnimations } from "./use-home-animations";
import HeroGlitchImage from "./hero-glitch-image.vue";
import IntroTextShatter from "./intro-text-shatter.vue";

interface Props {
  staticMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  staticMode: false,
});

const pageRoot = ref<HTMLElement | null>(null);
const heroRoot = ref<HTMLElement | null>(null);
const userSummary = ref("");
const userSummaryLoading = ref(true);
const staticUserSummary = `白天用代码解决问题，晚上在日志里寻找答案。
我喜欢把复杂需求拆成清晰逻辑，也享受让想法真正运行起来的过程。
遇到 Bug 不慌，先定位、再调试；解决不了，就换个思路重新开始。
人生也像一个长期维护的项目，允许报错，接受回滚，但始终保持学习、持续迭代，努力成为一个有技术、有想法，也有温度的开发者。`;
const defaultName = props.staticMode ? "gaobug" : "搞bug";
const defaultUserSummary = props.staticMode
  ? staticUserSummary
  : `像阳光一样的人，像阳光一样的事，像阳光一样的爱，像阳光一样的慈悲，世界上遍地都是。

梦想似乎是遥远的，但是只要通过自己的努力，就能一步步拉近之间的距离。当距离越来越短时，它就不再是梦，而成为了触手可及的想法。无论如何，不要停下走向梦想的脚步。`;
const { playTyping, setTypingName, typedSubtitle, typedWord } = useHomeAnimations(
  pageRoot,
  heroRoot,
  defaultName,
  subtitleTexts,
);

const blogData = reactive<BlogData>({
  list: [],
  current: 1,
  size: 12,
  total: 0,
  tabActive: 1,
});

// 保留原有的随机切换效果，使用本地实现避免依赖间接安装的 lodash。
const shuffleArticles = (articles: ArticleList[]) => {
  const result = [...articles];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
};

const selectBlogTab = (tabActive: number) => {
  blogData.tabActive = tabActive;
  blogData.list = shuffleArticles(blogData.list);
};

// 获取自己的博客列表
const getBlog = async () => {
  blogData.list = [];
  const params = {
    current: blogData.current,
    size: blogData.size,
    publish: 1,
  };

  try {
    const res: any = await getUserBlogList(params);
    if (res.code === 200) {
      blogData.list = res.data.records;
      blogData.total = res.data.total;
      return;
    }
    ElMessage.error({ message: res.msg, plain: true });
  } catch {
    ElMessage.error({ message: "文章加载失败，请稍后重试", plain: true });
  }
};

// 获取个人资料：首页标题和介绍文案都以 /platform/user/profile 的数据为准。
const getHomeUserInfo = async () => {
  if (props.staticMode) {
    userSummary.value = staticUserSummary;
    userSummaryLoading.value = false;
    playTyping();
    return;
  }

  try {
    const res = await getUserProfile();
    if (res.code === 200) {
      const name = res.data?.nickName || res.data?.username;
      if (name) setTypingName(name);
      userSummary.value = res.data?.summary?.trim() || defaultUserSummary;
    }
  } catch {
    // 未登录或接口异常时继续显示默认名称，不影响主页访问。
  } finally {
    // 接口失败或简介为空时，在请求结束后再展示默认文案。
    userSummary.value ||= defaultUserSummary;
    userSummaryLoading.value = false;
    // 用户名确认后，按“名称 → 副标题”的顺序仅执行一次打字动画。
    playTyping();
  }
};

if (!props.staticMode) getBlog();
getHomeUserInfo();
</script>

<template>
  <main ref="pageRoot" class="user-home-page overflow-x-hidden">
    <header class="home-toolbar max-w-screen-lg m-auto flex justify-between items-center h-12 md:h-20">
      <HeaderLogo />
      <Theme />
    </header>

    <!-- 欢迎语 简介 -->
    <section ref="heroRoot" class="user-welcome-box">
      <!-- 轻量粒子背景 -->
      <div class="hero-particles" aria-hidden="true">
        <span
          v-for="(particle, index) in heroParticles"
          :key="index"
          class="hero-particle"
          :style="{
            '--particle-left': `${particle.left}%`,
            '--particle-top': `${particle.top}%`,
            '--particle-size': `${particle.size}px`,
            '--particle-duration': `${particle.duration}s`,
            '--particle-delay': `${particle.delay}s`,
          }"
        ></span>
      </div>
      <div class="hero-spotlight" aria-hidden="true"></div>

      <div class="user-welcome-content-bg_name absolute font-black text-4xl md:text-6xl">
        搞bug
      </div>

      <div class="user-welcome md:flex max-w-screen-lg m-auto relative">
        <div class="user-welcome-content px-4 w-auto md:w-7/12">
          <h3 class="hero-enter user-welcome-content_title uppercase font-black text-2xl pt-4 md:text-5xl">
            Hell0
          </h3>
          <h1 class="hero-enter user-welcome-content_name font-black text-3xl mb-4 md:text-7xl md:mb-7">
            <span>I AM&nbsp;</span>
            <span class="typing-word">{{ typedWord }}</span>
          </h1>
          <h5 class="hero-enter user-welcome-content_summary font-black text-xl md:text-2xl">
            {{ typedSubtitle }}
          </h5>
          <div class="hero-enter welcome-action flex items-center mt-4 md:mt-8">
            <button v-if="!props.staticMode" type="button" class="user-button primary">关注</button>
          </div>
        </div>
        <div class="hero-enter user-welcome-right w-5/12 px-4">
          <HeroGlitchImage
            :src="heroIllustrationUrl"
            alt="正在编程的程序员插画"
            :force-animation="true"
          />
        </div>
      </div>
    </section>

    <!-- 介绍 -->
    <section class="user-home-introduce max-w-screen-lg m-auto flex" data-glitch-reveal>
      <div class="introduce_left w-5/12 min-hidden">
        <img src="@/assets/img/user-home-page/about-us.png" alt="关于我的程序员插画" />
      </div>
      <div class="introduce_right">
        <h2 class="introduce-title title_2">简单介绍下关于我自己</h2>
        <IntroTextShatter
          :loading="userSummaryLoading"
          :placeholder="defaultUserSummary"
          :text="userSummary"
        />
      </div>
    </section>

    <!-- 别人的评价 -->
    <section class="others-comments max-w-screen-lg m-auto" data-reveal>
      <h2 class="others-comments-title title_2">{{ props.staticMode ? "个人评价" : "别人评价" }}</h2>
      <p class="others-comments-text">
        Is give may shall likeness made yielding spirit a itself togeth created after sea is in beast beginning signs
        open god you're gathering ithe
      </p>
    </section>

    <!-- 发表文章 / 项目卡片 hover 效果 -->
    <section v-if="!props.staticMode" class="user-article max-w-screen-lg m-auto" data-reveal>
      <div class="section-heading">
        <span class="section-kicker">WRITING</span>
        <h2 class="user-article-title title_2">个人文章</h2>
      </div>
      <ul class="user-article-tab flex" aria-label="文章筛选">
        <li v-for="tab in [{ id: 1, label: '全部' }, { id: 2, label: '最受欢迎的' }, { id: 3, label: '最新的' }]" :key="tab.id">
          <button
            type="button"
            class="user-article-tab_item"
            :class="{ tabActive: blogData.tabActive === tab.id }"
            @click="selectBlogTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </li>
      </ul>
      <div class="user-article-list">
        <transition-group name="list-complete">
          <article
            v-for="item in blogData.list"
            :key="item.id ?? item.oid ?? item.title"
            class="list-complete-item user-article-list-item"
          >
            <div class="article-list-content">
              <div class="article-list-filter">
                <LogoSvg width="66%" height="auto" class="article-list-logo" />
              </div>
              <img v-if="item.coverUrl" class="article-list-img" :src="item.coverUrl" :alt="item.title" />
              <span class="article-list-time">{{ getTimeInterval(item.createTime) }}</span>
              <p class="article-list-summary truncate w-full">{{ item.summary }}</p>
            </div>
            <h3 class="article-list-title" :title="item.title">{{ item.title }}</h3>
            <p class="article-list-tag">
              {{ item.tag }}
              <i
                :class="item.isLike ? 'dd-icon-guanzhu liked' : 'dd-icon-guanzhu1'"
                class="float-right mr-2 like"
                aria-hidden="true"
              ></i>
            </p>
          </article>
        </transition-group>
      </div>
    </section>

    <footer v-if="props.staticMode" class="static-home-footer max-w-screen-lg m-auto">
      <a
        class="beian-link"
        href="https://beian.miit.gov.cn/#/Integrated/index"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="@/assets/img/beianicon.png" alt="备案徽章" />
        <span>豫ICP备19040118号-3</span>
      </a>
    </footer>
  </main>
</template>

<style scoped lang="scss">
@use "./public.scss";

$section-gap: 88px;
$section-gap-desktop: 160px;

.user-home-page {
  min-height: 100vh;
  // 首屏异步内容与入场动画会改变布局；禁用浏览器滚动锚定，避免首次进入被自动补偿到非顶部位置。
  overflow-anchor: none;
  overflow: clip;
  background-color: var(--yh-bg-color-container);
  color: var(--yh-text-color-primary);
  font: 400 16px/1.625 "Roboto", sans-serif;
}

.home-toolbar { padding-inline: 16px; }

.static-home-footer {
  padding: 28px 16px 36px;
  border-top: 1px solid var(--yh-border-level-1-color);
  text-align: center;

  .beian-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--yh-text-color-secondary);
    font-size: 14px;
    transition: color 0.2s ease;

    &:hover {
      color: var(--yh-brand-color);
    }

    img {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }
  }
}

.user-welcome-box {
  position: relative;
  isolation: isolate;
  margin-bottom: $section-gap;
  background: url("@/assets/img/user-home-page/home-banner.png") center / cover no-repeat;
  font-family: "Rubik", sans-serif;

  .user-welcome-content-bg_name {
    top: 17%;
    z-index: -1;
    color: var(--yh-text-color-disabled);
    opacity: 0.2;
  }
}

.hero-particles,
.hero-spotlight {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.hero-particle {
  position: absolute;
  left: var(--particle-left);
  top: var(--particle-top);
  width: var(--particle-size);
  height: var(--particle-size);
  border-radius: 50%;
  background: var(--yh-brand-color);
  opacity: 0.18;
  animation: particle-drift var(--particle-duration) ease-in-out var(--particle-delay) infinite alternate;
  will-change: transform;
}

.hero-spotlight {
  inset: auto;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--yh-brand-color) 10%, transparent), transparent 68%);
  opacity: 0.75;
}

.user-welcome {
  height: 100%;

  &-content {
    position: relative;
    z-index: 1;
  }

  &-content_title {
    position: relative;
    margin-bottom: 20px;

    &::after {
      position: absolute;
      top: 65%;
      left: 100px;
      width: 200px;
      height: 2px;
      background: var(--yh-text-color-primary);
      content: "";
    }
  }

  &-content_name {
    min-height: 1.08em;
    white-space: nowrap;
  }

  &-content_summary {
    min-height: 1.625em;
  }

  &-right {
    position: absolute;
    top: 32px;
    right: 0;
    z-index: 0;
    will-change: transform;
  }
}

.typing-word {
  color: var(--yh-brand-color);
}

.title_2 {
  margin-bottom: 32px;
  font-size: 25px;
  font-weight: 900;
  line-height: 1.2;
}

.section-heading {
  .section-kicker {
    display: block;
    margin-bottom: 8px;
    color: var(--yh-brand-color);
    font: 700 11px/1 monospace;
    letter-spacing: 0.22em;
  }
}

// 滚动进入动画
[data-reveal] {
  transform: translateY(28px);
  opacity: 0;
  transition: opacity 0.65s ease, transform 0.65s ease;

  &.is-visible {
    transform: translateY(0);
    opacity: 1;
  }
}

.user-home-introduce,
.others-comments,
.user-article {
  margin-bottom: $section-gap;
}

.user-home-introduce {
  // 固定插画列与图片的渲染尺寸，避免图片解码后按固有尺寸重新排版而闪现缩放。
  .introduce_left {
    flex: 0 0 30%;

    img {
      display: block;
      width: 100%;
      height: auto;
    }
  }

  .introduce_right {
    position: relative;
    overflow: hidden;
    padding: 0 16px;
  }

  .introduce-text {
    margin-bottom: 14px;
    color: var(--yh-text-color-secondary);
    font-size: 15px;
    line-height: 26px;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
}

.others-comments {
  padding: 0 16px;

  &-title {
    margin-bottom: 12px;
    text-align: center;
  }

  &-text {
    color: var(--yh-text-color-secondary);
    font-size: 15px;
    text-align: center;
  }
}

.user-article {
  padding: 16px;

  &-tab {
    gap: 36px;
    margin-bottom: 32px;

    &_item {
      position: relative;
      padding-bottom: 5px;
      color: var(--yh-text-color-secondary);
      transition: color 0.2s ease;

      &::after {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--yh-brand-color);
        transform: scaleX(0);
        transition: transform 0.25s ease;
        content: "";
      }

      &:hover,
      &.tabActive {
        color: var(--yh-brand-color);

        &::after {
          transform: scaleX(1);
        }
      }
    }
  }

  &-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 30px;
  }

  &-list-item {
    min-width: 0;
    cursor: default;
    transition: transform 0.3s ease, filter 0.3s ease;

    &:hover {
      transform: translateY(-6px);
      filter: drop-shadow(0 12px 14px rgb(15 23 42 / 8%));

      .article-list-img {
        transform: scale(1.045);
      }
    }
  }
}

.article-list-content {
  position: relative;
  z-index: 0;
  aspect-ratio: 3 / 2;
  margin-bottom: 10px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--yh-bg-color-secondarycontainer);
}

.article-list-filter {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background-color: var(--dd-scrollbar-color);
  opacity: 0.2;
  filter: blur(7px);
}

.article-list-logo {
  height: 100%;
}

.article-list-img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.45s ease;
}

.article-list-time {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgb(0 0 0 / 28%);
  color: #fff;
  font-size: 12px;
}

.article-list-summary {
  position: absolute;
  bottom: 0;
  z-index: 2;
  padding-inline: 6px;
  background-color: color-mix(in srgb, var(--yh-text-color-primary) 74%, transparent);
  color: var(--yh-text-color-anti);
  font-size: 14px;
  line-height: 2.4;
}

.article-list-title {
  color: var(--yh-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.article-list-tag {
  color: var(--yh-text-color-secondary);
  font-size: 14px;

  .like.liked,
  .like:hover {
    color: var(--yh-brand-color);
  }
}

.list-complete-move,
.list-complete-enter-active,
.list-complete-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.list-complete-enter-from,
.list-complete-leave-to {
  transform: translateY(12px);
  opacity: 0;
}

@keyframes illustration-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes particle-drift {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(12px, -18px, 0); }
}

@media screen and (min-width: 640px) {
  .user-article-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media screen and (min-width: 768px) {
  .user-welcome-box {
    .user-welcome-content-bg_name { top: 22%; }
  }

  .user-welcome {
    .user-welcome-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .user-welcome-content_title {
      margin-bottom: 24px;

      &::after {
        left: 176px;
        width: 410px;
      }
    }

    .user-welcome-right {
      position: relative;
      padding-top: 48px;
    }
  }

  .user-home-introduce,
  .others-comments,
  .user-article {
    margin-bottom: $section-gap-desktop;
  }

  .user-home-introduce {
    .introduce_right { margin-left: 8%; }
    .introduce-title { font-size: 36px; }
  }

  .others-comments { padding: 0 32px; }
  .user-article-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media screen and (min-width: 1280px) {
  .user-welcome-box {
    height: 600px;

    .user-welcome-content-bg_name { top: 32%; }
  }

  .user-welcome .user-welcome-right { padding-top: 0; }
}

</style>
