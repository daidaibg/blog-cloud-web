import { equipmentEntryListByPart, equipmentEntryMap, equipmentParts, type EquipmentPartKey } from "./equipment-entry-data";

/** 按装备部位分组保存被忽略的词条 id 列表。 */
export type IgnoredEntryIdsByPart = Record<EquipmentPartKey, string[]>;

/** 表格中的一行配置，每个装备部位只保存已选择的词条 id。 */
export type EquipmentEntryRow = Record<EquipmentPartKey, string>;

export interface EquipmentEntrySettings {
  /** 设置页和下拉框共用的忽略词条配置。 */
  ignoredEntryIdsByPart: IgnoredEntryIdsByPart;
  /** 是否展示词条完整详情。 */
  showFullName: boolean;
}

export interface EquipmentEntryExportData {
  /** 表格完整行数据，用于本地缓存、云端同步和 JSON 导入导出。 */
  rows: EquipmentEntryRow[];
  /** 表格之外的设置项，例如忽略词条。 */
  settings: EquipmentEntrySettings;
}

const ENTRY_IDS_STORAGE_KEY = "kaipao_equipment_entry_ids";
const SETTINGS_STORAGE_KEY = "kaipao_equipment_entry_settings";
const DEFAULT_ROW_COUNT = 6;
const DEFAULT_SHOW_FULL_NAME = true;

export const createEmptyIgnoredEntryIds = (): IgnoredEntryIdsByPart => ({
  helmet: [],
  clothes: [],
  boots: [],
  bracer: [],
  pants: [],
  gloves: [],
});

export const createEmptyEquipmentEntryRow = (): EquipmentEntryRow => ({
  helmet: "",
  clothes: "",
  boots: "",
  bracer: "",
  pants: "",
  gloves: "",
});

export const createDefaultEquipmentEntryRows = () =>
  Array.from({ length: DEFAULT_ROW_COUNT }, createEmptyEquipmentEntryRow);

export const cloneIgnoredEntryIds = (ignoredEntryIdsByPart: IgnoredEntryIdsByPart) => {
  return equipmentParts.reduce((ignoredMap, part) => {
    ignoredMap[part.key] = [...ignoredEntryIdsByPart[part.key]];
    return ignoredMap;
  }, createEmptyIgnoredEntryIds());
};

export const sanitizeEquipmentEntryRow = (row: Partial<EquipmentEntryRow>) => {
  return equipmentParts.reduce((nextRow, part) => {
    const value = row[part.key] || "";
    nextRow[part.key] = value && equipmentEntryMap[value] ? value : "";
    return nextRow;
  }, createEmptyEquipmentEntryRow());
};

export const normalizeEquipmentEntryRows = (rows: Partial<EquipmentEntryRow>[]) => {
  return [...rows, ...createDefaultEquipmentEntryRows()]
    .slice(0, Math.max(rows.length, DEFAULT_ROW_COUNT))
    .map(sanitizeEquipmentEntryRow);
};

/**
 * 清洗本地设置里的忽略词条 id，只保留当前部位全量词条列表中存在的 id。
 *
 * 数据转换结构：
 * Partial<EquipmentEntrySettings> -> EquipmentEntrySettings["ignoredEntryIdsByPart"]
 *
 * 示例：
 * { ignoredEntryIdsByPart: { helmet: ["10000", "60000", "bad-id"] } }
 * -> { helmet: ["10000"], clothes: [], boots: [], bracer: [], pants: [], gloves: [] }
 */
export const sanitizeIgnoredEntryIds = (settings?: Partial<EquipmentEntrySettings>) => {
  const ignoredMap = settings?.ignoredEntryIdsByPart || createEmptyIgnoredEntryIds();

  return equipmentParts.reduce((nextIgnoredMap, part) => {
    const entryIds = Array.isArray(ignoredMap[part.key]) ? ignoredMap[part.key] : [];
    const partEntryIds = new Set(equipmentEntryListByPart[part.key].map((entry) => entry.id));
    nextIgnoredMap[part.key] = entryIds.filter((entryId) => partEntryIds.has(entryId));
    return nextIgnoredMap;
  }, createEmptyIgnoredEntryIds());
};

