<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowDown, Check, Plus, RefreshLeft, Delete, Upload, Setting, Download } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { getZombieSavedEntryIds, postZombieSavedEntryIds } from "@/api";
import { RouterEnum } from "@/enums";
import { useUserStore } from "@/store";
import G1Logo from "@/assets/img/kaipao/G/logo/G1.png";
import G2Logo from "@/assets/img/kaipao/G/logo/G2.png";
import G3Logo from "@/assets/img/kaipao/G/logo/G3.png";
import BracerIcon from "@/assets/img/kaipao/equipment/hubi.png";
import PantsIcon from "@/assets/img/kaipao/equipment/kuzi.png";
import GlovesIcon from "@/assets/img/kaipao/equipment/shoutao.png";
import HelmetIcon from "@/assets/img/kaipao/equipment/toukui.png";
import BootsIcon from "@/assets/img/kaipao/equipment/xiezi.png";
import ClothesIcon from "@/assets/img/kaipao/equipment/yifu.png";
import {
  equipmentEntryListByPart,
  equipmentEntryMap,
  equipmentParts,
  type EquipmentEntry,
  type EquipmentPart,
  type EquipmentPartKey,
} from "./equipment-entry-data";
import {
  cloneIgnoredEntryIds,
  createEmptyIgnoredEntryIds,
  loadEquipmentEntrySettings,
  saveEquipmentEntrySettings,
  sanitizeIgnoredEntryIds,
  type EquipmentEntrySettings,
  type IgnoredEntryIdsByPart,
} from "./equipment-settings-storage";

type EntryRow = Record<EquipmentPartKey, string>;

interface EquipmentEntryExportData {
  rows: EntryRow[];
  settings: EquipmentEntrySettings;
}

const STORAGE_KEY = "kaipao_equipment_entry_ids";
const DEFAULT_ROW_COUNT = 6;
const userStore = useUserStore();
const router = useRouter();

const createEmptyRow = (): EntryRow => ({
  helmet: "",
  clothes: "",
  boots: "",
  bracer: "",
  pants: "",
  gloves: "",
});

const createDefaultRows = () => Array.from({ length: DEFAULT_ROW_COUNT }, createEmptyRow);

const tableRows = reactive<EntryRow[]>(createDefaultRows());
const ignoredEntryIdsByPart = reactive<IgnoredEntryIdsByPart>(createEmptyIgnoredEntryIds());
const openedCellKey = ref("");
const importFileRef = ref<HTMLInputElement>();
const state = reactive({
  showFullName: true,
  syncing: false,
});

const seasonLogoMap: Record<NonNullable<EquipmentEntry["season"]>, string> = {
  G1: G1Logo,
  G2: G2Logo,
  G3: G3Logo,
};

const partIconMap: Record<EquipmentPartKey, string> = {
  helmet: HelmetIcon,
  clothes: ClothesIcon,
  boots: BootsIcon,
  bracer: BracerIcon,
  pants: PantsIcon,
  gloves: GlovesIcon,
};

/**
 * 本地只保存词条 id；读取时用 map 校验 id 是否仍存在，避免旧缓存显示无效词条。
 *
 * 转换结构：
 * Partial<EntryRow> -> EntryRow
 *
 * 示例：
 * { helmet: "10000", clothes: "bad-id" }
 * -> { helmet: "10000", clothes: "", boots: "", bracer: "", pants: "", gloves: "" }
 */
const sanitizeRow = (row: Partial<EntryRow>) => {
  return equipmentParts.reduce((nextRow, part) => {
    const value = row[part.key] || "";
    nextRow[part.key] = value && equipmentEntryMap[value] ? value : "";
    return nextRow;
  }, createEmptyRow());
};

/**
 * 默认保持 6 行；如果本地已保存更多行，则按保存行数展示。
 *
 * 转换结构：
 * Partial<EntryRow>[] -> EntryRow[]
 *
 * 示例：
 * [{ helmet: "10000" }]
 * -> [已校验行, 空行, 空行, 空行, 空行, 空行]
 */
