<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowDown, Check, Plus, RefreshLeft, Delete, Setting, Download, Hide, Cloudy, Top, Bottom } from "@element-plus/icons-vue";
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
  clearEquipmentEntryLocalConfig,
  cloneIgnoredEntryIds,
  createEmptyIgnoredEntryIds,
  createDefaultEquipmentEntryRows,
  createEmptyEquipmentEntryRow,
  createEquipmentEntryExportData,
  hasEquipmentEntryLocalConfig,
  loadEquipmentEntryRows,
  loadEquipmentEntrySettings,
  normalizeEquipmentEntryRows,
  saveEquipmentEntryRows,
  saveEquipmentEntrySettings,
  defaultSettings,
  type EquipmentEntryExportData,
  type EquipmentEntryRow,
  sanitizeIgnoredEntryIds,
  type EquipmentEntrySettings,
  type IgnoredEntryIdsByPart,
} from "./equipment-settings-storage";

type EntryRow = EquipmentEntryRow;

const userStore = useUserStore();
const router = useRouter();
const route = useRoute();

const tableRows = reactive<EntryRow[]>(createDefaultEquipmentEntryRows());
const ignoredEntryIdsByPart = reactive<IgnoredEntryIdsByPart>(createEmptyIgnoredEntryIds());
const openedCellKey = ref("");
const state = reactive({
  showFullName: true,
  syncing: false,
  exportingImage: false,
  suppressLocalSave: false,
  hasLocalConfig: false,
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

const clearPart = (part: EquipmentPart) => {
  tableRows.forEach((row) => {
    row[part.key] = "";
  });
  openedCellKey.value = "";
  ElMessage.success({ message: `已清空${part.label}`, plain: true });
};

const isSelectedEntry = (row: EntryRow, part: EquipmentPart, entryId: string) => {
  return row[part.key] === entryId;
};

const moveEntry = (rowIndex: number, part: EquipmentPart, direction: -1 | 1) => {
  const nextIndex = rowIndex + direction;
  if (nextIndex < 0 || nextIndex >= tableRows.length) return;

  const currentValue = tableRows[rowIndex][part.key];
  if (!currentValue) return;

  tableRows[rowIndex][part.key] = tableRows[nextIndex][part.key];
  tableRows[nextIndex][part.key] = currentValue;
  openedCellKey.value = "";
};

const ignoreEntry = (part: EquipmentPart, entry: EquipmentEntry) => {
  const ignoredIds = ignoredEntryIdsByPart[part.key];
  if (ignoredIds.includes(entry.id)) return;

  ignoredEntryIdsByPart[part.key] = [...ignoredIds, entry.id];
  ElMessage.success({ message: `已忽略：${getEntryDisplayName(entry)}`, plain: true });
};

const addRow = () => {
  tableRows.push(createEmptyEquipmentEntryRow());
};

const removeRow = (index: number) => {
  if (tableRows.length === 1) {
    tableRows[0] = createEmptyEquipmentEntryRow();
    return;
  }
  tableRows.splice(index, 1);
};

const resetRows = () => {
  openedCellKey.value = "";
  tableRows.splice(0, tableRows.length, ...createDefaultEquipmentEntryRows());
};

const goSettings = () => {
  router.push({ name: RouterEnum.XiangJiangshiKaipaoEquipmentSettings });
};

const saveToLocal = () => {
  saveEquipmentEntryRows(tableRows);
  state.hasLocalConfig = true;
};

const createExportData = (): EquipmentEntryExportData => ({
  ...createEquipmentEntryExportData(tableRows, {
    ignoredEntryIdsByPart: cloneIgnoredEntryIds(ignoredEntryIdsByPart),
    showFullName: state.showFullName,
  }),
});

const saveSettingsToLocal = () => {
  saveEquipmentEntrySettings(createExportData().settings);
  state.hasLocalConfig = true;
};

const applyIgnoredEntryIds = (settings?: Partial<EquipmentEntryExportData["settings"]>) => {
  const ignoredMap = sanitizeIgnoredEntryIds(settings);
console.log(111,ignoredMap,settings);
  equipmentParts.forEach((part) => {
    ignoredEntryIdsByPart[part.key] = ignoredMap[part.key];
  });
};

const loadLocalRows = () => {
  tableRows.splice(0, tableRows.length, ...loadEquipmentEntryRows());
};

const loadLocalSettings = () => {
  const settings = loadEquipmentEntrySettings();
  applyIgnoredEntryIds(settings);
  state.showFullName = settings.showFullName;
};

const applyDefaultConfig = () => {
  tableRows.splice(0, tableRows.length, ...createDefaultEquipmentEntryRows());
  applyIgnoredEntryIds(defaultSettings);
  state.showFullName = defaultSettings.showFullName;
};

const loadInitialConfig = async () => {
  state.suppressLocalSave = true;
  state.hasLocalConfig = hasEquipmentEntryLocalConfig();

  try {
    if (state.hasLocalConfig) {
      loadLocalRows();
      loadLocalSettings();
      return;
    }

    if (userStore.getIslogin) {
      const hasCloudConfig = await loadBackendData(true, "读取云端配置失败，已使用默认配置");
      state.hasLocalConfig = hasCloudConfig === true || hasEquipmentEntryLocalConfig();
      if (hasCloudConfig) return;
    }

    applyDefaultConfig();
  } finally {
    await nextTick();
    state.suppressLocalSave = false;
  }
};

const applyExportData = (data: Partial<EquipmentEntryExportData>, persistLocal = true) => {
  if (Array.isArray(data.rows)) {
    tableRows.splice(0, tableRows.length, ...normalizeEquipmentEntryRows(data.rows));
  }
  applyIgnoredEntryIds(data.settings);
  if (typeof data.settings?.showFullName === "boolean") {
    state.showFullName = data.settings.showFullName;
  }
  if (persistLocal) {
    saveToLocal();
    saveSettingsToLocal();
  }
};

/**
 * 加载在线配置
 */
const loadBackendData = async (persistLocal = true, warningMessage = "读取服务器保存数据失败，已使用本地缓存") => {
  if (!userStore.getIslogin || state.syncing) return false;

  state.syncing = true;
  try {
    const res = await getZombieSavedEntryIds();
    if (res.code === 200 && res.data) {
      applyExportData(res.data, persistLocal);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn("读取向僵尸开炮装备词条接口失败", err);
    ElMessage.warning({ message: err?.msg || warningMessage, plain: true });
    return null;
  } finally {
    state.syncing = false;
  }
};

/**
 * 从云端同步装备词条
 */
const useCloudConfig = async () => {
  if (!userStore.getIslogin || state.syncing) return;

  state.hasLocalConfig = false;
  state.suppressLocalSave = true;
  try {
    // tableRows.splice(0, tableRows.length, ...createDefaultEquipmentEntryRows());
    // applyIgnoredEntryIds();
    // state.showFullName = true;
    const hasCloudConfig = await loadBackendData(false, "读取云端配置失败，本地配置已清空");
    if (hasCloudConfig === null) return;
    if (!hasCloudConfig) {
      applyDefaultConfig();
    }
    clearEquipmentEntryLocalConfig();
    ElMessage.success({ message: hasCloudConfig ? "已切换为云端配置" : "本地配置已清空，暂无云端配置", plain: true });
  } finally {
    state.suppressLocalSave = false;
  }
};

const downloadUrl = (url: string, filename: string) => {
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const drawWrappedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) => {
  const chars = text.split("");
  const lines: string[] = [];
  let line = "";

  chars.forEach((char) => {
    const testLine = `${line}${char}`;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
      return;
    }
    line = testLine;
  });
  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((lineText, index, visibleLines) => {
    const isLastLine = index === visibleLines.length - 1 && lines.length > maxLines;
    const displayText = isLastLine ? `${lineText.slice(0, Math.max(0, lineText.length - 1))}...` : lineText;
    context.fillText(displayText, x, y + index * lineHeight);
  });
};

const exportImage = async () => {
  if (state.exportingImage) return;

  state.exportingImage = true;
  try {
    const scale = window.devicePixelRatio || 1;
    const columnWidths = [64, ...equipmentParts.map(() => 164), 0];
    const rowHeight = state.showFullName ? 110 : 74;
    const headerHeight = 54;
    const width = columnWidths.reduce((total, width) => total + width, 0);
    const height = headerHeight + tableRows.length * rowHeight;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(scale, scale);

    const seasonLogos = await Promise.all(
      Object.entries(seasonLogoMap).map(async ([season, logo]) => [season, await loadImage(logo)] as const),
    );
    const seasonLogoImages = Object.fromEntries(seasonLogos) as Record<NonNullable<EquipmentEntry["season"]>, HTMLImageElement>;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#dcdfe6";
    context.lineWidth = 1;

    let left = 0;
    context.fillStyle = "#ecf5ff";
    context.fillRect(0, 0, width, headerHeight);
    context.fillStyle = "#409eff";
    context.font = "700 16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("序号", columnWidths[0] / 2, headerHeight / 2);
    left += columnWidths[0];
    equipmentParts.forEach((part, index) => {
      context.fillText(part.label, left + columnWidths[index + 1] / 2, headerHeight / 2);
      left += columnWidths[index + 1];
    });

    context.strokeRect(0, 0, width, headerHeight);
    left = 0;
    columnWidths.forEach((columnWidth) => {
      context.strokeRect(left, 0, columnWidth, height);
      left += columnWidth;
    });

    tableRows.forEach((row, rowIndex) => {
      const top = headerHeight + rowIndex * rowHeight;
      context.strokeRect(0, top, width, rowHeight);
      context.fillStyle = "#303133";
      context.font = "700 14px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(rowIndex + 1), columnWidths[0] / 2, top + rowHeight / 2);

      let cellLeft = columnWidths[0];
      equipmentParts.forEach((part, partIndex) => {
        const entry = getEntry(row[part.key]);
        const cellWidth = columnWidths[partIndex + 1];
        const textLeft = cellLeft + 10;
        let textTop = top + 18;

        context.strokeRect(cellLeft, top, cellWidth, rowHeight);
        if (entry) {
          if (entry.season) {
            const image = seasonLogoImages[entry.season];
            context.drawImage(image, textLeft, textTop - 9, 24, 24);
            context.fillStyle = "#303133";
            context.font = "700 13px sans-serif";
            context.textAlign = "left";
            context.textBaseline = "top";
            drawWrappedText(context, getEntryDisplayName(entry), textLeft + 30, textTop - 5, cellWidth - 48, 17, 2);
            textTop += 34;
          } else {
            context.fillStyle = "#303133";
            context.font = "700 13px sans-serif";
            context.textAlign = "left";
            context.textBaseline = "top";
            drawWrappedText(context, getEntryDisplayName(entry), textLeft, textTop - 5, cellWidth - 20, 17, 2);
            textTop += 34;
          }

          if (state.showFullName) {
            context.fillStyle = "#909399";
            context.font = "11px sans-serif";
            drawWrappedText(context, entry.name, textLeft, textTop, cellWidth - 20, 15, 4);
          }
        }
        cellLeft += cellWidth;
      });
    });

    downloadUrl(canvas.toDataURL("image/png"), `kaipao-equipment-entries-${Date.now()}.png`);
  } catch (err) {
    console.warn("导出向僵尸开炮装备词条图片失败", err);
    ElMessage.error({ message: "导出图片失败，请稍后再试", plain: true });
  } finally {
    state.exportingImage = false;
  }
};

const saveToBackend = async () => {
  const payload = createExportData();

  if (!userStore.getIslogin) {
    ElMessageBox.confirm("当前未登录，可以去登录后保存。", "保存装备词条", {
      confirmButtonText: "去登录",
      cancelButtonText: "取消",
      type: "warning",
    })
      .then(() => {
        userStore.onModelLogin(route.fullPath);
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
  loadInitialConfig();
});

watch(tableRows, () => {
  if (!state.suppressLocalSave) {
    saveToLocal();
  }
}, { deep: true });
watch(ignoredEntryIdsByPart, () => {
  if (!state.suppressLocalSave) {
    saveSettingsToLocal();
  }
}, { deep: true });
watch(() => state.showFullName, () => {
  if (!state.suppressLocalSave) {
    saveSettingsToLocal();
  }
});
watch(
  () => userStore.getIslogin,
  (isLogin) => {
    if (isLogin && !state.hasLocalConfig) {
      state.suppressLocalSave = true;
      loadBackendData(true, "读取云端配置失败，已使用默认配置")
        .then((hasCloudConfig) => {
          state.hasLocalConfig = hasCloudConfig === true || hasEquipmentEntryLocalConfig();
          if (!hasCloudConfig) {
            applyDefaultConfig();
          }
        })
        .finally(async () => {
          await nextTick();
          state.suppressLocalSave = false;
        });
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
        <div class="detail-toggle toolbar-3d-control">
          <span>详情</span>
          <el-switch v-model="state.showFullName" size="small" />
        </div>
        <el-button class="toolbar-3d-button is-reset" :icon="RefreshLeft" title="清空全部" @click="resetRows">清空</el-button>
        <el-button class="toolbar-3d-button is-settings" :icon="Setting" title="设置忽略词条" @click="goSettings">设置</el-button>
        <el-button
          v-if="userStore.getIslogin"
          class="toolbar-3d-button is-cloud"
          :icon="Cloudy"
          title="展示云端配置"
          :loading="state.syncing"
          @click="useCloudConfig">
          云端配置
        </el-button>
        <el-button
          class="toolbar-3d-button is-export"
          :icon="Download"
          title="导出图片"
          :loading="state.exportingImage"
          @click="exportImage">
          图片
        </el-button>
        <el-button
          class="toolbar-3d-button is-save"
          type="primary"
          :icon="Check"
          title="保存到服务器"
          :loading="state.syncing"
          @click="saveToBackend">
          保存
        </el-button>
      </div>
    </section>

    <section class="entry-table-wrap">
      <table class="entry-table" :class="{ 'is-compact': !state.showFullName }">
        <thead>
          <tr>
            <th class="index-column">序号</th>
            <th v-for="part in equipmentParts" :key="part.key">
              <span class="part-header">
                <span class="part-header-main">
                  <img :src="partIconMap[part.key]" alt="" />
                  <span>{{ part.label }}</span>
                </span>
                <el-button
                  class="part-clear-button"
                  :icon="Delete"
                  circle
                  text
                  size="small"
                  :disabled="!selectedByPart[part.key].length"
                  :title="`清空全部${part.label}`"
                  @click="clearPart(part)" />
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
                    <el-button link size="small" v-if="row[part.key]" :icon="Delete" @click="clearEntry(row, part)">清空</el-button>
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
                        <span class="entry-option-actions">
                          <el-icon v-if="isSelectedEntry(row, part, entry.id)" class="entry-option-check">
                            <Check />
                          </el-icon>
                          <el-button
                            class="entry-ignore-button"
                            :icon="Hide"
                            link
                            size="small"
                            :title="`忽略${getEntryDisplayName(entry)}`"
                            @click.stop="ignoreEntry(part, entry)">
                            忽略
                          </el-button>
                        </span>
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
              <div
                v-if="state.showFullName && getEntry(row[part.key])"
                class="entry-full-name"
                :title="getEntry(row[part.key])?.name">
                {{ getEntry(row[part.key])?.name }}
              </div>
              <div v-if="getEntry(row[part.key])" class="entry-cell-move-actions">
                <el-button
                  :icon="Top"
                  text
                  circle
                  size="small"
                  :disabled="rowIndex === 0"
                  :aria-label="`${part.label}上移`"
                  :title="`${part.label}上移`"
                  @click.stop="moveEntry(rowIndex, part, -1)" />
                <el-button
                  :icon="Bottom"
                  text
                  circle
                  size="small"
                  :disabled="rowIndex === tableRows.length - 1"
                  :aria-label="`${part.label}下移`"
                  :title="`${part.label}下移`"
                  @click.stop="moveEntry(rowIndex, part, 1)" />
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
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toolbar-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.detail-toggle {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 10px;
  color: #385167;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(225, 241, 255, 0.42)),
    rgba(241, 249, 255, 0.58);
  backdrop-filter: blur(14px) saturate(1.35);
  box-shadow:
    0 10px 24px rgba(93, 130, 160, 0.16),
    0 2px 5px rgba(255, 255, 255, 0.72) inset,
    0 -1px 3px rgba(100, 130, 160, 0.12) inset;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.toolbar-3d-control {
  transform: translateY(-1px);
}

.toolbar-3d-button {
  min-width: 74px;
  height: 32px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 10px;
  color: #24394d;
  font-size: 13px;
  font-weight: 800;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(235, 247, 255, 0.48)),
    rgba(244, 250, 255, 0.62);
  backdrop-filter: blur(14px) saturate(1.35);
  box-shadow:
    0 10px 24px rgba(67, 99, 130, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 -1px 3px rgba(75, 95, 125, 0.12) inset;
  transform: translateY(-1px);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    filter 0.16s ease,
    background 0.16s ease;

  &:hover {
    color: #142b3f;
    transform: translateY(-3px);
    filter: saturate(1.12) brightness(1.03);
    box-shadow:
      0 14px 28px rgba(67, 99, 130, 0.2),
      0 2px 0 rgba(255, 255, 255, 0.82) inset,
      0 -1px 4px rgba(75, 95, 125, 0.13) inset;
  }

  &:active {
    transform: translateY(1px);
    box-shadow:
      0 5px 12px rgba(67, 99, 130, 0.14),
      0 2px 5px rgba(40, 70, 100, 0.12) inset,
      0 1px 0 rgba(255, 255, 255, 0.58) inset;
  }

  &.is-reset {
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.84), rgba(255, 226, 184, 0.5)),
      rgba(255, 240, 216, 0.58);
  }

  &.is-settings {
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(189, 226, 255, 0.52)),
      rgba(223, 242, 255, 0.58);
  }

  &.is-export {
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(192, 240, 205, 0.5)),
      rgba(230, 250, 235, 0.58);
  }

  &.is-cloud {
    min-width: 98px;
    color: #26315e;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(209, 209, 255, 0.54)),
      rgba(232, 231, 255, 0.6);
  }

  &.is-save {
    color: #17416e;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(168, 216, 255, 0.58)),
      rgba(218, 239, 255, 0.64);
    box-shadow:
      0 12px 26px rgba(49, 123, 192, 0.22),
      0 1px 0 rgba(255, 255, 255, 0.82) inset,
      0 -1px 4px rgba(55, 105, 150, 0.16) inset;
  }
}

.toolbar-3d-button :deep(.el-icon) {
  font-size: 15px;
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

  &.is-compact {
    td {
      height: 58px;
      padding-top: 5px;
      padding-bottom: 5px;
      vertical-align: middle;
    }

    .entry-cell {
      padding-right: 56px;
    }

    .entry-cell-move-actions {
      right: 4px;
      bottom: 4px;
      gap: 2px;

      :deep(.el-button) {
        width: 20px;
        height: 18px;
        min-height: 18px;
      }
    }

    .entry-brief-name {
      margin-top: 0;
      font-size: 12px;
      line-height: 1.2;

      img {
        width: 22px;
        height: 22px;
      }
    }
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
    gap: 4px;
    line-height: 1;
    white-space: nowrap;
  }

  .part-header-main {
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

  .part-clear-button {
    width: 22px;
    height: 22px;
    min-height: 22px;
    padding: 0;
    color: var(--yh-text-color-secondary, var(--el-text-color-secondary));

    &:not(.is-disabled):hover {
      color: var(--yh-danger-color, var(--el-color-danger));
      background: color-mix(
        in srgb,
        var(--yh-danger-color, var(--el-color-danger)) 10%,
        var(--yh-bg-color-container, var(--el-bg-color))
      );
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
    padding-right: 58px;
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

  .entry-cell-move-actions {
    position: absolute;
    right: 6px;
    bottom: 6px;
    z-index: 2;
    display: inline-flex;
    gap: 2px;

    :deep(.el-button) {
      width: 20px;
      height: 20px;
      min-height: 20px;
      margin-left: 0;
      color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
      background: transparent;
      transition:
        color 0.18s ease,
        background 0.18s ease,
        transform 0.18s ease;
    }

    :deep(.el-button:hover:not(.is-disabled)) {
      color: var(--yh-brand-color, var(--el-color-primary));
      background: var(--yh-bg-color-container-hover, var(--el-color-primary-light-9));
      transform: translateY(-1px);
    }

    :deep(.el-button.is-disabled) {
      opacity: 0.36;
    }
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
  min-height: 30px;
  padding: 2px 4px 8px;
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
  padding: 8px 8px 8px 10px;
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

.entry-option-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  margin-top: -2px;
}

.entry-ignore-button {
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  color: var(--yh-text-color-secondary, var(--el-text-color-secondary));
  font-size: 12px;

  &:hover {
    color: var(--yh-warning-color, var(--el-color-warning));
    background: color-mix(
      in srgb,
      var(--yh-warning-color, var(--el-color-warning)) 12%,
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
