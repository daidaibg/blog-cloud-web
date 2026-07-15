<script setup lang="ts">
import { CopyDocument } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";

import { getUserProfile, updateUserProfile, type UserProfile } from "@/api/user";
import defaultAvatar from "@/assets/img/avatar.png";
import GlassCard from "@/components/card/glass";
import { useUserStore } from "@/store";
import AvatarCropDialog from "./avatar-crop-dialog.vue";

const userStore = useUserStore();
const profileForm = ref();
const saving = ref(false);
const avatarDialogVisible = ref(false);

const formData = reactive({
  account: "",
  username: "",
  nickName: "",
  gender: undefined as number | undefined,
  birthday: "",
  summary: "",
  avatar: ""
});

const rules = {
  nickName: [{ required: true, message: "请输入用户昵称", trigger: "blur" }]
};

const loginAccount = computed(() => {
  const storeData = userStore.getUserData || {};
  return formData.account || formData.username || storeData.account || storeData.username || "";
});

async function copyLoginAccount() {
  if (!loginAccount.value) return;

  try {
    await navigator.clipboard.writeText(loginAccount.value);
    ElMessage.success("登录账号已复制");
  } catch {
    ElMessage.error("复制失败，请稍后重试");
  }
}

function setProfile(profile: Partial<UserProfile>) {
  const storeData = userStore.getUserData || {};
  Object.assign(formData, {
    account: profile.account || storeData.account || "",
    username: profile.username || storeData.username || "",
    nickName: profile.nickName || "",
    // Historical profile data used 0 for female; the update API accepts only 1 or 2.
    gender: profile.gender === 0 ? 2 : profile.gender,
    birthday: profile.birthday ? String(profile.birthday).slice(0, 10) : "",
    summary: profile.summary || "",
    avatar: profile.avatar || ""
  });
}

async function loadProfile() {
  try {
    const { data } = await getUserProfile();
    setProfile(data || {});
  } catch {
    setProfile({});
  }
}

async function saveProfile() {
  const valid = await profileForm.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const result = await updateUserProfile({
      nickName: formData.nickName,
      gender: formData.gender,
      birthday: formData.birthday,
      summary: formData.summary,
      avatar: formData.avatar
    });
    if (result.code !== 200) {
      ElMessage.error(result.msg || "保存失败");
      return;
    }
    ElMessage.success("保存成功");
    await loadProfile();
  } catch (error) {
    const message = (error as { msg?: string })?.msg || "保存失败，请稍后重试";
    ElMessage.error(message);
  } finally {
    saving.value = false;
  }
}

onMounted(loadProfile);
</script>

<template>
  <div class="profile-settings">
    <GlassCard class="profile-form-card" aria-labelledby="profile-form-title">
      <div class="profile-form__header">
        <h2 id="profile-form-title">基本信息</h2>
      </div>

      <el-form ref="profileForm" :model="formData" :rules="rules" class="profile-form" label-position="top" @submit.prevent="saveProfile">
        <el-form-item class="profile-form__field profile-form__field--full profile-form__avatar-field" label="我的头像">
          <button type="button" class="profile-avatar" aria-label="修改头像" @click="avatarDialogVisible = true">
            <el-avatar :size="56" :src="formData.avatar || defaultAvatar" />
            <span class="profile-avatar__edit">修改头像</span>
          </button>
        </el-form-item>

        <el-form-item class="profile-form__field" label="用户昵称" prop="nickName">
          <el-input v-model="formData.nickName" maxlength="30" />
        </el-form-item>

        <el-form-item class="profile-form__field" label="登录账号">
          <div class="profile-account-display">
            <span>{{ loginAccount || "暂无登录账号" }}</span>
            <button type="button" class="profile-copy-button" aria-label="复制登录账号" :disabled="!loginAccount" @click="copyLoginAccount">
              <el-icon><CopyDocument /></el-icon>
            </button>
          </div>
        </el-form-item>

        <el-form-item class="profile-form__field" label="性别" prop="gender">
          <el-select v-model="formData.gender" placeholder="请选择性别">
            <el-option label="男" :value="1" />
            <el-option label="女" :value="2" />
          </el-select>
        </el-form-item>

        <el-form-item class="profile-form__field" label="出生年月" prop="birthday">
          <el-date-picker v-model="formData.birthday" type="date" value-format="YYYY-MM-DD" placeholder="请选择出生年月" />
        </el-form-item>

        <el-form-item class="profile-form__field profile-form__field--full" label="个人简介" prop="summary">
          <el-input v-model="formData.summary" type="textarea" :rows="5" :maxlength="150" show-word-limit resize="none" />
        </el-form-item>

        <div class="profile-form__actions profile-form__field--full">
          <el-button class="profile-form__save-button" native-type="submit" type="primary" :loading="saving">保存修改</el-button>
        </div>
      </el-form>
    </GlassCard>

    <AvatarCropDialog v-model="avatarDialogVisible" @success="formData.avatar = $event" />
  </div>
