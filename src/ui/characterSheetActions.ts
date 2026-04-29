import {
  powerLibrary,
  type CharacterDraft,
  type GameHistoryEntry,
} from "../config/characterTemplate.ts";
import { appendDmAuditEntry, createDmAuditEntry } from "../lib/dmAudit.ts";
import { rollD10Faces } from "../lib/dice.ts";
import { buildGameHistoryNoteEntry, prependGameHistoryEntry } from "../lib/historyEntries.ts";
import { buildItemIndex } from "../lib/items.ts";
import {
  applyKnowledgeBatch,
  buildKnowledgeHistoryLink,
  createCharacterKnowledgeRevision,
  createDuplicateKnowledgeBatch,
  createEditedKnowledgeBatch,
  createKnowledgeEntity,
  createKnowledgeOwnership,
  createKnowledgeRevision,
  createKnowledgeShareResult,
  renameKnowledgeOwnership,
  toggleKnowledgeOwnershipArchived,
  toggleKnowledgeOwnershipPinned,
} from "../lib/knowledge.ts";
import {
  addPowerAtLevelOne,
  addPowerAtLevelOneOverride,
  adjustPowerProgression,
  adjustSkillProgression,
  adjustStatProgression,
  setPowerLevel,
  setSkillBaseLevel,
  setStatBaseLevel,
  updateRuntimeFieldValue,
  updateSheetFieldValue,
  type RuntimeEditableField,
} from "../mutations/characterSheetMutations.ts";
import {
  removeCharacterItemFromEquipment,
  setCharacterActiveItemState,
  setCharacterEquipmentSlotItem,
  setCharacterInventoryItemState,
  setCharacterOwnedItemState,
} from "../mutations/characterItemMutations.ts";
import { getCastPowerVariantOptions } from "../rules/powerEffects.ts";
import { resolveDicePool } from "../rules/combat.ts";
import { resetCharacterPowerUsageScope } from "../lib/powerUsage.ts";
import type { WorldCastRequestPayload } from "../lib/powerCasting.ts";
import type { AppDataController, AppDataSnapshot } from "../services/appDataController.ts";
import type { CharacterRecord, StatId } from "../types/character.ts";
import type { CastPowerMode, CastPowerVariantId } from "../powers/spellTypes.ts";
import type { DamageTypeId } from "../rules/resistances.ts";
import type { CanonicalEquipmentSlotId } from "../types/items.ts";
import type {
  KnowledgeRevisionSection,
  KnowledgeSourceType,
} from "../types/knowledge.ts";
import type { PowerUsageResetScope } from "../types/powerUsage.ts";

export type CharacterSheetModeState = {
  sheetEdit: boolean;
  progressionEdit: boolean;
  dmRuntimeEdit: boolean;
  adminOverride: boolean;
  reason: string;
};

export type CharacterSheetModeIndicator = {
  id: string;
  label: string;
  tone: "neutral" | "active" | "caution";
};

export type EditableSheetField =
  | "name"
  | "concept"
  | "faction"
  | "apparelMode"
  | "age"
  | "gameDateTime"
  | "biographyPrimary"
  | "biographySecondary"
  | "xpEarned"
  | "money"
  | "temporaryHp"
  | "temporaryInspiration";

export type ProgressionOptions = {
  adminOverride: boolean;
  reason: string;
  statFloors?: Partial<Record<StatId, number>>;
};

export type WorldPowerCastInput = {
  characterId: string;
  powerId: string;
  variantId: CastPowerVariantId;
  targetIds: string[];
  selectedStatId: StatId | null;
  castMode: CastPowerMode;
  selectedDamageType: DamageTypeId | null;
  bonusManaSpend: number;
  selectedSummonOptionId: string | null;
  healingAllocations: Record<string, number>;
};

export type CharacterSheetManualKnowledgeInput = {
  ownerCharacterId: string;
  title: string;
  summary: string;
};

