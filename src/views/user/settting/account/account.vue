<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { getUserProfile, type UserProfile } from "@/api/user";
import GlassCard from "@/components/card/glass";
import { useUserStore } from "@/store";

const userStore = useUserStore();
const loading = ref(true);

const getUserDataKey = (key: string) => userStore.getUserData[key];

const formData = reactive({
  email: getUserDataKey("email"),
  phone: getUserDataKey("phone"),
  password: getUserDataKey("password"),
});

function setAccountData(profile: Partial<UserProfile>) {
  const storeData = userStore.getUserData || {};
  Object.assign(formData, {
    email: profile.email || storeData.email || "",
    phone: profile.phone || storeData.phone || "",
  });
}

async function loadAccountData() {
  loading.value = true;
  try {
    const { data } = await getUserProfile();
    setAccountData(data || {});
  } catch {
    setAccountData({});
  } finally {
    loading.value = false;
  }
}

onMounted(loadAccountData);
</script>

<template>
  <div class="account-settings">
    <GlassCard class="account-card account-card--heading" aria-labelledby="account-heading">
      <p class="account-card__eyebrow">账户中心</p>
      <h1 id="account-heading">账号设置</h1>
      <p>查看并管理账号的安全信息与绑定方式</p>
    </GlassCard>

    <GlassCard class="account-card account-card--security" :depth="1.2" aria-label="账号安全设置">
      <el-skeleton :loading="loading" animated>
        <template #template>
          <div class="account-skeleton" aria-busy="true">
            <div v-for="item in 3" :key="item" class="account-skeleton__item">
              <div class="account-skeleton__content">
                <el-skeleton-item variant="h3" class="account-skeleton__title" />
                <el-skeleton-item variant="text" class="account-skeleton__text" />
              </div>
              <el-skeleton-item variant="button" class="account-skeleton__button" />
            </div>
          </div>
        </template>

        <article class="account-item">
        <div>
          <h2>密码</h2>
          <p>定期更新密码可以更好地保护你的账号</p>
        </div>
        <button type="button" class="account-item__action">修改</button>
      </article>
      <article class="account-item">
        <div>
          <h2>邮箱</h2>
          <p>{{ formData.email || "暂未绑定邮箱" }}</p>
        </div>
        <button type="button" class="account-item__action">{{ formData.email ? "修改" : "绑定" }}</button>
      </article>
      <article class="account-item">
        <div>
          <h2>手机号</h2>
          <p>{{ formData.phone || "暂未绑定手机号" }}</p>
        </div>
        <button type="button" class="account-item__action">{{ formData.phone ? "修改" : "绑定" }}</button>
        </article>
      </el-skeleton>
    </GlassCard>
  </div>
</template>

<style scoped lang="scss">
.account-settings {
  display: grid;
  gap: 18px;
}

.account-card {
  &--heading {
    padding: 28px 34px;

    h1,
    p {
      margin: 0;
    }

    h1 {
      margin-bottom: 8px;
      color: var(--yh-text-color-primary);
      font-size: 27px;
      line-height: 1.2;
    }

    > p:last-child {
      color: var(--yh-text-color-secondary);
    }
  }

  &__eyebrow {
    margin-bottom: 7px !important;
    color: var(--yh-brand-color);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.09em;
  }

  &--security {
    padding: 10px 28px;
  }
}

.account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 92px;
  border-bottom: 1px solid color-mix(in srgb, var(--yh-border-level-1-color) 82%, transparent);

  &:last-child {
    border-bottom: 0;
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    margin-bottom: 7px;
    color: var(--yh-text-color-primary);
    font-size: 15px;
  }

  p {
    color: var(--yh-text-color-secondary);
    font-size: 13px;
  }

  &__action {
    padding: 7px 13px;
    border: 1px solid color-mix(in srgb, var(--yh-brand-color) 22%, transparent);
    border-radius: 9px;
    outline: none;
    background: color-mix(in srgb, var(--yh-brand-color-1) 82%, transparent);
    color: var(--yh-brand-color);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    transition: transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease;

    &:hover {
      transform: translateY(-1px);
      background: var(--yh-brand-color-2);
      box-shadow: 0 6px 12px color-mix(in srgb, var(--yh-brand-color) 16%, transparent);
    }

    &:focus-visible {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--yh-brand-color) 20%, transparent);
    }
  }
}

.account-skeleton {
  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 92px;
    border-bottom: 1px solid color-mix(in srgb, var(--yh-border-level-1-color) 82%, transparent);

    &:last-child {
      border-bottom: 0;
    }
  }

  &__content {
    display: grid;
    gap: 11px;
    min-width: 190px;
  }

  &__title {
    width: 72px;
  }

  &__text {
    width: min(260px, 55vw);
  }

  &__button {
    width: 54px;
    height: 31px;
  }
}

@media (max-width: 680px) {
  .account-card {
    &--heading {
      padding: 22px 18px;
    }

    &--security {
      padding: 6px 18px;
    }
  }

  .account-item {
    gap: 15px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .account-item__action {
    transition: none;
  }

  .account-item__action:hover {
    transform: none;
  }
}
</style>
