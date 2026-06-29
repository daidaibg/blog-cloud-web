<script setup lang="ts">
import { computed, onMounted, reactive, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft } from "@element-plus/icons-vue";
import G1Logo from "@/assets/img/kaipao/G/logo/G1.png";
import G2Logo from "@/assets/img/kaipao/G/logo/G2.png";
import G3Logo from "@/assets/img/kaipao/G/logo/G3.png";
import BracerIcon from "@/assets/img/kaipao/equipment/hubi.png";
import PantsIcon from "@/assets/img/kaipao/equipment/kuzi.png";
import GlovesIcon from "@/assets/img/kaipao/equipment/shoutao.png";
import HelmetIcon from "@/assets/img/kaipao/equipment/toukui.png";
import BootsIcon from "@/assets/img/kaipao/equipment/xiezi.png";
import ClothesIcon from "@/assets/img/kaipao/equipment/yifu.png";
import { equipmentEntryListByPart, equipmentParts, type EquipmentEntry, type EquipmentPartKey } from "./equipment-entry-data";
import {
  createEmptyIgnoredEntryIds,
  loadEquipmentEntrySettings,
  saveEquipmentEntrySettings,
  type IgnoredEntryIdsByPart,
} from "./equipment-settings-storage";

const router = useRouter();

const ignoredEntryIdsByPart = reactive<IgnoredEntryIdsByPart>(createEmptyIgnoredEntryIds());

const partIconMap: Record<EquipmentPartKey, string> = {
  helmet: HelmetIcon,
  clothes: ClothesIcon,
  boots: BootsIcon,
  bracer: BracerIcon,
  pants: PantsIcon,
  gloves: GlovesIcon,
};

const seasonLogoMap: Record<NonNullable<EquipmentEntry["season"]>, string> = {
  G1: G1Logo,
  G2: G2Logo,
  G3: G3Logo,
};

const ignoredCount = computed(() => {
  return equipmentParts.reduce((total, part) => total + ignoredEntryIdsByPart[part.key].length, 0);
});

const getIgnoredEntryLabel = (entry: EquipmentEntry) => {
  return entry.shortName || entry.name;
};

const getEntrySeasonLogo = (entry: EquipmentEntry) => {
  return entry.season ? seasonLogoMap[entry.season] : "";
};

const loadSettings = () => {
  const settings = loadEquipmentEntrySettings();

  equipmentParts.forEach((part) => {
    ignoredEntryIdsByPart[part.key] = settings.ignoredEntryIdsByPart[part.key];
  });
};

const saveSettings = () => {
  saveEquipmentEntrySettings({
    ignoredEntryIdsByPart,
  });
};

onMounted(loadSettings);

watch(ignoredEntryIdsByPart, saveSettings, { deep: true });
</script>

<template>
  <main class="kaipao-settings-page comments">
    <section class="settings-toolbar">
      <div>
        <h1>装备词条设置</h1>
        <p>设置会自动保存到本地，保存装备词条时也会一起带给后端接口。</p>
      </div>
      <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
    </section>

    <section class="settings-layout">
      <aside class="settings-nav">
        <button class="is-active" type="button">
          <span>忽略词条</span>
          <el-tag size="small" round>{{ ignoredCount }}</el-tag>
        </button>
      </aside>

      <section class="settings-panel">
        <header class="panel-head">
          <div>
            <h2>忽略装备词条</h2>
            <p>被忽略的词条不会出现在对应部位的下拉框中，已经选中的单元格会保留当前值。</p>
          </div>
        </header>

        <el-collapse>
          <el-collapse-item v-for="part in equipmentParts" :key="part.key" :name="part.key">
            <template #title>
              <span class="settings-part-title">
                <img :src="partIconMap[part.key]" alt="" />
                <span>{{ part.label }}</span>
                <el-tag size="small" round>{{ ignoredEntryIdsByPart[part.key].length }}</el-tag>
              </span>
            </template>
            <el-checkbox-group
              v-model="ignoredEntryIdsByPart[part.key]"
              class="ignored-entry-list"
              @change="saveSettings">
              <el-checkbox v-for="entry in equipmentEntryListByPart[part.key]" :key="entry.id" :value="entry.id">
                <span class="ignored-entry-option">
                  <span class="ignored-entry-title">
                    <img v-if="getEntrySeasonLogo(entry)" :src="getEntrySeasonLogo(entry)" alt="" />
                    <span>{{ getIgnoredEntryLabel(entry) }}</span>
                  </span>
                  <small>{{ entry.name }}</small>
                </span>
              </el-checkbox>
            </el-checkbox-group>
          </el-collapse-item>
        </el-collapse>
      </section>
    </section>

    <el-backtop :right="24" :bottom="24" />
  </main>
</template>