export type CharacterSheetActions = {
  updateSheetField: <K extends EditableSheetField>(
    characterId: string,
    field: K,
    value: CharacterDraft[K],
    options?: { adminOverride?: boolean; reason?: string }
  ) => void;
  updateRuntimeField: (
    characterId: string,
    field: RuntimeEditableField,
    value: number,
    options?: { adminOverride?: boolean; reason?: string }
  ) => void;
  adjustStat: (
    characterId: string,
    statId: StatId,
    direction: 1 | -1,
    options: ProgressionOptions
  ) => void;
  adjustSkill: (
    characterId: string,
    skillId: string,
    direction: 1 | -1,
    options: ProgressionOptions
  ) => void;
  adjustPower: (
    characterId: string,
    powerId: string,
    direction: 1 | -1,
    options: ProgressionOptions
  ) => void;
  addPower: (characterId: string, powerId: string, options: ProgressionOptions) => void;
  resetPowerUsage: (characterId: string, scope: PowerUsageResetScope) => void;
  equipItem: (characterId: string, slotId: CanonicalEquipmentSlotId, itemId: string) => void;
  unequipItem: (characterId: string, itemId: string) => void;
  setItemOwned: (characterId: string, itemId: string, isOwned: boolean) => void;
  setItemCarried: (characterId: string, itemId: string, isCarried: boolean) => void;
  setItemActive: (characterId: string, itemId: string, isActive: boolean) => void;
  appendHistoryNote: (characterId: string, note: string) => void;
  castWorldPower: (input: WorldPowerCastInput) => string | null;
  appraiseItem: (characterId: string, itemId: string, artifactAppraisalLevel: number) => string | null;
  snapshotKnowledge: (characterId: string) => void;
  createManualKnowledge: (input: CharacterSheetManualKnowledgeInput) => void;
  duplicateKnowledge: (ownerCharacterId: string, revisionId: string) => void;
  createEditedKnowledge: (
    ownerCharacterId: string,
    revisionId: string,
    title: string,
    summary: string
  ) => void;
  shareKnowledge: (ownerCharacterId: string, revisionId: string, recipientCharacterId: string) => void;
  toggleKnowledgePinned: (ownershipId: string) => void;
  toggleKnowledgeArchived: (ownershipId: string) => void;
  renameKnowledge: (ownershipId: string, label: string) => void;
  rollDicePool: (poolSize: number) => CharacterSheetRollResult;
};

export type CharacterSheetRollResult = {
  poolSize: number;
  faces: number[];
  successes: number;
  botch: boolean;
};

export const DEFAULT_CHARACTER_SHEET_MODE_STATE: CharacterSheetModeState = {
  sheetEdit: false,
  progressionEdit: false,
  dmRuntimeEdit: false,
  adminOverride: false,
  reason: "",
};

export function buildCharacterSheetModeIndicators(
  snapshot: AppDataSnapshot,
  character: CharacterRecord,
  mode: CharacterSheetModeState
): CharacterSheetModeIndicator[] {
  const activeModeLabels = [
    mode.sheetEdit ? "Sheet Edit" : null,
    mode.progressionEdit ? "Progression Edit" : null,
    mode.dmRuntimeEdit ? "Runtime Edit" : null,
    mode.adminOverride ? "Admin Override" : null,
  ].filter((entry): entry is string => entry !== null);

  return [
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
    {
      id: "edit",
      label: activeModeLabels.length > 0 ? activeModeLabels.join(" / ") : "View",
      tone: activeModeLabels.length > 0 ? "active" : "neutral",
    },
    {
      id: "admin",
      label: mode.adminOverride ? "Admin Override On" : "Admin Locked",
      tone: mode.adminOverride ? "caution" : "neutral",
    },
  ];
}

export function canUseSheetEdit(mode: CharacterSheetModeState): boolean {
  return mode.sheetEdit || mode.adminOverride;
}

export function canUseRuntimeEdit(mode: CharacterSheetModeState): boolean {
  return mode.dmRuntimeEdit || mode.adminOverride;
}

