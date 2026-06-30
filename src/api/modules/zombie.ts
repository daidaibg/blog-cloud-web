import { requestGet, requestPost } from "../api";

export type ZombieEquipmentPartKey = "helmet" | "clothes" | "boots" | "bracer" | "pants" | "gloves";

/** 装备词条表格的一行数据，每个部位只保存词条 id。 */
export type ZombieEquipmentEntryRow = Record<ZombieEquipmentPartKey, string>;

export interface ZombieEquipmentEntrySettings {
  /** 按装备部位保存的忽略词条 id 列表。 */
  ignoredEntryIdsByPart: Record<ZombieEquipmentPartKey, string[]>;
  /** 是否在表格和导出图片中展示词条完整详情。 */
  showFullName: boolean;
}

export interface ZombieSavedEntryPayload {
  /** 装备词条表格完整行数据。 */
  rows: ZombieEquipmentEntryRow[];
  /** 表格附加配置，例如忽略词条和详情展示开关。 */
  settings: ZombieEquipmentEntrySettings;
}

export interface ZombieSavedEntryResponse {
  code: number;
  msg: string;
  data?: ZombieSavedEntryPayload | null;
}

const ZombieApi = {
  savedEntryIds: "/tool/zombie/saved-entry-ids",
};

export const getZombieSavedEntryIds = () => {
  return requestGet<Record<string, never>, ZombieSavedEntryResponse>(ZombieApi.savedEntryIds, {});
};

export const postZombieSavedEntryIds = (param: ZombieSavedEntryPayload) => {
  return requestPost<ZombieSavedEntryPayload, ZombieSavedEntryResponse>(ZombieApi.savedEntryIds, param);
};
