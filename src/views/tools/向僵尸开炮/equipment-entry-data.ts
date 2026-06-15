export type EquipmentPartKey = "helmet" | "clothes" | "boots" | "bracer" | "pants" | "gloves";

export interface EquipmentEntry {
  id: string;
  part: EquipmentPartKey;
  name: string;
  shortName?: string;
}

export interface EquipmentPart {
  key: EquipmentPartKey;
  label: string;
}

interface EntrySeed {
  id: string;
  name: string;
  shortName?: string;
}

const equipmentPartIdStart: Record<EquipmentPartKey, number> = {
  helmet: 1,
  clothes: 100001,
  boots: 200001,
  bracer: 300001,
  pants: 400001,
  gloves: 500001,
};

export const equipmentParts: EquipmentPart[] = [
  { key: "helmet", label: "头盔" },
  { key: "clothes", label: "衣服" },
  { key: "boots", label: "足具" },
  { key: "bracer", label: "护臂" },
  { key: "pants", label: "裤子" },
  { key: "gloves", label: "手套" },
];

const partEntrySeeds: Record<EquipmentPartKey, EntrySeed[]> = {
  helmet: [
    { id: "001", name: "生化矩阵造成伤害时额外附加1层基因污染，额外提供500层污染上限", shortName: "污染上限" },
    { id: "002", name: "【G3赛季宝石】时空裂隙持续时间+30%" },
    { id: "003", name: "【G3赛季宝石】弹球每次击杀怪物，所有技能冷却减少0.1秒（上限2秒）", shortName: "弹球击杀减冷却" },
    { id: "004", name: "【G3赛季宝石】多维弹球伤害+30%，弹射次数+3", shortName: "多维弹球+3" },
    { id: "005", name: "空投落地爆炸后向外溅射出2枚碎片，碰撞敌人造成30%攻击力的无属性伤害", shortName: "空投碎片" },
    { id: "006", name: "压缩气刃附加额外可叠加的重伤效果（每次增加8%，最多可叠加5次），持续10秒", shortName: "气刃重伤" },
    { id: "007", name: "温压弹命中中心区域时额外造成100%伤害", shortName: "温压中心增伤" },
    { id: "008", name: "干冰弹爆炸伤害系数+35%" },
    { id: "009", name: "电磁穿刺命中后有50%概率再弹射1次", shortName: "电磁弹射" },
    { id: "010", name: "枪械穿透+1，伤害+10%" },
    { id: "011", name: "所有技能冷却时间-21%" },
    { id: "012", name: "初始技能可额外选择1个" },
  ],
  clothes: [
    { id: "001", name: "【G3赛季宝石】向怪物增加中毒并持续造成伤害，毒素对怪物造成攻击力的额外伤害", shortName: "G3中毒伤害" },
    { id: "002", name: "【G2赛季宝石】持续发射后，增加攻击力" },
    { id: "003", name: "【G2赛季宝石】伤害增加+40%" },
    { id: "004", name: "【G2赛季宝石】连续发射次数+50%" },
    { id: "005", name: "全场怪物命中时，目标每有1层负面状态持续时间额外延长", shortName: "负面时间延长" },
    { id: "006", name: "防线每损失1%血量，伤害+10%" },
    { id: "007", name: "【G3赛季宝石】时空护盾伤害+24%，持续+17%" },
    { id: "008", name: "冰暴首个伤害+20%，冰暴时间+1秒" },
    { id: "009", name: "电磁枪伤害+42%，穿透次数+28%" },
    { id: "010", name: "每有一个负面状态，造成伤害+12%" },
    { id: "011", name: "燃烧伤害+35%" },
    { id: "012", name: "电磁穿刺伤害+42%" },
  ],
  boots: [
    { id: "001", name: "【G3赛季宝石】进入战场造成伤害时，造成力量额外+12%" },
    { id: "002", name: "【G3赛季宝石】单道弹道折返并造成伤害" },
    { id: "003", name: "【G2赛季宝石】能量恢复效率+30%" },
    { id: "004", name: "【G2赛季宝石】弹道数量上限额外+25%" },
    { id: "005", name: "【G2赛季宝石】减速和冻结效果持续时间提高" },
    { id: "006", name: "生化矩阵持续时间每50%减速，免疫3秒" },
    { id: "007", name: "【G3赛季宝石】时空裂隙对目标每次命中减少30%冷却", shortName: "裂隙命中减冷却" },
    { id: "008", name: "【G3赛季宝石】弹链命中目标，造成伤害并叠加中毒" },
    { id: "009", name: "传送后向外击退怪物，并控制同步3秒" },
    { id: "010", name: "位移后释放的飞行弹，直线飞行16秒" },
    { id: "011", name: "枪械有5%的概率对目标造成致命伤害，持续3秒" },
    { id: "012", name: "防御类命中冰冻目标时，每秒恢复防线0.5%最大生命值上限", shortName: "冰冻目标回血" },
    { id: "013", name: "冰冻伤害+7%" },
    { id: "014", name: "距离怪物越远伤害越高，最多+84%" },
  ],
  bracer: [
    { id: "001", name: "【G3赛季宝石】进入战斗攻击力+2%。无限宝石：集齐3个时，攻击力额外+6%；集齐6个时，攻击力额外+12%", shortName: "G3进战攻击" },
    { id: "002", name: "【G3赛季宝石】时空裂隙触发坍缩领域的次数-1", shortName: "裂隙坍缩-1" },
    { id: "003", name: "【G2赛季宝石】防线受击后，攻击力提升 x%，持续 5 秒", shortName: "受击加攻x%" },
    { id: "004", name: "【G2赛季宝石】机械蜕变时长-30%" },
    { id: "005", name: "【G2赛季宝石】防线受击后，攻击力提升20%" },
    { id: "006", name: "生化矩阵合并时，目标每有1层[基因污染]将额外对其造成生命上限0.004%伤害，造成伤害时将减少1层[基因污染]", shortName: "矩阵污染百分比" },
    { id: "007", name: "电极柱数量+1，伤害+10%" },
    { id: "008", name: "【G3赛季宝石】时空裂隙伤害+24%，范围+17%" },
    { id: "009", name: "幸运值下限变为5" },
    { id: "010", name: "【G3赛季宝石】每点幸运值增加多维弹球伤害12%", shortName: "幸运增弹球伤害" },
    { id: "011", name: "干冰弹伤害+20%，冻结时间+1秒" },
    { id: "012", name: "电极柱+1，伤害+10%" },
    { id: "013", name: "攻击+70" },
    { id: "014", name: "暴击率+7%" },
    { id: "015", name: "温压弹伤害+42%" },
    { id: "016", name: "干冰弹伤害+35%" },
    { id: "017", name: "电磁穿刺伤害+35%" },
    { id: "018", name: "火系伤害+28%" },
    { id: "019", name: "冰系伤害+28%" },
    { id: "020", name: "电系伤害+28%" },
    { id: "021", name: "风系伤害+28%" },
    { id: "022", name: "能量伤害+28%" },
    { id: "023", name: "物理伤害+21%" },
    { id: "024", name: "所有爆炸伤害+21%" },
    { id: "025", name: "对血量高于70%怪物伤害+70%" },
    { id: "026", name: "使怪物身上已有的负面状态持续时间延长50%", shortName: "负面状态延长50%" },
    { id: "027", name: "对处于负面状态的怪物造成的伤害+42%", shortName: "负面怪增伤42%" },
    { id: "028", name: "对精英和首领造成的伤害+140%" },
    { id: "029", name: "输出伤害随机在-20%~70%间浮动", shortName: "输出随机浮动" },
    { id: "030", name: "枪械伤害+35%" },
    { id: "031", name: "枪械射击时有5%概率击晕敌人1秒", shortName: "枪械击晕" },
    { id: "032", name: "暴击时，额外追加目标最大生命值8%伤害(最大伤害值为攻击力的500%)", shortName: "暴击追加生命伤害" },
    { id: "033", name: "释放技能有70%概率无视怪物的伤害减免效果", shortName: "技能无视减免" },
    { id: "034", name: "防线血量+1400，受到伤害-14" },
    { id: "035", name: "防线免疫前7次受到的伤害，并对怪物造成70%角色攻击力的伤害", shortName: "防线免疫7次" },
    { id: "036", name: "防线血量不足30%时伤害+110%" },
    { id: "037", name: "每击杀—只怪防线回血5" },
    { id: "038", name: "温压弹命中怪物后会弹射出一个强化的温压弹", shortName: "温压强化弹" },
    { id: "039", name: "干冰弹伤害+20%，冻结时间+1秒" },
    { id: "040", name: "高能射线伤害次数+3并且会对范围内的目标造成3秒眩晕", shortName: "射线次数+眩晕" },
    { id: "041", name: "高能射线命中冰冻的怪物时有25%的几率产生折射", shortName: "射线冰冻折射" },
    { id: "042", name: "每释放6次高能射线，就会额外释放—次扫射，造成攻击力112%的伤害", shortName: "射线额外扫射" },
    { id: "043", name: "制导激光命中冰冻的怪物时有100%几率产生折射", shortName: "制导冰冻折射" },
    { id: "044", name: "压缩气刃伤害提高28%，击退效果提高28%" },
    { id: "045", name: "空投轰炸的伤害+42%，范围+28%" },
    { id: "046", name: "装甲车伤害+42%，击退效果+28%" },
    { id: "047", name: "冰暴发生器造成伤害时有30%概率附加无视冻结抗性的冻结", shortName: "冰暴无视冻结抗性" },
    { id: "048", name: "跃迁电子弹射次数+5" },
    { id: "049", name: "跃迁电子可以伤害路径上的敌人，造成30%攻击力的伤害", shortName: "跃迁路径伤害" },
    { id: "050", name: "无人机每次碰到墙壁反弹时，造成的伤害增加8%，最多40%", shortName: "无人机反弹增伤" },
    { id: "051", name: "无人机每次命中超过20个敌方单位时，造成一次攻击力25%范围爆炸伤害", shortName: "无人机范围爆炸" },
    { id: "052", name: "燃油弹伤害+28%，减速效果+14%" },
  ],
  pants: [
    { id: "001", name: "【G3赛季宝石】进入战斗状态+2%，无视怪物；最多3个时，攻击力额外+16%，每有6个时，攻击力额外+12%", shortName: "G3进战攻击" },
    { id: "002", name: "【G3赛季宝石】压缩气刃命中十字范围造成的目标，在3秒内持续造成攻击力20%的伤害", shortName: "G3气刃持续伤害" },
    { id: "003", name: "【G2赛季宝石】法能回复+4" },
    { id: "004", name: "生化矩阵造成伤害时额外附加1层基因污染，额外提供500层污染上限", shortName: "污染上限" },
    { id: "005", name: "【G3赛季宝石】时空裂隙持续时间+30%" },
    { id: "006", name: "【G3赛季宝石】弹球每次击杀怪物，所有技能冷却减少0.1秒（上限2秒）", shortName: "弹球击杀减冷却" },
    { id: "007", name: "【G3赛季宝石】多维弹球伤害+30%，弹射次数+3", shortName: "多维弹球+3" },
    { id: "008", name: "空投落地爆炸后向外溅射出2枚碎片，碰撞敌人造成30%攻击力的无属性伤害", shortName: "空投碎片" },
    { id: "009", name: "连锁闪电可重复触发，最多触发350次，持续10秒" },
    { id: "010", name: "温压弹伤害+42%，持续时间+3秒" },
    { id: "011", name: "压缩气刃附加额外可叠加的重伤效果（每次增加8%，最多可叠加5次），持续10秒", shortName: "气刃重伤" },
    { id: "012", name: "造成伤害时有3%概率秒杀怪物（对精英和首领无效）", shortName: "小怪秒杀" },
    { id: "013", name: "击杀时，额外增加防线最大生命值5%的防线最大伤害力攻击力加成", shortName: "击杀加防线血量" },
    { id: "014", name: "防线血量+1400，受伤降低-14" },
    { id: "015", name: "初始免疫7次受到的伤害，并可将防线血量7%的血量攻击力转化为伤害", shortName: "初始免疫转伤害" },
    { id: "016", name: "防线血量不足30%时伤害+110%" },
    { id: "017", name: "对距离防线400距离内怪物伤害+42%" },
    { id: "018", name: "温压弹命中中段区域会弹出一枚灼烧火球", shortName: "温压火球" },
    { id: "019", name: "干冰弹初始发射个数+1" },
    { id: "020", name: "连续射击额外装填3弹并提升一次伤害", shortName: "连续射击装填" },
    { id: "021", name: "造成爆燃伤害时，每有装弹中的护盾额外提升2%" },
    { id: "022", name: "制导激光命中后造成100%伤害，并额外触发一次", shortName: "制导额外触发" },
    { id: "023", name: "获得额外防线次数+5" },
    { id: "024", name: "射击类技能冷却时间-30%" },
    { id: "025", name: "距离一段距离后造成伤害提升，最高增幅28%" },
    { id: "026", name: "空投炸弹的伤害+42%，范围+28%" },
    { id: "027", name: "弹幕命中后产生持续侵蚀效果，伤害+28%" },
    { id: "028", name: "中率布雷布伤害+42%，减速效果+28%" },
    { id: "029", name: "跃迁电子在命中怪物时有30%概率生成短暂电子" },
    { id: "030", name: "燃油弹命中后使怪物燃烧并造成额外伤害" },
    { id: "031", name: "无人机在场时伤害+50%" },
    { id: "032", name: "无人机进行过程中伤害+18%，冷却时间减少0.1秒", shortName: "无人机伤害冷却" },
    { id: "033", name: "急速弹伤害+28%，减速效果+14%" },
  ],
  gloves: [
    { id: "001", name: "【G3赛季宝石】进入战场造成伤害时，造成力量额外+12%" },
    { id: "002", name: "【G3赛季宝石】腐蚀命中目标造成防御力降低" },
    { id: "003", name: "【G2赛季宝石】造成了冰14层，额外进行一次减速冰冻", shortName: "G2额外冰冻" },
    { id: "004", name: "【G2赛季宝石】击破护盾和眩晕会造成20%上限+10" },
    { id: "005", name: "【G2赛季宝石】冰冻持续+25%" },
    { id: "006", name: "每次攻击穿透时，每15%概率触发额外子弹" },
    { id: "007", name: "压缩弹爆破时额外弹射次数+3" },
    { id: "008", name: "【G3赛季宝石】时空裂隙对目标造成20%伤害，递增效果", shortName: "裂隙递增伤害" },
    { id: "009", name: "风系伤害+18，19、20层，每层子弹+1伤害" },
    { id: "010", name: "冰冻伤害+42%，持续时间+3秒" },
    { id: "011", name: "进入关卡时武器额外1次弹射" },
    { id: "012", name: "枪械每次命中目标额外造成70%攻击力伤害" },
    { id: "013", name: "释放技能时额外释放本技能1次，冷却+120%" },
  ],
};

const createEntries = (part: EquipmentPart): EquipmentEntry[] => {
  const seeds = partEntrySeeds[part.key];

  return seeds.map((seed, index) => ({
    id: String(equipmentPartIdStart[part.key] + index).padStart(6, "0"),
    part: part.key,
    name: seed.name,
    shortName: seed.shortName,
  }));
};

export const equipmentEntryList: EquipmentEntry[] = equipmentParts.flatMap(createEntries);

export const equipmentEntryMap: Record<string, EquipmentEntry> = equipmentEntryList.reduce((map, entry) => {
  map[entry.id] = entry;
  return map;
}, {} as Record<string, EquipmentEntry>);

export const equipmentEntryListByPart: Record<EquipmentPartKey, EquipmentEntry[]> = equipmentParts.reduce((map, part) => {
  map[part.key] = equipmentEntryList.filter((entry) => entry.part === part.key);
  return map;
}, {} as Record<EquipmentPartKey, EquipmentEntry[]>);