export function canUseProgressionEdit(mode: CharacterSheetModeState): boolean {
  return mode.progressionEdit || mode.adminOverride;
}

export function canUseAdminAction(mode: CharacterSheetModeState): boolean {
  return !mode.adminOverride || mode.reason.trim().length > 0;
}

function getCharacter(snapshot: AppDataSnapshot, characterId: string): CharacterRecord | null {
  return snapshot.characters.find((character) => character.id === characterId) ?? null;
}

function getCharacterName(character: CharacterRecord): string {
  return character.sheet.name.trim() || character.id;
}

function withAudit(
  character: CharacterRecord,
  beforeSheet: CharacterDraft,
  afterSheet: CharacterDraft,
  fieldPath: string,
  options: { adminOverride?: boolean; reason?: string; editLayer?: "runtime" | "sheet" | "admin_override" }
): CharacterDraft {
  if (!options.adminOverride && options.editLayer !== "runtime") {
    return afterSheet;
  }

  const reason = options.reason?.trim() || (options.adminOverride ? "" : "Character sheet runtime edit");
  if (options.adminOverride && !reason) {
    return beforeSheet;
  }

  return appendDmAuditEntry(
    afterSheet,
    createDmAuditEntry({
      characterId: character.id,
      targetOwnerRole: character.ownerRole,
      editLayer: options.adminOverride ? "admin_override" : options.editLayer ?? "sheet",
      fieldPath,
      beforeValue: fieldPath.split(".").reduce<unknown>(
        (value, key) =>
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>)[key]
            : undefined,
        beforeSheet
      ),
      afterValue: fieldPath.split(".").reduce<unknown>(
        (value, key) =>
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>)[key]
            : undefined,
        afterSheet
      ),
      reason,
      sourceScreen: "character-sheet",
    })
  );
}

function applyKnowledgeHistoryEntries(
  controller: AppDataController,
  entries: Array<{ characterId: string; entry: GameHistoryEntry }>
): void {
  entries.forEach(({ characterId, entry }) => {
    controller.updateCharacter(characterId, (sheet) => ({
      ...sheet,
      gameHistory: prependGameHistoryEntry(sheet.gameHistory ?? [], entry),
    }));
  });
}

function oneLineKnowledgeSection(summary: string): KnowledgeRevisionSection[] {
  return [
    {
      id: "manual-summary",
      title: "Notes",
      kind: "notes",
      entries: [
        {
          id: "manual-summary-entry",
          label: "",
          value: summary.trim(),
        },
      ],
    },
  ];
}