const normalizeRows = (rows: Partial<EntryRow>[]) => {
  return [...rows, ...createDefaultRows()].slice(0, Math.max(rows.length, DEFAULT_ROW_COUNT)).map(sanitizeRow);
};

/**
 * 记录每个部位当前已选的词条 id，用于下拉列表里隐藏同列已选项。
 *
 * 转换结构：
 * EntryRow[] -> Record<EquipmentPartKey, string[]>
 *
 * 示例：
 * [{ helmet: "10000", clothes: "20000" }, { helmet: "10001", clothes: "" }]
 * -> { helmet: ["10000", "10001"], clothes: ["20000"], boots: [], bracer: [], pants: [], gloves: [] }
 */
const selectedByPart = computed(() => {
  return equipmentParts.reduce(
    (selectedMap, part) => {
      selectedMap[part.key] = tableRows.map((row) => row[part.key]).filter(Boolean);
      return selectedMap;
    },
    {} as Record<EquipmentPartKey, string[]>,
  );
});

/**
 * 当前单元格已选项需要保留，其它行已选过的同部位词条从下拉候选中移除。
 *
 * 转换结构：
 * EquipmentEntry[] + 当前行 id + 同部位已选 id[] -> 当前单元格可选 EquipmentEntry[]
 *
 * 示例：
 * boots 全量 [30000, 30001, 30002]，其它行已选 [30001]，当前行已选 30000
 * -> 下拉保留 [30000, 30002]
 */
const getOptions = (part: EquipmentPart, row: EntryRow) => {
  const currentValue = row[part.key];
  const ignoredIds = ignoredEntryIdsByPart[part.key];
  return equipmentEntryListByPart[part.key].filter((entry) => {
    if (ignoredIds.includes(entry.id)) return false;
    return entry.id === currentValue || !selectedByPart.value[part.key].includes(entry.id);
  });
};

/**
 * 表格单元格只保存 id，展示时通过 id 查完整词条对象。
 *
 * 转换结构：
 * entryId -> EquipmentEntry | undefined
 *
 * 示例：
 * "60050" -> { id: "60050", name: "燃油弹伤害+28%，减速效果+14%" }
 */
const getEntry = (id: string) => {
  return id ? equipmentEntryMap[id] : undefined;
};

/**
 * 有简称优先展示简称；没有简称时直接展示完整描述。
 */
const getEntryDisplayName = (entry?: Pick<EquipmentEntry, "name" | "shortName">) => {
  return entry?.shortName || entry?.name || "";
};

/**
 * 赛季词条展示对应 G1/G2/G3 图片；普通词条不展示图标。
 */
const getEntrySeasonLogo = (entry?: Pick<EquipmentEntry, "season">) => {
  return entry?.season ? seasonLogoMap[entry.season] : "";
};

const getCellKey = (rowIndex: number, partKey: EquipmentPartKey) => {
  return `${rowIndex}-${partKey}`;
};

/**
 * Element Plus popover 用一个 cell key 控制展开，保证同一时间只有一个下拉弹窗打开。
 */
const setCellVisible = (rowIndex: number, partKey: EquipmentPartKey, visible: boolean) => {
  openedCellKey.value = visible ? getCellKey(rowIndex, partKey) : "";
};

/**
 * 选择后只写入词条 id，完整词条详情仍从 equipmentEntryMap 中按需读取。
 *
 * 转换结构：
 * EquipmentEntry -> EntryRow[partKey] = entry.id
 *
 * 示例：
 * 选择 { id: "40050", name: "..." } 后，当前行 pants 从 "" 变成 "40050"。
 */
const selectEntry = (row: EntryRow, part: EquipmentPart, entryId: string) => {
  row[part.key] = entryId;
  openedCellKey.value = "";
};

