import { equipmentEntryListByPart, equipmentParts, type EquipmentPartKey } from "./equipment-entry-data";

export type IgnoredEntryIdsByPart = Record<EquipmentPartKey, string[]>;

export interface EquipmentEntrySettings {
  ignoredEntryIdsByPart: IgnoredEntryIdsByPart;
}

const SETTINGS_STORAGE_KEY = "kaipao_equipment_entry_settings";

export const createEmptyIgnoredEntryIds = (): IgnoredEntryIdsByPart => ({
  helmet: [],
  clothes: [],
  boots: [],
  bracer: [],
  pants: [],
  gloves: [],
});

export const cloneIgnoredEntryIds = (ignoredEntryIdsByPart: IgnoredEntryIdsByPart) => {
  return equipmentParts.reduce((ignoredMap, part) => {
    ignoredMap[part.key] = [...ignoredEntryIdsByPart[part.key]];
    return ignoredMap;
  }, createEmptyIgnoredEntryIds());
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

export const loadEquipmentEntrySettings = () => {
  const cache = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!cache) return { ignoredEntryIdsByPart: createEmptyIgnoredEntryIds() };

  try {
    return {
      ignoredEntryIdsByPart: sanitizeIgnoredEntryIds(JSON.parse(cache)),
    };
  } catch (err) {
    console.warn("读取向僵尸开炮装备词条设置缓存失败", err);
    return { ignoredEntryIdsByPart: createEmptyIgnoredEntryIds() };
  }
};

export const saveEquipmentEntrySettings = (settings: EquipmentEntrySettings) => {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ignoredEntryIdsByPart: sanitizeIgnoredEntryIds(settings),
    }),
  );
};