export const sanitizeEquipmentEntrySettings = (settings?: Partial<EquipmentEntrySettings>): EquipmentEntrySettings => ({
  ignoredEntryIdsByPart: sanitizeIgnoredEntryIds(settings),
  showFullName: typeof settings?.showFullName === "boolean" ? settings.showFullName : DEFAULT_SHOW_FULL_NAME,
});

export const loadEquipmentEntrySettings = () => {
  const cache = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!cache) return sanitizeEquipmentEntrySettings();

  try {
    return sanitizeEquipmentEntrySettings(JSON.parse(cache));
  } catch (err) {
    console.warn("读取向僵尸开炮装备词条设置缓存失败", err);
    return sanitizeEquipmentEntrySettings();
  }
};

/**
 * -是否存在本地缓存的装备词条配置（包括表格行数据和设置项）。
 * @returns { boolean } true 表示存在缓存，false 表示不存在缓存
 */
export const hasEquipmentEntryLocalConfig = () => {
  return Boolean(localStorage.getItem(ENTRY_IDS_STORAGE_KEY) || localStorage.getItem(SETTINGS_STORAGE_KEY));
};

export const saveEquipmentEntrySettings = (settings: EquipmentEntrySettings) => {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...sanitizeEquipmentEntrySettings(settings),
    }),
  );
};

export const loadEquipmentEntryRows = () => {
  const cache = localStorage.getItem(ENTRY_IDS_STORAGE_KEY);
  if (!cache) return createDefaultEquipmentEntryRows();

  try {
    const parsedRows = JSON.parse(cache);
    return Array.isArray(parsedRows) ? normalizeEquipmentEntryRows(parsedRows) : createDefaultEquipmentEntryRows();
  } catch (err) {
    console.warn("读取向僵尸开炮装备词条缓存失败", err);
    return createDefaultEquipmentEntryRows();
  }
};

export const saveEquipmentEntryRows = (rows: EquipmentEntryRow[]) => {
  localStorage.setItem(ENTRY_IDS_STORAGE_KEY, JSON.stringify(rows));
};

export const clearEquipmentEntryLocalConfig = () => {
  localStorage.removeItem(ENTRY_IDS_STORAGE_KEY);
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
};

export const createEquipmentEntryExportData = (
  rows: EquipmentEntryRow[],
  settings: EquipmentEntrySettings,
): EquipmentEntryExportData => ({
  rows: rows.map((row) => ({ ...row })),
  settings: sanitizeEquipmentEntrySettings(settings),
});


export const defaultSettings: EquipmentEntrySettings = {
    "ignoredEntryIdsByPart": {
        "helmet": [
            "10015",
            "10018",
            "10020",
            "10022",
            "10024",
            "10028",
            "10036",
            "10038",
            "10040",
            "10042",
            "10044",
            "10048",
            "10050",
            "10045",
            "10039",
            "10037",
            "10025",
            "10023",
            "10021",
            "10010"
        ],
        "clothes": [
            "20013",
            "20016",
            "20018",
            "20020",
            "20022",
            "20024",
            "20019",
            "20021",
            "20023",
            "20035",
            "20037",
            "20038",
            "20040",
            "20042",
            "20048",
            "20043",
            "20045",
            "20047",
            "20049"
        ],
        "boots": [
            "30016",
            "30014",
            "30017",
            "30019",
            "30020",
            "30021",
            "30035",
            "30041",
            "30043",
            "30046",
            "30024",
            "30005"
        ],
        "bracer": [
            "50014",
            "50016",
            "50017",
            "50019",
            "50020",
            "50021",
            "50051",
            "50049",
            "50045",
            "50043",
            "50012",
            "50042",
            "50040"
        ],
        "pants": [
            "40050",
            "40049",
            "40045",
            "40043",
            "40042",
            "40026",
            "40038",
            "40037",
            "40041",
            "40010",
            "40017",
            "40016",
            "40019",
            "40021",
            "40020"
        ],
        "gloves": [
            "60022",
            "60040",
            "60045",
            "60047",
            "60043",
            "60050",
            "60021",
            "60020",
            "60018",
            "60017",
            "60015",
            "60011",
            "60009",
            "60006",
            "60008",
            "60007",
            "60010"
        ]
    },
    "showFullName": false
};
