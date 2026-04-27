import {
  getCurrentSkillValue,
  getResolvedResistanceLevel,
  getResistanceModifierTotal,
} from "../config/characterRuntime.ts";
import { statGroups } from "../config/characterTemplate.ts";
import {
  buildItemIndex,
  getEquipmentItemBySlot,
  getEquipmentSlotLabel,
  getItemBlueprintLabel,
  getItemCompactHeaderSummary,
  getViewerFacingItemRecord,
} from "../lib/items.ts";
import { buildPlayerCharacterViewModel } from "../selectors/playerCharacterViewModel.ts";
import type { AppDataSnapshot } from "../services/appDataController.ts";
import {
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
  type DamageTypeId,
  type ResistanceLevel,
} from "../rules/resistances.ts";
import type { CharacterRecord, StatId } from "../types/character.ts";
import {
  CANONICAL_EQUIPMENT_SLOT_IDS,
  isSupplementaryEquipmentSlotId,
  type CanonicalEquipmentSlotId,
  type SharedItemRecord,
} from "../types/items.ts";

export type CharacterSheetDetailTabId =
  | "stats"
  | "skills"
  | "powers"
  | "loadout"
  | "inventory"
  | "knowledge"
  | "history"
  | "notes";

export type CharacterSheetSummarySectionId =
  | "resistances"
  | "stats"
  | "skills"
  | "powers"
  | "loadout";

export type CharacterSheetIconId =
  | "armor"
  | "book"
  | "box"
  | "brain"
  | "clock"
  | "coin"
  | "flame"
  | "heart"
  | "history"
  | "loadout"
  | "mana"
  | "note"
  | "power"
  | "shield"
  | "skill"
  | "spark"
  | "stats"
  | "sword"
  | "target"
  | "walk";

export type CharacterSheetTabConfig = {
  id: CharacterSheetDetailTabId;
  label: string;
  icon: CharacterSheetIconId;
};

export type CharacterSheetSummaryConfig = {
  id: CharacterSheetSummarySectionId;
  label: string;
  icon: CharacterSheetIconId;
  targetTabId: CharacterSheetDetailTabId | null;
};

export const CHARACTER_SHEET_DETAIL_TABS: CharacterSheetTabConfig[] = [
  { id: "stats", label: "Stats", icon: "stats" },
  { id: "skills", label: "Skills", icon: "skill" },
  { id: "powers", label: "Powers", icon: "power" },
  { id: "loadout", label: "Loadout", icon: "loadout" },
  { id: "inventory", label: "Inventory", icon: "box" },
  { id: "knowledge", label: "Knowledge", icon: "book" },
  { id: "history", label: "History", icon: "history" },
  { id: "notes", label: "Notes", icon: "note" },
];

export const CHARACTER_SHEET_SUMMARY_SECTIONS: CharacterSheetSummaryConfig[] = [
  { id: "resistances", label: "Resistances", icon: "shield", targetTabId: "stats" },
  { id: "stats", label: "Stats", icon: "stats", targetTabId: "stats" },
  { id: "skills", label: "Skills", icon: "skill", targetTabId: "skills" },
  { id: "powers", label: "Powers", icon: "power", targetTabId: "powers" },
  { id: "loadout", label: "Loadout", icon: "loadout", targetTabId: "loadout" },
];

export const CHARACTER_SHEET_ICON_MAP: Record<string, CharacterSheetIconId> = {
  physical: "sword",
  social: "spark",
  mental: "brain",
  melee: "sword",
  range: "target",
  shield: "shield",
  body_armor: "armor",
  occult: "spark",
  consumable: "flame",
  accessory: "coin",
  weapon_primary: "sword",
  weapon_secondary: "shield",
  ring_left: "coin",
  ring_right: "coin",
  body: "armor",
  neck: "spark",
  head: "brain",
  orbital: "target",
  earring: "spark",
  charm: "spark",
};

export type CharacterSheetStatRow = {
  id: StatId;
  value: number;
  base: number;
  gear: number;
  buffs: number;
};

export type CharacterSheetStatGroup = {
  title: string;
  accent: string;
  icon: CharacterSheetIconId;
  stats: CharacterSheetStatRow[];
};

export type CharacterSheetSkillRow = {
  id: string;
  label: string;
  rollStat: string;
  base: number;
  total: number;
};

export type CharacterSheetPowerRow = {
  id: string;
  name: string;
  level: number;
  governingStat: StatId;
};