export function createCharacterSheetActions(controller: AppDataController): CharacterSheetActions {
  return {
    updateSheetField(characterId, field, value, options = {}) {
      controller.updateCharacter(characterId, (sheet) => {
        const snapshot = controller.getSnapshot();
        const character = getCharacter(snapshot, characterId);
        if (!character) {
          return sheet;
        }
        const nextSheet = updateSheetFieldValue(sheet, field, value);
        return withAudit(character, sheet, nextSheet, String(field), {
          ...options,
          editLayer: "sheet",
        });
      });
    },

    updateRuntimeField(characterId, field, value, options = {}) {
      controller.updateCharacter(characterId, (sheet) => {
        const snapshot = controller.getSnapshot();
        const character = getCharacter(snapshot, characterId);
        if (!character) {
          return sheet;
        }
        const nextSheet = updateRuntimeFieldValue(sheet, field, value, buildItemIndex(snapshot.items));
        return withAudit(character, sheet, nextSheet, field, {
          ...options,
          editLayer: "runtime",
        });
      });
    },

    adjustStat(characterId, statId, direction, options) {
      controller.updateCharacter(characterId, (sheet) => {
        const snapshot = controller.getSnapshot();
        const character = getCharacter(snapshot, characterId);
        if (!character || (options.adminOverride && !canUseAdminAction({ ...DEFAULT_CHARACTER_SHEET_MODE_STATE, adminOverride: true, reason: options.reason }))) {
          return sheet;
        }
        const currentLevel = sheet.statState[statId].base;
        const nextSheet = options.adminOverride
          ? setStatBaseLevel(sheet, statId, currentLevel + direction)
          : adjustStatProgression(
              sheet,
              statId,
              direction,
              sheet.xpEarned - sheet.xpUsed,
              options.statFloors?.[statId] ?? 0
            );
        return withAudit(character, sheet, nextSheet, `statState.${statId}.base`, {
          adminOverride: options.adminOverride,
          reason: options.reason,
          editLayer: "sheet",
        });
      });
    },

    adjustSkill(characterId, skillId, direction, options) {
      controller.updateCharacter(characterId, (sheet) => {
        const snapshot = controller.getSnapshot();
        const character = getCharacter(snapshot, characterId);
        const currentSkill = sheet.skills.find((skill) => skill.id === skillId);
        if (!character || !currentSkill || (options.adminOverride && !options.reason.trim())) {
          return sheet;
        }
        const nextSheet = options.adminOverride
          ? setSkillBaseLevel(sheet, skillId, currentSkill.base + direction)
          : adjustSkillProgression(sheet, skillId, direction, sheet.xpEarned - sheet.xpUsed);
        return withAudit(character, sheet, nextSheet, `skills.${skillId}.base`, {
          adminOverride: options.adminOverride,
          reason: options.reason,
          editLayer: "sheet",
        });
      });
    },

    adjustPower(characterId, powerId, direction, options) {
      controller.updateCharacter(characterId, (sheet) => {
        const snapshot = controller.getSnapshot();
        const character = getCharacter(snapshot, characterId);
        const currentPower = sheet.powers.find((power) => power.id === powerId);
        if (!character || !currentPower || (options.adminOverride && !options.reason.trim())) {
          return sheet;
        }
        const nextSheet = options.adminOverride
          ? setPowerLevel(sheet, powerId, currentPower.level + direction)
          : adjustPowerProgression(sheet, powerId, direction, sheet.xpEarned - sheet.xpUsed);
        return withAudit(character, sheet, nextSheet, `powers.${powerId}.level`, {
          adminOverride: options.adminOverride,
          reason: options.reason,
          editLayer: "sheet",
        });
      });
    },

    addPower(characterId, powerId, options) {
      const template = powerLibrary.find((power) => power.id === powerId);
      if (!template) {
        return;
      }
      controller.updateCharacter(characterId, (sheet) => {
        const snapshot = controller.getSnapshot();
        const character = getCharacter(snapshot, characterId);
        if (!character || sheet.powers.some((power) => power.id === powerId) || (options.adminOverride && !options.reason.trim())) {
          return sheet;
        }
        const nextSheet = options.adminOverride
          ? addPowerAtLevelOneOverride(sheet, template)
          : addPowerAtLevelOne(sheet, template, sheet.xpEarned - sheet.xpUsed);
        return withAudit(character, sheet, nextSheet, `powers.${powerId}`, {
          adminOverride: options.adminOverride,
          reason: options.reason,
          editLayer: "sheet",
        });
      });
    },

    resetPowerUsage(characterId, scope) {
      controller.updateCharacter(characterId, (sheet) => resetCharacterPowerUsageScope(sheet, scope));
    },

    equipItem(characterId, slotId, itemId) {
      controller.updateCharacter(characterId, (sheet) => {
        const snapshot = controller.getSnapshot();
        return setCharacterEquipmentSlotItem(sheet, slotId, itemId, buildItemIndex(snapshot.items), {
          itemBlueprints: snapshot.itemBlueprints,
          itemCategoryDefinitions: snapshot.itemCategoryDefinitions,
          itemSubcategoryDefinitions: snapshot.itemSubcategoryDefinitions,
        });
      });
    },

    unequipItem(characterId, itemId) {
      controller.updateCharacter(characterId, (sheet) => removeCharacterItemFromEquipment(sheet, itemId));
    },

    setItemOwned(characterId, itemId, isOwned) {
      controller.updateCharacter(characterId, (sheet) => setCharacterOwnedItemState(sheet, itemId, isOwned));
    },

    setItemCarried(characterId, itemId, isCarried) {
      controller.updateCharacter(characterId, (sheet) => setCharacterInventoryItemState(sheet, itemId, isCarried));
    },

    setItemActive(characterId, itemId, isActive) {
      controller.updateCharacter(characterId, (sheet) => setCharacterActiveItemState(sheet, itemId, isActive));
    },

    appendHistoryNote(characterId, note) {
      controller.updateCharacter(characterId, (sheet) => ({
        ...sheet,
        gameHistory: prependGameHistoryEntry(
          sheet.gameHistory ?? [],
          buildGameHistoryNoteEntry(note, sheet.gameDateTime)
        ),
      }));
    },

    castWorldPower(input) {
      const snapshot = controller.getSnapshot();
      const casterCharacter = getCharacter(snapshot, input.characterId);
      const selectedPower = casterCharacter?.sheet.powers.find((power) => power.id === input.powerId);
      if (!casterCharacter || !selectedPower) {
        return "The selected power is no longer available.";
      }

      const payload: WorldCastRequestPayload = {
        characters: snapshot.characters,
        casterCharacter,
        casterDisplayName: getCharacterName(casterCharacter),
        selectedPower,
        selectedVariantId: input.variantId,
        attackOutcome: "hit",
        selectedTargetIds: input.targetIds,
        fallbackTargetIds: [casterCharacter.id],
        healingAllocations: input.healingAllocations,
        selectedStatId: input.selectedStatId,
        castMode: input.castMode,
        selectedDamageType: input.selectedDamageType,
        bonusManaSpend: input.bonusManaSpend,
        selectedSummonOptionId: input.selectedSummonOptionId,
        itemsById: buildItemIndex(snapshot.items),
      };
      return controller.executeWorldCast(payload);
    },

    appraiseItem(characterId, itemId, artifactAppraisalLevel) {
      return controller.executeArtifactAppraisal({
        casterCharacterId: characterId,
        itemId,
        artifactAppraisalLevel,
      });
    },

    snapshotKnowledge(characterId) {
      const snapshot = controller.getSnapshot();
      const character = getCharacter(snapshot, characterId);
      if (!character) {
        return;
      }
      const created = createCharacterKnowledgeRevision({
        state: snapshot.knowledgeState,
        targetCharacter: character,
        createdByCharacterId: characterId,
        sourceType: "dm_grant",
        historyEntryId: null,
        parentRevisionId: null,
        lineageMode: "observed",
        isCanonical: false,
        itemsById: buildItemIndex(snapshot.items),
      });
      const ownership = createKnowledgeOwnership({
        ownerCharacterId: characterId,
        revisionId: created.revision.id,
        acquiredFromCharacterId: null,
      });
      controller.updateKnowledgeState((state) =>
        applyKnowledgeBatch(state, {
          ...created.batch,
          ownerships: [ownership],
        })
      );
    },

    createManualKnowledge(input) {
      const title = input.title.trim() || "Manual Knowledge";
      const summary = input.summary.trim();
      const entity = createKnowledgeEntity({
        type: "custom",
        subjectKey: null,
        displayName: title,
      });
      const revision = createKnowledgeRevision({
        entityId: entity.id,
        revisionNumber: 1,
        title,
        summary,
        content: oneLineKnowledgeSection(summary),
        tags: ["manual"],
        createdByCharacterId: input.ownerCharacterId,
        sourceType: "manual_edit",
        sourceSpellName: null,
        sourceHistoryEntryId: null,
        parentRevisionId: null,
        lineageMode: "observed",
        isCanonical: false,
      });
      const ownership = createKnowledgeOwnership({
        ownerCharacterId: input.ownerCharacterId,
        revisionId: revision.id,
        acquiredFromCharacterId: null,
      });
      controller.updateKnowledgeState((state) =>
        applyKnowledgeBatch(state, {
          entities: [entity],
          revisions: [revision],
          ownerships: [ownership],
        })
      );
    },

    duplicateKnowledge(ownerCharacterId, revisionId) {
      const snapshot = controller.getSnapshot();
      const revision = snapshot.knowledgeRevisions.find((entry) => entry.id === revisionId);
      const entity = revision
        ? snapshot.knowledgeEntities.find((entry) => entry.id === revision.entityId)
        : null;
      if (!revision || !entity) {
        return;
      }
      controller.updateKnowledgeState((state) =>
        applyKnowledgeBatch(
          state,
          createDuplicateKnowledgeBatch({
            state,
            entity,
            revision,
            ownerCharacterId,
          })
        )
      );
    },

    createEditedKnowledge(ownerCharacterId, revisionId, title, summary) {
      const snapshot = controller.getSnapshot();
      const revision = snapshot.knowledgeRevisions.find((entry) => entry.id === revisionId);
      const entity = revision
        ? snapshot.knowledgeEntities.find((entry) => entry.id === revision.entityId)
        : null;
      if (!revision || !entity) {
        return;
      }
      controller.updateKnowledgeState((state) =>
        applyKnowledgeBatch(
          state,
          createEditedKnowledgeBatch({
            state,
            entity,
            parentRevision: revision,
            ownerCharacterId,
            title: title.trim() || revision.title,
            summary: summary.trim() || revision.summary,
            content: revision.content,
            tags: revision.tags,
            sourceType: "manual_edit" satisfies KnowledgeSourceType,
            isCanonical: false,
          })
        )
      );
    },

    shareKnowledge(ownerCharacterId, revisionId, recipientCharacterId) {
      const snapshot = controller.getSnapshot();
      const revision = snapshot.knowledgeRevisions.find((entry) => entry.id === revisionId);
      const entity = revision
        ? snapshot.knowledgeEntities.find((entry) => entry.id === revision.entityId)
        : null;
      const owner = getCharacter(snapshot, ownerCharacterId);
      const recipient = getCharacter(snapshot, recipientCharacterId);
      if (!revision || !entity || !owner || !recipient) {
        return;
      }
      const shareResult = createKnowledgeShareResult({
        state: snapshot.knowledgeState,
        entity,
        revision,
        sourceOwnerCharacterId: ownerCharacterId,
        sourceOwnerName: getCharacterName(owner),
        recipientCharacters: [recipient],
      });
      controller.updateKnowledgeState((state) => applyKnowledgeBatch(state, shareResult.batch));
      applyKnowledgeHistoryEntries(controller, shareResult.historyEntries);
    },

    toggleKnowledgePinned(ownershipId) {
      controller.updateKnowledgeState((state) => ({
        ...state,
        knowledgeOwnerships: state.knowledgeOwnerships.map((ownership) =>
          ownership.id === ownershipId ? toggleKnowledgeOwnershipPinned(ownership) : ownership
        ),
      }));
    },

    toggleKnowledgeArchived(ownershipId) {
      controller.updateKnowledgeState((state) => ({
        ...state,
        knowledgeOwnerships: state.knowledgeOwnerships.map((ownership) =>
          ownership.id === ownershipId ? toggleKnowledgeOwnershipArchived(ownership) : ownership
        ),
      }));
    },

    renameKnowledge(ownershipId, label) {
      controller.updateKnowledgeState((state) => ({
        ...state,
        knowledgeOwnerships: state.knowledgeOwnerships.map((ownership) =>
          ownership.id === ownershipId ? renameKnowledgeOwnership(ownership, label) : ownership
        ),
      }));
    },

    rollDicePool(poolSize) {
      const normalizedPoolSize = Math.max(0, Math.min(99, Math.trunc(poolSize)));
      const faces = rollD10Faces(normalizedPoolSize);
      const resolved = resolveDicePool(faces, normalizedPoolSize);
      return {
        poolSize: normalizedPoolSize,
        faces,
        successes: resolved.successes,
        botch: resolved.isBotch,
      };
    },
  };
}