const clearEntry = (row: EntryRow, part: EquipmentPart) => {
  row[part.key] = "";
  openedCellKey.value = "";
};

const isSelectedEntry = (row: EntryRow, part: EquipmentPart, entryId: string) => {
  return row[part.key] === entryId;
};

const addRow = () => {
  tableRows.push(createEmptyRow());
};

const removeRow = (index: number) => {
  if (tableRows.length === 1) {
    tableRows[0] = createEmptyRow();
    return;
  }
  tableRows.splice(index, 1);
};

const resetRows = () => {
  openedCellKey.value = "";
  tableRows.splice(0, tableRows.length, ...createDefaultRows());
};

const goSettings = () => {
  router.push({ name: RouterEnum.XiangJiangshiKaipaoEquipmentSettings });
};

const saveToLocal = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tableRows));
};

const createExportData = (): EquipmentEntryExportData => ({
  rows: tableRows.map((row) => ({ ...row })),
  settings: {
    ignoredEntryIdsByPart: cloneIgnoredEntryIds(ignoredEntryIdsByPart),
  },
});

const saveSettingsToLocal = () => {
  saveEquipmentEntrySettings(createExportData().settings);
};

const applyIgnoredEntryIds = (settings?: Partial<EquipmentEntryExportData["settings"]>) => {
  const ignoredMap = sanitizeIgnoredEntryIds(settings);

  equipmentParts.forEach((part) => {
    ignoredEntryIdsByPart[part.key] = ignoredMap[part.key];
  });
};

const loadLocalRows = () => {
  const cache = localStorage.getItem(STORAGE_KEY);
  if (!cache) return;

  try {
    const parsedRows = JSON.parse(cache);
    if (Array.isArray(parsedRows)) {
      tableRows.splice(0, tableRows.length, ...normalizeRows(parsedRows));
    }
  } catch (err) {
    console.warn("读取向僵尸开炮装备词条缓存失败", err);
  }
};

const loadLocalSettings = () => {
  applyIgnoredEntryIds(loadEquipmentEntrySettings());
};

const applyExportData = (data: Partial<EquipmentEntryExportData>) => {
  if (Array.isArray(data.rows)) {
    tableRows.splice(0, tableRows.length, ...normalizeRows(data.rows));
  }
  applyIgnoredEntryIds(data.settings);
  saveToLocal();
  saveSettingsToLocal();
};

const loadBackendData = async () => {
  if (!userStore.getIslogin || state.syncing) return;

  state.syncing = true;
  try {
    const res = await getZombieSavedEntryIds();
    if (res.code === 200 && res.data) {
      applyExportData(res.data);
    }
  } catch (err: any) {
    console.warn("读取向僵尸开炮装备词条接口失败", err);
    ElMessage.warning({ message: err?.msg || "读取服务器保存数据失败，已使用本地缓存", plain: true });
  } finally {
    state.syncing = false;
  }
};