export type CharacterSheetItemRow = {
  id: string;
  name: string;
  blueprintLabel: string;
  summary: string;
  icon: CharacterSheetIconId;
  isKnown: boolean;
};

export type CharacterSheetLoadoutSlot = {
  slotId: CanonicalEquipmentSlotId;
  label: string;
  icon: CharacterSheetIconId;
  item: CharacterSheetItemRow | null;
  isSupplementary: boolean;
};

export type CharacterSheetResistanceState =
  | "fragile"
  | "vulnerable"
  | "normal"
  | "resist"
  | "immune";

export type CharacterSheetResistanceRow = {
  id: DamageTypeId;
  label: string;
  family: string;
  baseLevel: ResistanceLevel;
  modifier: number;
  resolvedLevel: ResistanceLevel;
  levelLabel: string;
  multiplierLabel: string;
  state: CharacterSheetResistanceState;
};

export type CharacterSheetModeIndicator = {
  id: string;
  label: string;
  tone: "neutral" | "active" | "caution";
};

export type CharacterSheetKnowledgeRow = {
  id: string;
  type: string;
  title: string;
  summary: string;
  isPinned: boolean;
};

export type CharacterSheetHistoryRow = {
  id: string;
  type: "note" | "intel_snapshot";
  title: string;
  detail: string;
  actualDateTime: string;
  gameDateTime: string;
};

export type CharacterSheetUiModel = {
  detailTabs: CharacterSheetTabConfig[];
  summarySections: CharacterSheetSummaryConfig[];
  identity: {
    name: string;
    concept: string;
    faction: string;
    biographyPrimary: string;
    biographySecondary: string;
    rank: string;
    cr: number;
    xpEarned: number;
    xpUsed: number;
    xpLeftOver: number;
  };
  resources: {
    hp: number;
    maxHp: number;
    temporaryHp: number;
    mana: number;
    maxMana: number;
    inspiration: number;
    temporaryInspiration: number;
    positiveKarma: number;
    negativeKarma: number;
    money: number;
  };
  combat: {
    initiative: number;
    armorClass: number;
    damageReduction: number;
    soak: number;
    movement: string;
    meleeAttack: number;
    rangedAttack: number;
    meleeDamage: number;
    rangedDamage: string;
  };
  status: {
    tags: string[];
    effects: string[];
    utilityTraits: string[];
  };
  modeIndicators: CharacterSheetModeIndicator[];
  resistanceRows: CharacterSheetResistanceRow[];
  highlightedResistanceRows: CharacterSheetResistanceRow[];
  statGroups: CharacterSheetStatGroup[];
  skills: CharacterSheetSkillRow[];
  topSkills: CharacterSheetSkillRow[];
  powers: CharacterSheetPowerRow[];
  loadoutSlots: CharacterSheetLoadoutSlot[];
  inventoryItems: CharacterSheetItemRow[];
  knowledgeRows: CharacterSheetKnowledgeRow[];
  historyRows: CharacterSheetHistoryRow[];
  notes: CharacterSheetHistoryRow[];
};

export function isCharacterSheetDetailTabId(value: string): value is CharacterSheetDetailTabId {
  return CHARACTER_SHEET_DETAIL_TABS.some((tab) => tab.id === value);
}

function sumValues(values: Array<{ value: number }>): number {
  return values.reduce((total, source) => total + source.value, 0);
}

function formatCharacterName(character: CharacterRecord): string {
  return character.sheet.name.trim().length > 0 ? character.sheet.name : "Unnamed Character";
}

function getResistanceState(level: ResistanceLevel): CharacterSheetResistanceState {
  switch (level) {
    case -2:
      return "fragile";
    case -1:
      return "vulnerable";
    case 1:
      return "resist";
    case 2:
      return "immune";
    case 0:
      return "normal";
  }
}

function getItemIcon(item: SharedItemRecord | null): CharacterSheetIconId {
  if (!item) {
    return "box";
  }

  return (
    CHARACTER_SHEET_ICON_MAP[item.category] ??
    CHARACTER_SHEET_ICON_MAP[item.subtype] ??
    "box"
  );
}