<style scoped lang="scss">
.kaipao-settings-page {
  --kaipao-settings-sticky-top: calc(var(--header-height, 60px) + 12px);

  width: 100%;
  min-height: 100%;
  padding: 24px;
  box-sizing: border-box;
  color: var(--yh-text-color-primary, var(--el-text-color-primary));
  background: var(--yh-bg-color-page, var(--el-bg-color-page));
}

.settings-toolbar,
.settings-layout {
  max-width: 1180px;
  margin: 0 auto;
}

.settings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h1 {
    margin: 0;
    font-size: 24px;
    line-height: 1.4;
    font-weight: 700;
  }

  p {
    margin: 6px 0 0;
    color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
    font-size: 14px;
  }
}

.settings-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 16px;
}

.settings-nav {
  position: sticky;
  top: var(--kaipao-settings-sticky-top);
  z-index: 3;
  padding: 8px;
  border: 1px solid var(--yh-border-level-1-color, var(--el-border-color));
  border-radius: 8px;
  background: var(--yh-bg-color-container, var(--el-bg-color));
  align-self: start;

  button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border: 0;
    border-radius: 7px;
    color: var(--yh-text-color-primary, var(--el-text-color-primary));
    background: transparent;
    cursor: pointer;
    font-weight: 700;
    text-align: left;

    &.is-active {
      color: var(--yh-brand-color, var(--el-color-primary));
      background: color-mix(
        in srgb,
        var(--yh-brand-color, var(--el-color-primary)) 9%,
        var(--yh-bg-color-container, var(--el-bg-color))
      );
    }
  }
}

.settings-panel {
  padding: 16px;
  border: 1px solid var(--yh-border-level-1-color, var(--el-border-color));
  border-radius: 8px;
  background: var(--yh-bg-color-container, var(--el-bg-color));
  box-shadow: var(--yh-shadow-1, 0 8px 24px rgba(0, 0, 0, 0.06));
}

.settings-panel :deep(.el-collapse) {
  overflow: visible;
}

.settings-panel :deep(.el-collapse-item) {
  overflow: visible;
}

.settings-panel :deep(.el-collapse-item__header) {
  position: sticky;
  top: var(--kaipao-settings-sticky-top);
  z-index: 2;
  min-height: 52px;
  padding: 0 12px;
  border-radius: 7px;
  border-bottom: 1px solid var(--yh-border-level-1-color, var(--el-border-color-lighter));
  background: var(--yh-bg-color-container, var(--el-bg-color));
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.04);
}

.settings-panel :deep(.el-collapse-item__content) {
  max-height: 620px;
  overflow: auto;
  padding-right: 8px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--yh-border-level-1-color, var(--el-border-color-lighter));

  h2 {
    margin: 0;
    font-size: 18px;
    line-height: 1.4;
  }

  p {
    margin: 4px 0 0;
    color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
    font-size: 13px;
    line-height: 1.5;
  }
}

.settings-part-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--yh-text-color-primary, var(--el-text-color-primary));
  font-weight: 700;

  img {
    width: 28px;
    height: 28px;
    border-radius: 5px;
    object-fit: cover;
  }
}

.ignored-entry-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 2px 0 8px;
}

.ignored-entry-list :deep(.el-checkbox) {
  height: auto;
  min-height: 56px;
  align-items: flex-start;
  margin-right: 0;
  padding: 8px 10px;
  border: 1px solid var(--yh-border-level-1-color, var(--el-border-color-lighter));
  border-radius: 8px;
  background: var(--yh-bg-color-container, var(--el-bg-color));
  white-space: normal;
}

.ignored-entry-list :deep(.el-checkbox.is-checked) {
  border-color: color-mix(in srgb, var(--yh-brand-color, var(--el-color-primary)) 42%, transparent);
  background: color-mix(
    in srgb,
    var(--yh-brand-color, var(--el-color-primary)) 9%,
    var(--yh-bg-color-container, var(--el-bg-color))
  );
}

.ignored-entry-option {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  line-height: 1.35;

  span {
    color: var(--yh-text-color-primary, var(--el-text-color-primary));
    font-size: 13px;
    font-weight: 700;
    word-break: break-all;
  }

  small {
    color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
    font-size: 11px;
    word-break: break-all;
  }
}

.ignored-entry-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;

  img {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    border-radius: 5px;
    object-fit: cover;
  }

  span {
    min-width: 0;
  }
}

@media (max-width: 760px) {
  .kaipao-settings-page {
    --kaipao-settings-sticky-top: calc(var(--header-height, 50px) + 8px);

    padding: 14px;
  }

  .settings-toolbar {
    align-items: flex-start;
    flex-direction: column;

    h1 {
      font-size: 20px;
    }
  }

  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    top: var(--kaipao-settings-sticky-top);
  }

  .settings-panel :deep(.el-collapse-item__content) {
    max-height: 460px;
  }

  .ignored-entry-list {
    grid-template-columns: 1fr;
  }
}
</style>
