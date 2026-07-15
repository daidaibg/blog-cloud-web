<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import GbHeader from "@/components/header/gb-header.vue";
import GlassCard from "@/components/card/glass";
import Menus from "@/components/menus";
import { settingUserMenuList } from "./index";

const route = useRoute();
const navigationMenu = ref<{ $el: HTMLElement }>();

function updateActiveIndicator() {
  const menu = navigationMenu.value?.$el.querySelector<HTMLElement>(".blog_menu");
  const activeItem = menu?.querySelector<HTMLElement>(".el-menu-item.is-active");
  if (!menu || !activeItem) return;

  const indicatorHeight = 16;
  const horizontalOffset = activeItem.offsetLeft;
  const offset = activeItem.offsetTop + (activeItem.offsetHeight - indicatorHeight) / 2;
  menu.style.setProperty("--settings-active-indicator-x", `${horizontalOffset}px`);
  menu.style.setProperty("--settings-active-indicator-y", `${offset}px`);
  menu.style.setProperty("--settings-active-indicator-opacity", "1");
}

function queueActiveIndicatorUpdate() {
  nextTick(updateActiveIndicator);
}

watch(() => route.path, queueActiveIndicatorUpdate);

onMounted(() => {
  queueActiveIndicatorUpdate();
  window.addEventListener("resize", queueActiveIndicatorUpdate);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", queueActiveIndicatorUpdate);
});
</script>

<template>
  <GbHeader :tab-show="false" />
  <main class="settings-page gaobug">
    <aside class="settings-page__navigation" aria-label="账号设置导航">
      <GlassCard class="settings-navigation-card">
        <Menus ref="navigationMenu" class="settings-navigation-menu" :menus="settingUserMenuList" />
      </GlassCard>
    </aside>
    <section class="settings-page__content" aria-label="账号设置内容">
      <router-view />
    </section>
  </main>
</template>

<style scoped lang="scss">
.settings-page {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 24px;
  max-width: 1150px;
  min-height: calc(100vh - var(--header-height));
  margin: 0 auto;
  padding: 28px 0 40px;
  border: 0;
  border-radius: 0;
  background: transparent;
  isolation: isolate;

  &::before {
    position: fixed;
    z-index: -2;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--yh-brand-color-7) 48%, var(--dd-html-bg)) 0%,
      color-mix(in srgb, var(--yh-brand-color-5) 40%, var(--dd-html-bg)) 36%,
      color-mix(in srgb, var(--yh-brand-color-3) 32%, var(--dd-html-bg)) 62%,
      var(--dd-html-bg) 100%
    );
    transition: background 300ms ease;
    content: "";
  }

  &::after {
    position: fixed;
    z-index: -1;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--yh-text-color-anti) 12%, transparent), transparent 44%),
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--yh-text-color-primary) 20%, transparent),
        transparent 24% 76%,
        color-mix(in srgb, var(--yh-text-color-primary) 18%, transparent)
      );
    content: "";
  }

  &__navigation,
  &__content {
    min-width: 0;
  }

  &__navigation {
    position: sticky;
    top: calc(var(--header-height) + 28px);
    align-self: start;
  }

  :deep(.settings-navigation-card) {
    width: 100%;
    min-height: min(880px, calc(100vh - var(--header-height) - 68px));
  }

  :deep(.settings-navigation-menu.menu_wrap) {
    width: 100%;
    min-height: 100%;
    padding: 0;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  :deep(.settings-navigation-menu .blog_menu) {
    position: relative;
    --settings-active-indicator-x: 0px;
    --settings-active-indicator-y: 0px;
    --settings-active-indicator-opacity: 0;
    background: transparent;

    &::before {
      position: absolute;
      z-index: 2;
      top: 0;
      left: 10px;
      width: 4px;
      height: 16px;
      border-radius: 999px;
      pointer-events: none;
      background: linear-gradient(180deg, color-mix(in srgb, #fff 52%, var(--yh-brand-color)), var(--yh-brand-color));
      box-shadow: 0 2px 7px color-mix(in srgb, var(--yh-brand-color) 34%, transparent);
      opacity: var(--settings-active-indicator-opacity);
      transform: translate3d(var(--settings-active-indicator-x), var(--settings-active-indicator-y), 0);
      transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease;
      content: "";
    }

    .el-menu-item {
      position: relative;
      min-height: 42px;
      margin-bottom: 8px;
      padding: 0 16px;
      border-radius: 10px;
      font-size: 14px;
      transition: background-color 180ms ease, color 180ms ease;

      &:hover {
        background: color-mix(in srgb, var(--yh-brand-color) 8%, transparent);
        transform: none;
      }

      &.is-active {
        color: var(--yh-brand-color);
        border: 1px solid color-mix(in srgb, var(--yh-brand-color) 18%, transparent);
        background: color-mix(in srgb, var(--yh-brand-color) 12%, transparent);
        box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 48%, transparent);
      }
    }
  }
}

@media (max-width: 1280px) {
  .settings-page {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 24px;
    margin: 0 24px;
  }
}

@media (max-width: 960px) {
  .settings-page {
    grid-template-columns: 170px minmax(0, 1fr);
    gap: 20px;
    margin: 0 16px;
    padding-top: 20px;
  }
}

@media (max-width: 680px) {
  .settings-page {
    display: block;
    margin: 0;
    padding: 12px;

    &__navigation {
      position: static;
      margin-bottom: 16px;
    }

    :deep(.settings-navigation-menu.menu_wrap) {
      min-height: auto;
    }

    :deep(.settings-navigation-card) {
      min-height: auto;
    }

    :deep(.settings-navigation-menu .blog_menu) {
      display: flex;
      gap: 6px;

      .el-menu-item {
        flex: 1;
        justify-content: center;
        min-height: 42px;
        margin-bottom: 0;
        padding: 0 8px;
        font-size: 14px;
      }
    }
  }
}
</style>