function hasOwnedItemCard(
  snapshot: AppDataSnapshot,
  characterId: string,
  item: SharedItemRecord
): boolean {
  if (
    item.knowledge.learnedCharacterIds.includes(characterId) ||
    item.knowledge.visibleCharacterIds.includes(characterId)
  ) {
    return true;
  }

  const itemEntityIds = new Set(
    snapshot.knowledgeEntities
      .filter((entity) => entity.type === "item" && entity.subjectKey === item.id)
      .map((entity) => entity.id)
  );
  const itemRevisionIds = new Set(
    snapshot.knowledgeRevisions
      .filter((revision) => itemEntityIds.has(revision.entityId))
      .map((revision) => revision.id)
  );

  return snapshot.knowledgeOwnerships.some(
    (ownership) =>
      ownership.ownerCharacterId === characterId && itemRevisionIds.has(ownership.revisionId)
  );
}

function buildItemRow(
  snapshot: AppDataSnapshot,
  characterId: string,
  item: SharedItemRecord
): CharacterSheetItemRow {
  const itemRulesContext = {
    itemBlueprints: snapshot.itemBlueprints,
    itemCategoryDefinitions: snapshot.itemCategoryDefinitions,
    itemSubcategoryDefinitions: snapshot.itemSubcategoryDefinitions,
  };
  const isKnown = hasOwnedItemCard(snapshot, characterId, item);
  const viewerItem = getViewerFacingItemRecord(item, {
    ...itemRulesContext,
    hasOwnedItemCard: isKnown,
  });

  return {
    id: item.id,
    name: viewerItem.name,
    blueprintLabel: getItemBlueprintLabel(viewerItem, snapshot.itemBlueprints),
    summary: getItemCompactHeaderSummary(viewerItem, {
      ...itemRulesContext,
      includeBonus: isKnown,
    }),
    icon: getItemIcon(viewerItem),
    isKnown,
  };
}

