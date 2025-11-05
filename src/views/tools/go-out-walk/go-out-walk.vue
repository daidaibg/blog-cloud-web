<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Close } from "@element-plus/icons-vue";
import { sendXiaomiMotionForm } from "@/api/tool/index";
interface Account {
  username: string;
  password: string;
  target: string;
}

const STORAGE_KEY = "go_out_walk_accounts";
const isAutoMode = ref(true);
const loading = ref(false);
const defaultTarget = Math.floor(Math.random() * 10001 + 20000).toString();
const accounts = ref<Account[]>([
  {
    username: "",
    password: "",
    target: defaultTarget,
  },
]);

// 每个账号的提交状态：'idle' | 'sending' | 'success' | 'failed'
const statuses = ref<string[]>(accounts.value.map(() => "idle"));
const statusMsgs = ref<string[]>(accounts.value.map(() => ""));

onMounted(() => {
  const savedAccounts = localStorage.getItem(STORAGE_KEY);
  if (savedAccounts) {
    try {
      const parsed = JSON.parse(savedAccounts);
      // 重新进入时不恢复步数，全部使用当前默认步数
      accounts.value = parsed.map((a: any) => ({
        username: a.username || "",
        password: a.password || "",
        target: defaultTarget,
      }));
    } catch (e) {
      // 解析失败则忽略
      console.warn("加载本地账号失败", e);
    }
  }
  // 初始化状态数组长度
  statuses.value = accounts.value.map(() => "idle");
  statusMsgs.value = accounts.value.map(() => "");
});

const addAccount = () => {
  accounts.value.push({
    username: "",
    password: "",
    target: defaultTarget,
  });
  statuses.value.push("idle");
  statusMsgs.value.push("");
  saveToLocal();
};

// 删除账号
const removeAccount = (index: number) => {
  accounts.value.splice(index, 1);
  if (accounts.value.length === 0) {
    addAccount();
  }
  // 同步状态数组
  statuses.value.splice(index, 1);
  statusMsgs.value.splice(index, 1);
  saveToLocal();
};