const exportJson = () => {
  const data = createExportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `kaipao-equipment-entries-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const triggerImportJson = () => {
  importFileRef.value?.click();
};

const importJson = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  try {
    const data = JSON.parse(await file.text()) as Partial<EquipmentEntryExportData>;
    if (!Array.isArray(data.rows)) {
      ElMessage.warning({ message: "导入文件缺少 rows 数据", plain: true });
      return;
    }

    applyExportData(data);
    ElMessage.success({ message: "导入成功", plain: true });
  } catch (err) {
    console.warn("导入向僵尸开炮装备词条失败", err);
    ElMessage.error({ message: "导入失败，请检查 JSON 文件格式", plain: true });
  }
};

const saveToBackend = async () => {
  const payload = createExportData();

  if (!userStore.getIslogin) {
    ElMessageBox.confirm("当前未登录，可以去登录后保存，或先导出 JSON 到本地。", "保存装备词条", {
      confirmButtonText: "去登录",
      cancelButtonText: "导出 JSON",
      distinguishCancelAndClose: true,
      type: "warning",
    })
      .then(() => {
        userStore.onModelLogin();
      })
      .catch((action) => {
        if (action === "cancel") {
          exportJson();
        }
      });
    return;
  }

  state.syncing = true;
  try {
    const res = await postZombieSavedEntryIds(payload);
    if (res.code === 200) {
      ElMessage.success({ message: "保存成功", plain: true });
      return;
    }
    ElMessage.error({ message: res.msg || "保存失败", plain: true });
  } catch (err: any) {
    console.warn("保存向僵尸开炮装备词条接口失败", err);
    ElMessage.error({ message: err?.msg || "保存失败，请稍后再试", plain: true });
  } finally {
    state.syncing = false;
  }
};

onMounted(() => {
  loadLocalRows();
  loadLocalSettings();
  loadBackendData();
});

watch(tableRows, saveToLocal, { deep: true });
watch(ignoredEntryIdsByPart, saveSettingsToLocal, { deep: true });
watch(
  () => userStore.getIslogin,
  (isLogin) => {
    if (isLogin) {
      loadBackendData();
    }
  },
);
</script>

<template>
  <main class="kaipao-page comments gaobug">
    <section class="kaipao-toolbar">
      <div>
        <h1>向僵尸开炮装备词条表</h1>
        <p>每个单元格保存固定词条 id，本地自动缓存；登录后可同步保存到服务器。</p>
      </div>
      <div class="toolbar-actions">
        <input ref="importFileRef" class="import-file-input" type="file" accept="application/json,.json" @change="importJson" />
        <el-button :icon="RefreshLeft" @click="resetRows">清空</el-button>
        <el-button :icon="Setting" @click="goSettings">设置</el-button>
        <el-button :icon="Download" @click="exportJson">导出</el-button>
        <el-button :icon="Upload" @click="triggerImportJson">导入</el-button>
        <el-button type="primary" :icon="Check" :loading="state.syncing" @click="saveToBackend">保存</el-button>
      </div>
    </section>

    <section class="entry-table-wrap">
      <table class="entry-table">
        <thead>
          <tr>
            <th class="index-column">序号</th>
            <th v-for="part in equipmentParts" :key="part.key">
              <span class="part-header">
                <img :src="partIconMap[part.key]" alt="" />
                <span>{{ part.label }}</span>
              </span>
            </th>
            <th class="action-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in tableRows" :key="rowIndex">
            <td class="index-column">{{ rowIndex + 1 }}</td>
            <td v-for="part in equipmentParts" :key="part.key" class="entry-cell">
              <el-popover
                :visible="openedCellKey === getCellKey(rowIndex, part.key)"
                :width="340"
                trigger="click"
                placement="bottom"
                :show-arrow="true"
                popper-class="kaipao-entry-popover"
                @update:visible="setCellVisible(rowIndex, part.key, $event)">
                <template #reference>
                  <el-button
                    link
                    class="entry-pick-button"
                    :aria-label="`${part.label}选择词条`"
                    :title="getEntry(row[part.key])?.name || `选择${part.label}词条`">
                    <el-icon><ArrowDown /></el-icon>
                  </el-button>
                </template>
                <div class="entry-dropdown">
                  <div class="entry-dropdown-head">
                    <strong>{{ part.label }}词条</strong>
                    <div class="flex">
                      <el-text size="small" type="primary">详情显示</el-text>
                      <el-switch class="ml-1" v-model="state.showFullName" size="small" />
                      <el-button class="ml-2" link size="small" v-if="row[part.key]" @click="clearEntry(row, part)"
                        >清空</el-button
                      >
                    </div>
                  </div>
                  <el-scrollbar max-height="480px" class="entry-dropdown-scroll">
                    <div class="entry-option-list">
                      <div
                        v-for="entry in getOptions(part, row)"
                        :key="entry.id"
                        class="entry-option-button"
                        :class="{ 'is-selected': isSelectedEntry(row, part, entry.id) }"
                        @click="selectEntry(row, part, entry.id)">
                        <span class="entry-option-text">
                          <span class="entry-title">
                            <img v-if="getEntrySeasonLogo(entry)" :src="getEntrySeasonLogo(entry)" alt="" />
                            <strong>{{ getEntryDisplayName(entry) }}</strong>
                          </span>
                          <span v-if="state.showFullName">{{ entry.name }}</span>
                        </span>
                        <el-icon v-if="isSelectedEntry(row, part, entry.id)" class="entry-option-check">
                          <Check />
                        </el-icon>
                      </div>
                    </div>
                  </el-scrollbar>
                </div>
              </el-popover>
              <div v-if="getEntry(row[part.key])" class="entry-brief-name">
                <img
                  v-if="getEntrySeasonLogo(getEntry(row[part.key]))"
                  :src="getEntrySeasonLogo(getEntry(row[part.key]))"
                  alt="" />
                <span>{{ getEntryDisplayName(getEntry(row[part.key])) }}</span>
              </div>
              <div v-if="getEntry(row[part.key])" class="entry-full-name" :title="getEntry(row[part.key])?.name">
                {{ getEntry(row[part.key])?.name }}
              </div>
            </td>
            <td class="action-column">
              <el-button :icon="Delete" text type="danger" aria-label="删除行" @click="removeRow(rowIndex)" />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="entry-table-actions">
        <el-button :icon="Plus" @click="addRow" style="width: 100%;"  plain dashed >加一行</el-button>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.kaipao-page {
  width: 100%;
  max-width: 100%;
  padding: 24px;
  box-sizing: border-box;
  color: var(--yh-text-color-primary, var(--el-text-color-primary));
  background: var(--yh-bg-color-page, var(--el-bg-color-page));
}

.kaipao-toolbar {
  max-width: 1180px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h1 {
    margin: 0;
    font-size: 24px;
    line-height: 1.4;
    font-weight: 700;
  }

  p {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
  }
}

.toolbar-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.import-file-input {
  display: none;
}

.entry-table-wrap {
  max-width: 1180px;
  margin: 0 auto;
  overflow: auto;
  border: 1px solid var(--yh-border-level-1-color, var(--el-border-color));
  border-radius: 8px;
  background: var(--yh-bg-color-container, var(--el-bg-color));
  box-shadow: var(--yh-shadow-1, 0 8px 24px rgba(0, 0, 0, 0.06));
}

.entry-table {
  width: 100%;
  min-width: 900px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 14px;

  th,
  td {
    height: 92px;
    padding: 6px 8px;
    border: 1px solid var(--yh-border-level-1-color, var(--el-border-color-lighter));
    text-align: center;
    background: var(--yh-bg-color-container, var(--el-bg-color));
    box-sizing: border-box;
    vertical-align: top;
  }

  th {
    height: 54px;
    font-size: 17px;
    font-weight: 700;
    vertical-align: middle;
    color: var(--yh-text-color-brand, var(--yh-brand-color, var(--el-color-primary)));
    background: var(--yh-brand-color-1, var(--el-color-primary-light-9));
  }

  .part-header {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    line-height: 1;
    white-space: nowrap;

    img {
      width: 28px;
      height: 28px;
      flex: 0 0 auto;
      border-radius: 5px;
      object-fit: cover;
    }
  }

  .index-column {
    width: 72px;
    font-weight: 700;
    vertical-align: middle;
  }

  .action-column {
    width: 64px;
    vertical-align: middle;
  }

  .entry-cell {
    position: relative;
    padding-right: 36px;
  }

  .entry-pick-button {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    width: 24px;
    height: 24px;
    cursor: pointer;
    padding: 0;
    transition:
      border-color 0.2s ease,
      color 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .entry-pick-button:hover {
    border-color: var(--yh-brand-color, var(--el-color-primary));
    color: var(--yh-brand-color, var(--el-color-primary));
    background: var(--yh-bg-color-container-hover, var(--el-color-primary-light-9));
    box-shadow: 0 4px 10px color-mix(in srgb, var(--yh-brand-color, var(--el-color-primary)) 18%, transparent);
    transform: translateY(-1px);
  }
}

.entry-full-name {
  margin-top: 4px;
  padding: 4px 5px 0;
  border-top: 1px solid var(--yh-border-level-1-color, var(--el-border-color-lighter));
  color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
  font-size: 11px;
  line-height: 1.32;
  text-align: left;
  word-break: break-all;
  white-space: normal;
}

.entry-brief-name {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
  color: var(--yh-text-color-primary, var(--el-text-color-primary));
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;

  img {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    border-radius: 4px;
    object-fit: cover;
  }

  span {
    min-width: 0;
    word-break: break-all;
  }
}

.entry-dropdown {
  width: 100%;
}

.entry-dropdown-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--yh-border-level-1-color, var(--el-border-color-lighter));

  strong {
    color: var(--yh-text-color-primary, var(--el-text-color-primary));
    font-size: 13px;
  }

  button {
    border: 0;
    color: var(--yh-brand-color, var(--el-color-primary));
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
  }
}

.entry-dropdown-scroll {
  margin: 6px -4px -4px 0;
  padding-right: 4px;
}

.entry-option-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entry-option-button {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--yh-text-color-primary, var(--el-text-color-primary));
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    color 0.16s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--yh-brand-color, var(--el-color-primary)) 34%, transparent);
    background: var(--yh-bg-color-container-hover, var(--el-color-primary-light-9));
  }

  &.is-selected {
    border-color: var(--yh-brand-color, var(--el-color-primary));
    background: color-mix(
      in srgb,
      var(--yh-brand-color, var(--el-color-primary)) 12%,
      var(--yh-bg-color-container, var(--el-bg-color))
    );
  }
}

.entry-option-text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  line-height: 1.42;

  strong {
    color: var(--yh-text-color-primary, var(--el-text-color-primary));
    font-size: 13px;
    font-weight: 700;
  }

  span {
    color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
    font-size: 11px;
    white-space: normal;
    word-break: break-all;
  }
}

.entry-title {
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
}

.entry-option-check {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--yh-brand-color, var(--el-color-primary));
}

:global(.kaipao-entry-popover.el-popper) {
  width: 340px;
  max-width: min(340px, calc(100vw - 32px));
  border: 1px solid var(--yh-border-level-1-color, var(--el-border-color-light));
  border-radius: 8px;
  box-shadow: var(--yh-shadow-3, 0 16px 36px rgba(0, 0, 0, 0.18));
  background: var(--yh-bg-color-container, var(--el-bg-color-overlay));
  overflow: hidden;
}

:global(.kaipao-entry-popover.el-popper .el-popover__content) {
  color: var(--yh-text-color-primary, var(--el-text-color-primary));
  background: var(--yh-bg-color-container, var(--el-bg-color-overlay));
}

:global(.kaipao-entry-popover.el-popper .el-popper__arrow::before) {
  border-color: var(--yh-border-level-1-color, var(--el-border-color-light));
  background: var(--yh-bg-color-container, var(--el-bg-color-overlay));
}

:global(.kaipao-entry-popover.el-popper .el-popover__title) {
  display: none;
}

@media (max-width: 760px) {
  .kaipao-page {
    padding: 14px;
  }

  .kaipao-toolbar {
    align-items: flex-start;
    flex-direction: column;

    h1 {
      font-size: 20px;
    }
  }

  .toolbar-actions {
    width: 100%;
    justify-content: flex-start;
  }

}
</style>