export function buildCharacterSheetUiModel(
  snapshot: AppDataSnapshot,
  character: CharacterRecord
): CharacterSheetUiModel {
  const sheet = character.sheet;
  const itemsById = buildItemIndex(snapshot.items);
  const playerViewModel = buildPlayerCharacterViewModel(sheet, itemsById);
  const derived = playerViewModel.derived;
  const ownedRevisionIds = new Set(
    snapshot.knowledgeOwnerships
      .filter((ownership) => ownership.ownerCharacterId === character.id && !ownership.isArchived)
      .map((ownership) => ownership.revisionId)
  );

  const statGroupRows: CharacterSheetStatGroup[] = statGroups.map((group) => ({
    title: group.title,
    accent: group.accent,
    icon: CHARACTER_SHEET_ICON_MAP[group.accent] ?? "stats",
    stats: group.ids.map((statId) => {
      const stat = sheet.statState[statId];
      return {
        id: statId,
        value: derived.currentStats[statId],
        base: stat.base,
        gear: sumValues(stat.gearSources),
        buffs: sumValues(stat.buffSources),
      };
    }),
  }));

  const resistanceRows: CharacterSheetResistanceRow[] = DAMAGE_TYPES.map((damageType) => {
    const baseLevel = sheet.resistances[damageType.id] ?? 0;
    const modifier = getResistanceModifierTotal(sheet, damageType.id, itemsById);
    const resolvedLevel = getResolvedResistanceLevel(sheet, damageType.id, itemsById);
    const rule = RESISTANCE_LEVELS[resolvedLevel];
    return {
      id: damageType.id,
      label: damageType.label,
      family: damageType.family,
      baseLevel,
      modifier,
      resolvedLevel,
      levelLabel: rule.label,
      multiplierLabel: `x${rule.damageMultiplier}`,
      state: getResistanceState(resolvedLevel),
    };
  });
  const highlightedResistanceRows = resistanceRows
    .filter((row) => row.resolvedLevel !== 0)
    .sort((left, right) => Math.abs(right.resolvedLevel) - Math.abs(left.resolvedLevel));

  const skills = sheet.skills.map((skill) => ({
    id: skill.id,
    label: skill.label,
    rollStat: skill.rollStat,
    base: skill.base,
    total: getCurrentSkillValue(sheet, skill.id, itemsById),
  }));
  const topSkills = [...skills]
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
    .slice(0, 6);

  const loadoutSlots = CANONICAL_EQUIPMENT_SLOT_IDS.filter(
    (slotId) =>
      !isSupplementaryEquipmentSlotId(slotId) || sheet.enabledSupplementarySlotIds.includes(slotId)
  ).map((slotId) => {
    const item = getEquipmentItemBySlot(sheet, slotId, itemsById);
    return {
      slotId,
      label: getEquipmentSlotLabel(slotId),
      icon: CHARACTER_SHEET_ICON_MAP[slotId] ?? "loadout",
      item: item ? buildItemRow(snapshot, character.id, item) : null,
      isSupplementary: isSupplementaryEquipmentSlotId(slotId),
    };
  });

  const inventoryItems = sheet.inventoryItemIds
    .map((itemId) => itemsById[itemId] ?? null)
    .filter((item): item is SharedItemRecord => item !== null)
    .map((item) => buildItemRow(snapshot, character.id, item));

  const knowledgeRows = snapshot.knowledgeRevisions
    .filter((revision) => ownedRevisionIds.has(revision.id))
    .map((revision) => {
      const entity = snapshot.knowledgeEntities.find((candidate) => candidate.id === revision.entityId);
      const ownership = snapshot.knowledgeOwnerships.find(
        (candidate) =>
          candidate.ownerCharacterId === character.id && candidate.revisionId === revision.id
      );
      return {
        id: revision.id,
        type: entity?.type ?? "custom",
        title: ownership?.localLabel || revision.title || entity?.displayName || "Knowledge Card",
        summary: revision.summary,
        isPinned: ownership?.isPinned ?? false,
      };
    })
    .sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || left.title.localeCompare(right.title));

  const historyRows = sheet.gameHistory.map((entry) => ({
    id: entry.id,
    type: entry.type,
    title: entry.type === "note" ? "Session Note" : entry.sourcePower,
    detail: entry.type === "note" ? entry.note : entry.summary,
    actualDateTime: entry.actualDateTime,
    gameDateTime: entry.gameDateTime,
  }));

  return {
    detailTabs: CHARACTER_SHEET_DETAIL_TABS,
    summarySections: CHARACTER_SHEET_SUMMARY_SECTIONS,
    identity: {
      name: formatCharacterName(character),
      concept: sheet.concept || "No concept",
      faction: sheet.faction || "No faction",
      biographyPrimary: sheet.biographyPrimary,
      biographySecondary: sheet.biographySecondary,
      rank: playerViewModel.progression.rank,
      cr: playerViewModel.progression.cr,
      xpEarned: sheet.xpEarned,
      xpUsed: sheet.xpUsed,
      xpLeftOver: playerViewModel.xpLeftOver,
    },
    resources: {
      hp: sheet.currentHp,
      maxHp: derived.maxHp,
      temporaryHp: derived.temporaryHp,
      mana: derived.currentMana,
      maxMana: derived.maxMana,
      inspiration: derived.permanentInspiration,
      temporaryInspiration: derived.temporaryInspiration,
      positiveKarma: sheet.positiveKarma,
      negativeKarma: sheet.negativeKarma,
      money: sheet.money,
    },
    combat: {
      initiative: derived.initiative,
      armorClass: derived.armorClass,
      damageReduction: derived.damageReduction,
      soak: derived.soak,
      movement: derived.movement,
      meleeAttack: derived.meleeAttack,
      rangedAttack: derived.rangedAttack,
      meleeDamage: derived.meleeDamage,
      rangedDamage: derived.rangedDamage,
    },
    status: {
      tags: sheet.statusTags.map((tag) => tag.label),
      effects: [
        ...sheet.effects,
        ...derived.activePowerEffects.map((effect) => effect.label),
      ],
      utilityTraits: derived.utilityTraits,
    },
    modeIndicators: [
      {
        id: "viewer",
        label: `${snapshot.roleChoice === "dm" ? "DM" : "Player"} View`,
        tone: snapshot.roleChoice === "dm" ? "active" : "neutral",
      },
      {
        id: "owner",
        label: character.ownerRole === "dm" ? "DM Character" : "Player Character",
        tone: character.ownerRole === "dm" ? "active" : "neutral",
      },
      { id: "edit", label: "View Only", tone: "neutral" },
      {
        id: "admin",
        label: sheet.dmAuditLog.some((entry) => entry.editLayer === "admin_override")
          ? "Admin Audit"
          : "Admin Locked",
        tone: sheet.dmAuditLog.some((entry) => entry.editLayer === "admin_override")
          ? "caution"
          : "neutral",
      },
    ],
    resistanceRows,
    highlightedResistanceRows,
    statGroups: statGroupRows,
    skills,
    topSkills,
    powers: sheet.powers.map((power) => ({
      id: power.id,
      name: power.name,
      level: power.level,
      governingStat: power.governingStat,
    })),
    loadoutSlots,
    inventoryItems,
    knowledgeRows,
    historyRows,
    notes: historyRows.filter((entry) => entry.type === "note"),
  };
}