// 保存到本地存储
const saveToLocal = () => {
  // 本地只存储账号信息（用户名、密码），不存储步数（target）
  const toSave = accounts.value.map((a) => ({ username: a.username, password: a.password }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
};

// 开始走路
const startWalking = async () => {
  if (!validateAccounts()) {
    return;
  }

  loading.value = true;
  const failedIndices: number[] = [];

  for (let i = 0; i < accounts.value.length; i++) {
    const acc = accounts.value[i];
    statuses.value[i] = "sending";
    statusMsgs.value[i] = "";

    const form = new FormData();
    form.append("phone", acc.username);
    form.append("pwd", acc.password);
    form.append("num", acc.target);

    const res = await sendXiaomiMotionForm(form);
    if (res.code == 200 && res.data.code == 200) {
      statuses.value[i] = "success";
    } else {
      statuses.value[i] = "failed";
      statusMsgs.value[i] = res.data.data || "提交失败";
      failedIndices.push(i);
    }
  }

  if (failedIndices.length === 0) {
    ElMessage.success("全部账号提交成功");
  } else {
    ElMessage.warning(`${failedIndices.length} 个账号提交失败，可单独重试`);
  }

  loading.value = false;
};

// 单个账号重试
const retryAccount = async (index: number) => {
  if (!accounts.value[index]) return;

  statuses.value[index] = "sending";
  statusMsgs.value[index] = "";

  const acc = accounts.value[index];
  const form = new FormData();
  form.append("phone", acc.username);
  form.append("pwd", acc.password);
  form.append("num", acc.target);

  const res = await sendXiaomiMotionForm(form);
  if (res.code == 200 && res.data.code == 200) {
    statuses.value[index] = "success";
    ElMessage.success(`账号 ${index + 1} 重试成功`);
  } else {
    statuses.value[index] = "failed";
    statusMsgs.value[index] = res.data.data || "提交失败";
    ElMessage.error(`账号 ${index + 1} 重试失败: ${statusMsgs.value[index]}`);
  }
};

// 验证账号信息
const validateAccounts = () => {
  for (const [index, account] of accounts.value.entries()) {
    if (!account.username || !account.password) {
      ElMessage.warning(`账号 ${index + 1} 的信息不完整`);
      return false;
    }
  }
  return true;
};

// 监听账号变化并保存
watch(
  accounts,
  () => {
    saveToLocal();
  },
  { deep: true }
);
</script>

<template>
  <div class="go-out-walk">
    <div class="content">
      <div class="header">
        <h1>出去走走</h1>
        <p>走走停停，看风景，寻自由</p>
      </div>

      <div class="notice">请收藏网站链接在浏览器中访问</div>

      <div class="accounts-container">
        <div v-for="(account, index) in accounts" :key="index" class="account-item">
          <div class="account-header">
            <span class="account-title">账号 {{ index + 1 }}</span>

            <div class="account-actions">
              <el-tag v-if="statuses[index] === 'success'" type="success" size="small">成功</el-tag>
              <el-tag v-else-if="statuses[index] === 'sending'" type="info" size="small">提交中</el-tag>
              <el-tag v-else-if="statuses[index] === 'failed'" type="danger" size="small">失败</el-tag>
              <el-button v-if="statuses[index] === 'failed'" size="small" type="warning" @click="retryAccount(index)"
                >重试</el-button
              >

              <div class="walk-close" v-if="accounts.length > 1" circle @click="removeAccount(index)">
                <el-icon><Close /></el-icon>
              </div>
            </div>
          </div>

          <el-form>
            <el-form-item>
              <el-input v-model="account.username" placeholder="账号" clearable />
            </el-form-item>
            <el-form-item>
              <el-input v-model="account.password" type="password" placeholder="密码" show-password />
            </el-form-item>
            <el-form-item>
              <el-input v-model="account.target" placeholder="目标值">
                <template #prepend>默认：</template>
              </el-input>
            </el-form-item>
          </el-form>
          <div style="text-align: center;margin-bottom: 12px;"   v-if="statuses[index] === 'failed'" >
            <el-text type="danger">{{ statusMsgs[index] }}</el-text>
          </div>
        </div>

        <el-button class="add-account" type="success" @click="addAccount">
          <el-icon><Plus /></el-icon>
          添加账号
        </el-button>
      </div>

      <el-button type="primary" class="submit-button" @click="startWalking" :loading="loading"> 出去走走 </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.go-out-walk {
  display: flex;
  justify-content: center;
  min-height: 100vh;
  .content {
    width: 100%;
    max-width: 700px;
    padding: 16px;

    .header {
      text-align: center;
      position: relative;
      padding: 20px 0;
      h1 {
        font-size: 32px;
        color: var(--yh-text-color-brand);
        margin: 0;
      }

      p {
        color: var(--yh-text-color-brand);
        margin: 10px 0;
      }

      .mountain {
        position: absolute;
        right: 0;
        top: 0;
        width: 80px;
        opacity: 0.6;
      }
    }

    .notice {
      text-align: center;
      color: var(--yh-text-color-secondary);
      margin-bottom: 20px;
    }

    .accounts-container {
      background: var(--yh-text-color-anti);
      border-radius: 12px;
      padding: 20px;
      box-shadow: var(--yh-shadow-3);

      .account-item {
        margin-bottom: 20px;
        padding: 12px;
        padding-bottom: 0;
        border: 1px solid var(--yh-border-level-1-color);
        border-radius: 8px;

        .account-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;

          .account-title {
            font-weight: bold;
            color: var(--yh-text-color-brand);
          }
          .account-actions{
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }

        &:last-child {
          margin-bottom: 0;
        }
      }
      .walk-close {
        cursor: pointer;
        color: var(--yh-text-color-secondary);
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        transition: background-color 0.3s, color 0.3s;

        &:hover {
          background-color: var(--yh-hover-bg-color);
          color: var(--yh-text-color-brand);
        }
      }

      .add-account {
        width: 100%;
        margin-top: 15px;
      }
    }

    .submit-button {
      width: 100%;
      height: 50px;
      margin-top: 20px;
      font-size: 18px;
    }
  }
}
</style>