</template>

<style scoped lang="scss">
.profile-settings {
  max-width: none;
}

.profile-form-card {
  padding: 30px 36px 40px;
}

.profile-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 26px;

  h2 {
    margin: 0;
    color: var(--yh-text-color-primary);
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
  }

}

.profile-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 48px;
  row-gap: 26px;

  &__field {
    min-width: 0;
    margin-bottom: 0;

    &--full {
      grid-column: 1 / -1;
    }

    :deep(.el-form-item__label) {
      height: auto;
      margin-bottom: 8px;
      color: var(--yh-text-color-primary);
      font-size: 16px;
      line-height: 22px;
    }

    :deep(.el-form-item__content) {
      min-width: 0;
      line-height: normal;
    }

    :deep(.el-input),
    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
    }

    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper),
    :deep(.el-textarea__inner) {
      border: 1px solid color-mix(in srgb, var(--yh-brand-color) 22%, transparent);
      border-radius: 16px;
      background: color-mix(in srgb, #fff 52%, transparent);
      box-shadow: none;
      transition: border-color 180ms ease, box-shadow 180ms ease;
    }

    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper) {
      min-height: 50px;
      min-height: 42px;
      padding: 1px 13px;
      border-radius: 20px;
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, #fff 66%, transparent),
        0 7px 16px color-mix(in srgb, var(--yh-brand-color) 11%, transparent);
    }

    :deep(.el-input__inner),
    :deep(.el-select__selected-item),
    :deep(.el-input.is-disabled .el-input__inner) {
      color: var(--yh-text-color-primary);
      font-size: 14px;
    }

    :deep(.el-input.is-disabled .el-input__wrapper) {
      border-color: color-mix(in srgb, var(--yh-brand-color) 18%, #dce8f5);
      background: color-mix(in srgb, var(--yh-brand-color) 8%, #eaf2f9);
      box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 52%, transparent);
    }

    :deep(.el-input.is-disabled .el-input__suffix) {
      pointer-events: auto;
    }

    .profile-account-display {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      width: 100%;
      min-height: 42px;
      color: var(--yh-text-color-primary);
      font-size: 14px;

      > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .profile-copy-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--yh-brand-color);
      cursor: pointer;
      transition: background-color 180ms ease, transform 180ms ease;

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--yh-brand-color) 18%, transparent);
        transform: translateY(-1px);
      }

      &:disabled {
        color: var(--yh-text-color-secondary);
        cursor: not-allowed;
        opacity: 0.55;
      }
    }

    :deep(.el-input__wrapper:hover),
    :deep(.el-select__wrapper:hover),
    :deep(.el-textarea__inner:hover) {
      border-color: color-mix(in srgb, var(--yh-brand-color) 48%, #b8d9f8);
      background: color-mix(in srgb, #fff 62%, transparent);
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, #fff 62%, transparent),
        0 9px 18px color-mix(in srgb, var(--yh-brand-color) 14%, transparent);
    }

    :deep(.el-input__wrapper.is-focus),
    :deep(.el-select__wrapper.is-focused),
    :deep(.el-textarea__inner:focus) {
      border-color: var(--yh-brand-color);
      background: color-mix(in srgb, #fff 72%, transparent);
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, #fff 70%, transparent),
        0 0 0 4px color-mix(in srgb, var(--yh-brand-color) 16%, transparent),
        0 10px 22px color-mix(in srgb, var(--yh-brand-color) 18%, transparent);
    }

    :deep(.el-textarea__inner) {
      min-height: 150px !important;
      padding: 12px 13px 28px;
      color: var(--yh-text-color-primary);
      font-size: 14px;
      line-height: 1.7;
      resize: none;
    }

    :deep(.el-input__count) {
      right: 14px;
      bottom: 9px;
      color: var(--yh-text-color-secondary);
      background: transparent;
      font-size: 13px;
    }
  }

  &__avatar-field {
    grid-column: 1 / -1;
    grid-row: auto;
    display: flex;
    align-items: center;
    min-height: 72px;
    margin-bottom: 0;
    padding-right: 0;
    border-right: 0;

    :deep(.el-form-item__label) {
      flex: 0 0 auto;
      margin: 0 16px 0 0;
    }

    :deep(.el-form-item__content) {
      flex: 0 0 auto;
      min-height: 60px;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 40px;

    :deep(.profile-form__save-button.el-button) {
      min-width: 102px;
      min-height: 40px;
      padding: 0 18px;
      border: 1px solid color-mix(in srgb, #d8efff 82%, transparent);
      border-radius: 15px;
      background: linear-gradient(145deg, color-mix(in srgb, #70bbff 92%, var(--yh-brand-color)), var(--yh-brand-color));
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-shadow: 0 1px 1px color-mix(in srgb, #103d78 42%, transparent);
      box-shadow:
        inset 0 1px 1px color-mix(in srgb, #fff 58%, transparent),
        inset 0 -2px 5px color-mix(in srgb, #0c4b9d 26%, transparent),
        0 9px 18px color-mix(in srgb, var(--yh-brand-color) 26%, transparent);
      transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;

      &:hover:not(.is-disabled) {
        filter: brightness(1.05);
        box-shadow:
          inset 0 1px 1px color-mix(in srgb, #fff 66%, transparent),
          inset 0 -2px 5px color-mix(in srgb, #0c4b9d 22%, transparent),
          0 13px 23px color-mix(in srgb, var(--yh-brand-color) 34%, transparent);
      }

      &:active:not(.is-disabled) {
        box-shadow:
          inset 0 2px 6px color-mix(in srgb, #083d87 38%, transparent),
          0 4px 9px color-mix(in srgb, var(--yh-brand-color) 24%, transparent);
        transform: translateY(1px);
      }

      &.is-disabled {
        border-color: color-mix(in srgb, #d7e5f3 82%, transparent);
        background: color-mix(in srgb, #9db8d4 72%, transparent);
        color: color-mix(in srgb, #fff 86%, transparent);
        box-shadow: none;
      }
    }
  }
}

.profile-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 62px;
  height: 62px;
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--yh-brand-color) 42%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, #fff 58%, transparent);
  outline: none;
  cursor: pointer;
  isolation: isolate;
  overflow: hidden;
  transition: transform 180ms ease, box-shadow 180ms ease;
  box-shadow:
    inset 0 1px 1px color-mix(in srgb, var(--yh-brand-color) 24%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--yh-brand-color) 10%, transparent),
    0 8px 18px color-mix(in srgb, var(--yh-brand-color) 18%, transparent);

  &:hover {
    box-shadow:
      inset 0 1px 1px color-mix(in srgb, var(--yh-brand-color) 30%, transparent),
      0 11px 22px color-mix(in srgb, var(--yh-brand-color) 24%, transparent);
  }

  &__edit {
    position: absolute;
    z-index: 1;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: inherit;
    background: color-mix(in srgb, var(--yh-brand-color) 58%, transparent);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transition: opacity 180ms ease;
  }

  &:hover &__edit,
  &:focus-visible &__edit {
    opacity: 1;
  }

  :deep(.el-avatar) {
    width: 54px !important;
    height: 54px !important;
    box-shadow: 0 2px 6px color-mix(in srgb, var(--yh-brand-color) 16%, transparent);
  }

  &__field:nth-child(2) {
    grid-column: 2;
  }

  &__field:nth-child(3) {
    grid-column: 1;
  }
}

.avatar-upload {
  width: 100%;

  :deep(.el-upload) {
    display: block;
    width: 100%;
  }

  :deep(.el-upload-dragger) {
    width: 100%;
    padding: 34px 20px;
    border: 1px dashed color-mix(in srgb, var(--yh-brand-color) 40%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, #fff 54%, transparent);
  }

  &__icon {
    margin-bottom: 12px;
    color: var(--yh-brand-color);
    font-size: 32px;
  }

  :deep(.el-upload__tip) {
    margin-top: 12px;
    color: var(--yh-text-color-secondary);
  }
}

@media (max-width: 960px) {
  .profile-form-card {
    padding: 28px;
  }

  .profile-form {
    column-gap: 24px;
  }
}

@media (max-width: 680px) {
  .profile-form-card {
    padding: 22px 18px 24px;
    border-radius: 14px;
  }

  .profile-form__header {
    margin-bottom: 20px;

    h2 {
      font-size: 20px;
    }
  }

  .profile-form {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 16px;

    &__field {
      grid-column: 1;

      :deep(.el-input__wrapper),
      :deep(.el-select__wrapper) {
        min-height: 44px;
      }

      :deep(.el-textarea__inner) {
        min-height: 160px !important;
      }
    }

    &__actions :deep(.el-button) {
      min-height: 44px;
    }

    &__field:nth-child(2),
    &__field:nth-child(3) {
      grid-column: 1;
    }

    &__avatar-field {
      grid-row: auto;
      padding-right: 0;
      border-right: 0;

      :deep(.el-form-item__label) {
        margin: 0 14px 0 0;
      }
    }
  }
}
</style>
