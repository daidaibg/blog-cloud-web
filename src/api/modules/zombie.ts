import { requestGet, requestPost } from "../api";

export type ZombieEquipmentPartKey = "helmet" | "clothes" | "boots" | "bracer" | "pants" | "gloves";

export type ZombieEquipmentEntryRow = Record<ZombieEquipmentPartKey, string>;

export interface ZombieEquipmentEntrySettings {
  ignoredEntryIdsByPart: Record<ZombieEquipmentPartKey, string[]>;
}

export interface ZombieSavedEntryPayload {
  rows: ZombieEquipmentEntryRow[];
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
