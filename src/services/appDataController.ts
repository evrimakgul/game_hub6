import {
  PLAYER_CHARACTER_TEMPLATE,
  type CharacterDraft,
  normalizeCharacterDraft,
} from "../config/characterTemplate.ts";
import {
  completeAuctionTransaction as resolveCompletedAuctionTransaction,
  createDefaultAuctionHouseEntries,
  normalizeAuctionHouseEntry,
} from "../lib/auctionHouse.ts";
import {
  createEmptyMobGroup,
  createEmptyMobTemplate,
  createEmptyPortalTemplate,
  normalizeMobTemplateSheet,
  type AuthoringContentState,
} from "../lib/authoring.ts";
import {
  buildItemIndex,
  createItemBlueprintRecord,
  createItemCategoryDefinitionRecord,
  createItemSubcategoryDefinitionRecord,
  createSharedItemRecord,
  normalizeCharacterEquipmentAnchors,
  syncItemsWithBlueprint,
  syncSharedItemRecordWithBlueprint,
  updateBlueprintOverrideList,
} from "../lib/items.ts";
import { executeArtifactAppraisalWorldCast, prepareWorldCastRequest } from "../lib/worldCasting.ts";
import { WorldExecutionEngine } from "../engine/worldExecutionEngine.ts";
import { setCharacterSupplementarySlotEnabled as setCharacterSupplementarySlotEnabledOnSheet } from "../mutations/characterItemMutations.ts";
import { getIsoTimestamp } from "../lib/ids.ts";
import type { AuctionHouseEntry, AuctionTransactionMode } from "../types/auction.ts";
import type { CharacterOwnerRole, CharacterRecord } from "../types/character.ts";
import type { CombatEncounterState } from "../types/combatEncounter.ts";
import type { WorldCastRequestPayload } from "../lib/powerCasting.ts";
import type {
  ItemBlueprintId,
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
  SharedItemRecord,
  SupplementaryEquipmentSlotId,
} from "../types/items.ts";
import type { KnowledgeState } from "../types/knowledge.ts";
import type { MobGroup, MobTemplate, PortalTemplate } from "../types/authoring.ts";
import {
  readPersistedCharactersFromStorage,
  type PersistedCharacterState,
  writePersistedCharactersToStorage,
} from "./appDataPersistence.ts";

type AuthChoice = "login" | "signup" | null;
type RoleChoice = "player" | "dm" | null;
type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

type AppDataInternalState = PersistedCharacterState & {
  authChoice: AuthChoice;
  roleChoice: RoleChoice;
};

export type CreateItemOverrides = Partial<
  Pick<
    SharedItemRecord,
    | "auctionEntryId"
    | "name"
    | "isArtifact"
    | "baseDescription"
    | "baseOverrides"
    | "bonusProfile"
    | "customProperties"
    | "knowledge"
    | "assignedCharacterId"
  >
>;

export type AppDataSnapshot = PersistedCharacterState & {
  authChoice: AuthChoice;
  roleChoice: RoleChoice;
  knowledgeState: KnowledgeState;
  authoringState: AuthoringContentState;
  activePlayerCharacter: CharacterRecord | null;
  activeDmCharacter: CharacterRecord | null;
};

export type AppDataControllerOptions = {
  storage?: StorageAdapter | null;
  initialState?: PersistedCharacterState;
  persistOnChange?: boolean;
};

export type AppDataControllerListener = (state: AppDataSnapshot) => void;

function appendUnique(values: string[], nextValue: string): string[] {
  return values.includes(nextValue) ? values : [...values, nextValue];
}

function buildKnowledgeState(state: PersistedCharacterState): KnowledgeState {
  return {
    knowledgeEntities: state.knowledgeEntities,
    knowledgeRevisions: state.knowledgeRevisions,
    knowledgeOwnerships: state.knowledgeOwnerships,
  };
}

function buildAuthoringState(state: PersistedCharacterState): AuthoringContentState {
  return {
    mobTemplates: state.mobTemplates,
    mobGroups: state.mobGroups,
    portalTemplates: state.portalTemplates,
  };
}

export class AppDataController {
  private state: AppDataInternalState;
  private readonly storage: StorageAdapter | null;
  private readonly persistOnChange: boolean;
  private readonly listeners = new Set<AppDataControllerListener>();

  constructor(options: AppDataControllerOptions = {}) {
    this.storage = options.storage ?? null;
    this.persistOnChange = options.persistOnChange ?? true;
    const persistedState =
      options.initialState ?? readPersistedCharactersFromStorage(this.storage);
    this.state = {
      ...persistedState,
      authChoice: null,
      roleChoice: null,
    };
  }

  getSnapshot(): AppDataSnapshot {
    const activePlayerCharacter =
      this.state.characters.find(
        (character) => character.id === this.state.activePlayerCharacterId
      ) ?? null;
    const activeDmCharacter =
      this.state.characters.find((character) => character.id === this.state.activeDmCharacterId) ??
      null;

    return {
      ...this.toPersistedState(),
      authChoice: this.state.authChoice,
      roleChoice: this.state.roleChoice,
      knowledgeState: buildKnowledgeState(this.state),
      authoringState: buildAuthoringState(this.state),
      activePlayerCharacter,
      activeDmCharacter,
    };
  }

  subscribe(listener: AppDataControllerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  chooseAuth(choice: Exclude<AuthChoice, null>): void {
    this.commit({ ...this.state, authChoice: choice });
  }

  chooseRole(choice: Exclude<RoleChoice, null>): void {
    this.commit({ ...this.state, roleChoice: choice });
  }

  createCharacter(ownerRole: CharacterOwnerRole = "player"): string {
    const characterId = `character-${Date.now()}-${this.state.characters.length + 1}`;
    const character: CharacterRecord = {
      id: characterId,
      ownerRole,
      sheet: PLAYER_CHARACTER_TEMPLATE.createInstance(),
    };

    this.commit({
      ...this.state,
      characters: [...this.state.characters, character],
      activeDmCharacterId: ownerRole === "dm" ? characterId : this.state.activeDmCharacterId,
      activePlayerCharacterId:
        ownerRole === "player" ? characterId : this.state.activePlayerCharacterId,
    });

    return characterId;
  }

  selectCharacter(characterId: string): void {
    const selectedCharacter =
      this.state.characters.find((character) => character.id === characterId) ?? null;
    if (!selectedCharacter) {
      return;
    }

    this.commit({
      ...this.state,
      activeDmCharacterId:
        selectedCharacter.ownerRole === "dm" ? characterId : this.state.activeDmCharacterId,
      activePlayerCharacterId:
        selectedCharacter.ownerRole === "player"
          ? characterId
          : this.state.activePlayerCharacterId,
    });
  }

  replaceCharacters(characters: CharacterRecord[]): void {
    this.commit({
      ...this.state,
      characters: characters.map((character) => ({
        ...character,
        sheet: this.normalizeSheetEquipment(character.sheet, this.state),
      })),
    });
  }

  updateCharacter(
    characterId: string,
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ): void {
    this.commit({
      ...this.state,
      characters: this.state.characters.map((character) => {
        if (character.id !== characterId) {
          return character;
        }

        const nextSheet = typeof updater === "function" ? updater(character.sheet) : updater;
        return {
          ...character,
          sheet: this.normalizeSheetEquipment(nextSheet, this.state),
        };
      }),
    });
  }

  deleteCharacter(characterId: string): void {
    this.commit({
      ...this.state,
      characters: this.state.characters.filter((character) => character.id !== characterId),
      items: this.state.items.map((item) =>
        item.assignedCharacterId === characterId ? { ...item, assignedCharacterId: null } : item
      ),
      activePlayerCharacterId:
        this.state.activePlayerCharacterId === characterId
          ? null
          : this.state.activePlayerCharacterId,
      activeDmCharacterId:
        this.state.activeDmCharacterId === characterId ? null : this.state.activeDmCharacterId,
    });
  }

  setCharacterSupplementarySlotEnabled(
    characterId: string,
    slotId: SupplementaryEquipmentSlotId,
    isEnabled: boolean
  ): void {
    this.commit({
      ...this.state,
      characters: this.state.characters.map((character) =>
        character.id === characterId
          ? {
              ...character,
              sheet: this.normalizeSheetEquipment(
                setCharacterSupplementarySlotEnabledOnSheet(character.sheet, slotId, isEnabled),
                this.state
              ),
            }
          : character
      ),
    });
  }

  createItem(blueprintId: ItemBlueprintId, overrides: CreateItemOverrides = {}): string {
    const nextItem = createSharedItemRecord(blueprintId, overrides, this.state.itemBlueprints);
    this.commit({
      ...this.state,
      items: [...this.state.items, nextItem],
    });
    return nextItem.id;
  }

  duplicateItem(itemId: string): string | null {
    const sourceItem = this.state.items.find((item) => item.id === itemId) ?? null;
    if (!sourceItem) {
      return null;
    }

    const nextItem = createSharedItemRecord(
      sourceItem.blueprintId,
      {
        auctionEntryId: sourceItem.auctionEntryId,
        name: sourceItem.name.trim().length > 0 ? `${sourceItem.name} Copy` : "Item Copy",
        isArtifact: sourceItem.isArtifact,
        baseDescription: sourceItem.baseDescription,
        baseOverrides: sourceItem.baseOverrides,
        bonusProfile: sourceItem.bonusProfile,
        customProperties: sourceItem.customProperties,
        baseStrength: sourceItem.baseStrength,
        anchorValueOverride: sourceItem.anchorValueOverride,
      },
      this.state.itemBlueprints
    );

    this.commit({
      ...this.state,
      items: [...this.state.items, nextItem],
    });
    return nextItem.id;
  }

  updateItem(
    itemId: string,
    updater: SharedItemRecord | ((current: SharedItemRecord) => SharedItemRecord)
  ): void {
    this.commit({
      ...this.state,
      items: this.state.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextItem = typeof updater === "function" ? updater(item) : updater;
        const blueprint = this.state.itemBlueprints.find(
          (entry) => entry.id === nextItem.blueprintId
        );
        return blueprint ? syncSharedItemRecordWithBlueprint(nextItem, blueprint) : nextItem;
      }),
    });
  }

  deleteItem(itemId: string): void {
    const nextItems = this.state.items.filter((item) => item.id !== itemId);
    this.commit({
      ...this.state,
      items: nextItems,
      itemBlueprints: this.state.itemBlueprints.map((blueprint) =>
        updateBlueprintOverrideList(blueprint, nextItems)
      ),
      characters: this.state.characters.map((character) => ({
        ...character,
        sheet: this.stripItemReferencesFromSheet(character.sheet, itemId, {
          ...this.state,
          items: nextItems,
        }),
      })),
    });
  }

  assignItemToCharacter(itemId: string, characterId: string | null): void {
    this.commit({
      ...this.state,
      characters: this.state.characters.map((character) => {
        const strippedSheet = this.stripItemReferencesFromSheet(character.sheet, itemId, this.state);
        return {
          ...character,
          sheet:
            characterId && character.id === characterId
              ? this.assignItemReferencesToSheet(strippedSheet, itemId, this.state)
              : strippedSheet,
        };
      }),
      items: this.state.items.map((item) =>
        item.id === itemId ? { ...item, assignedCharacterId: characterId } : item
      ),
    });
  }

  createItemCategoryDefinition(overrides: Partial<ItemCategoryDefinition> = {}): string {
    const nextDefinition = createItemCategoryDefinitionRecord(overrides);
    this.commit({
      ...this.state,
      itemCategoryDefinitions: [...this.state.itemCategoryDefinitions, nextDefinition],
    });
    return nextDefinition.id;
  }

  updateItemCategoryDefinition(
    categoryDefinitionId: string,
    updater: ItemCategoryDefinition | ((current: ItemCategoryDefinition) => ItemCategoryDefinition)
  ): void {
    this.commit({
      ...this.state,
      itemCategoryDefinitions: this.state.itemCategoryDefinitions.map((definition) =>
        definition.id === categoryDefinitionId
          ? {
              ...(typeof updater === "function" ? updater(definition) : updater),
              id: definition.id,
            }
          : definition
      ),
    });
  }

  deleteItemCategoryDefinition(categoryDefinitionId: string): void {
    if (
      this.state.itemSubcategoryDefinitions.some(
        (definition) => definition.categoryId === categoryDefinitionId
      ) ||
      this.state.itemBlueprints.some(
        (blueprint) => blueprint.categoryDefinitionId === categoryDefinitionId
      )
    ) {
      return;
    }

    this.commit({
      ...this.state,
      itemCategoryDefinitions: this.state.itemCategoryDefinitions.filter(
        (definition) => definition.id !== categoryDefinitionId
      ),
    });
  }

  createItemSubcategoryDefinition(overrides: Partial<ItemSubcategoryDefinition> = {}): string {
    const nextDefinition = createItemSubcategoryDefinitionRecord(overrides);
    this.commit({
      ...this.state,
      itemSubcategoryDefinitions: [
        ...this.state.itemSubcategoryDefinitions,
        nextDefinition,
      ],
    });
    return nextDefinition.id;
  }

  updateItemSubcategoryDefinition(
    subcategoryDefinitionId: string,
    updater:
      | ItemSubcategoryDefinition
      | ((current: ItemSubcategoryDefinition) => ItemSubcategoryDefinition)
  ): void {
    let nextDefinition: ItemSubcategoryDefinition | null = null;
    const nextSubcategoryDefinitions = this.state.itemSubcategoryDefinitions.map((definition) => {
      if (definition.id !== subcategoryDefinitionId) {
        return definition;
      }

      nextDefinition = createItemSubcategoryDefinitionRecord({
        ...(typeof updater === "function" ? updater(definition) : updater),
        id: definition.id,
      });
      return nextDefinition;
    });

    if (!nextDefinition) {
      return;
    }

    const updatedBlueprints = this.state.itemBlueprints.map((blueprint) =>
      blueprint.subcategoryDefinitionId === subcategoryDefinitionId
        ? createItemBlueprintRecord({
            ...blueprint,
            categoryDefinitionId: nextDefinition!.categoryId,
            subcategoryDefinitionId: nextDefinition!.id,
          })
        : blueprint
    );
    const syncedItems = updatedBlueprints.reduce(
      (nextItems, blueprint) => syncItemsWithBlueprint(nextItems, blueprint),
      this.state.items
    );

    this.commit({
      ...this.state,
      itemSubcategoryDefinitions: nextSubcategoryDefinitions,
      itemBlueprints: updatedBlueprints,
      items: syncedItems,
    });
  }

  deleteItemSubcategoryDefinition(subcategoryDefinitionId: string): void {
    if (
      this.state.itemBlueprints.some(
        (blueprint) => blueprint.subcategoryDefinitionId === subcategoryDefinitionId
      )
    ) {
      return;
    }

    this.commit({
      ...this.state,
      itemSubcategoryDefinitions: this.state.itemSubcategoryDefinitions.filter(
        (definition) => definition.id !== subcategoryDefinitionId
      ),
    });
  }

  createItemBlueprint(overrides: Partial<ItemBlueprintRecord> = {}): string {
    const nextBlueprint = createItemBlueprintRecord(overrides);
    this.commit({
      ...this.state,
      itemBlueprints: [...this.state.itemBlueprints, nextBlueprint],
    });
    return nextBlueprint.id;
  }

  updateItemBlueprint(
    blueprintId: string,
    updater: ItemBlueprintRecord | ((current: ItemBlueprintRecord) => ItemBlueprintRecord)
  ): void {
    let nextBlueprint: ItemBlueprintRecord | null = null;
    const updatedBlueprints = this.state.itemBlueprints.map((blueprint) => {
      if (blueprint.id !== blueprintId) {
        return blueprint;
      }

      nextBlueprint = createItemBlueprintRecord({
        ...(typeof updater === "function" ? updater(blueprint) : updater),
        id: blueprint.id,
      });
      return nextBlueprint;
    });

    if (!nextBlueprint) {
      return;
    }

    const syncedItems = syncItemsWithBlueprint(this.state.items, nextBlueprint);
    const normalizedBlueprint = updateBlueprintOverrideList(nextBlueprint, syncedItems);

    this.commit({
      ...this.state,
      itemBlueprints: updatedBlueprints.map((blueprint) =>
        blueprint.id === blueprintId ? normalizedBlueprint : blueprint
      ),
      items: syncedItems,
    });
  }

  deleteItemBlueprint(blueprintId: string): void {
    if (this.state.items.some((item) => item.blueprintId === blueprintId)) {
      return;
    }

    this.commit({
      ...this.state,
      itemBlueprints: this.state.itemBlueprints.filter((blueprint) => blueprint.id !== blueprintId),
    });
  }

  replaceAuctionEntries(entries: AuctionHouseEntry[]): void {
    this.commit({
      ...this.state,
      auctionEntries: entries.map((entry) => normalizeAuctionHouseEntry(entry)),
    });
  }

  resetAuctionEntries(): void {
    this.commit({
      ...this.state,
      auctionEntries: createDefaultAuctionHouseEntries(),
    });
  }

  completeAuctionTransaction(args: {
    entryId: string;
    characterId: string;
    mode: AuctionTransactionMode;
  }): { itemId: string; message: string } | { error: string } {
    const character =
      this.state.characters.find((candidate) => candidate.id === args.characterId) ?? null;
    const entry =
      this.state.auctionEntries.find((candidate) => candidate.id === args.entryId) ?? null;

    if (!character || !entry) {
      return { error: "The selected character or auction entry is no longer available." };
    }

    const resolution = resolveCompletedAuctionTransaction({
      entry,
      mode: args.mode,
      characterId: character.id,
      characterName: character.sheet.name.trim() || "Unnamed Character",
      characterMoney: character.sheet.money,
      characterGameDateTime: character.sheet.gameDateTime,
      itemBlueprints: this.state.itemBlueprints,
    });
    if ("error" in resolution) {
      return resolution;
    }

    this.commit({
      ...this.state,
      auctionEntries: this.state.auctionEntries.map((currentEntry) =>
        currentEntry.id === entry.id ? resolution.nextEntry : currentEntry
      ),
      items: [...this.state.items, resolution.createdItem],
      characters: this.state.characters.map((currentCharacter) => {
        if (currentCharacter.id !== character.id) {
          return currentCharacter;
        }

        return {
          ...currentCharacter,
          sheet: this.normalizeSheetEquipment(
            {
              ...this.assignItemReferencesToSheet(
                currentCharacter.sheet,
                resolution.createdItem.id,
                {
                  ...this.state,
                  items: [...this.state.items, resolution.createdItem],
                }
              ),
              money: Math.max(0, currentCharacter.sheet.money - resolution.moneySpent),
              gameHistory: [
                resolution.historyEntry,
                ...(currentCharacter.sheet.gameHistory ?? []),
              ],
            },
            {
              ...this.state,
              items: [...this.state.items, resolution.createdItem],
            }
          ),
        };
      }),
    });

    return {
      itemId: resolution.createdItem.id,
      message: resolution.message,
    };
  }

  createMobTemplate(overrides: Partial<MobTemplate> = {}): string {
    const nextTemplate = createEmptyMobTemplate(overrides);
    this.commit({
      ...this.state,
      mobTemplates: [...this.state.mobTemplates, nextTemplate],
    });
    return nextTemplate.id;
  }

  updateMobTemplate(
    mobTemplateId: string,
    updater: MobTemplate | ((current: MobTemplate) => MobTemplate)
  ): void {
    this.commit({
      ...this.state,
      mobTemplates: this.state.mobTemplates.map((template) => {
        if (template.id !== mobTemplateId) {
          return template;
        }

        const nextTemplate = typeof updater === "function" ? updater(template) : updater;
        return {
          ...nextTemplate,
          id: template.id,
          name: nextTemplate.name.trim() || nextTemplate.sheet.name.trim() || template.name,
          sheet: normalizeMobTemplateSheet({
            ...nextTemplate.sheet,
            name:
              nextTemplate.name.trim() ||
              nextTemplate.sheet.name.trim() ||
              template.sheet.name,
          }),
          updatedAt: getIsoTimestamp(),
        };
      }),
    });
  }

  deleteMobTemplate(mobTemplateId: string): void {
    if (
      this.state.mobGroups.some((group) =>
        group.members.some((member) => member.mobTemplateId === mobTemplateId)
      )
    ) {
      return;
    }

    this.commit({
      ...this.state,
      mobTemplates: this.state.mobTemplates.filter((template) => template.id !== mobTemplateId),
    });
  }

  createMobGroup(overrides: Partial<MobGroup> = {}): string {
    const nextGroup = createEmptyMobGroup(overrides);
    this.commit({
      ...this.state,
      mobGroups: [...this.state.mobGroups, nextGroup],
    });
    return nextGroup.id;
  }

  updateMobGroup(
    mobGroupId: string,
    updater: MobGroup | ((current: MobGroup) => MobGroup)
  ): void {
    this.commit({
      ...this.state,
      mobGroups: this.state.mobGroups.map((group) =>
        group.id === mobGroupId
          ? {
              ...(typeof updater === "function" ? updater(group) : updater),
              id: group.id,
              updatedAt: getIsoTimestamp(),
            }
          : group
      ),
    });
  }

  deleteMobGroup(mobGroupId: string): void {
    if (
      this.state.portalTemplates.some((portal) =>
        portal.stages.some((stage) =>
          stage.groupReferences.some((reference) => reference.mobGroupId === mobGroupId)
        )
      )
    ) {
      return;
    }

    this.commit({
      ...this.state,
      mobGroups: this.state.mobGroups.filter((group) => group.id !== mobGroupId),
    });
  }

  createPortalTemplate(overrides: Partial<PortalTemplate> = {}): string {
    const nextPortal = createEmptyPortalTemplate(overrides);
    this.commit({
      ...this.state,
      portalTemplates: [...this.state.portalTemplates, nextPortal],
    });
    return nextPortal.id;
  }

  updatePortalTemplate(
    portalTemplateId: string,
    updater: PortalTemplate | ((current: PortalTemplate) => PortalTemplate)
  ): void {
    this.commit({
      ...this.state,
      portalTemplates: this.state.portalTemplates.map((portal) =>
        portal.id === portalTemplateId
          ? {
              ...(typeof updater === "function" ? updater(portal) : updater),
              id: portal.id,
              updatedAt: getIsoTimestamp(),
            }
          : portal
      ),
    });
  }

  deletePortalTemplate(portalTemplateId: string): void {
    this.commit({
      ...this.state,
      portalTemplates: this.state.portalTemplates.filter((portal) => portal.id !== portalTemplateId),
    });
  }

  updateAuthoringState(
    updater: AuthoringContentState | ((current: AuthoringContentState) => AuthoringContentState)
  ): void {
    const current = buildAuthoringState(this.state);
    const next = typeof updater === "function" ? updater(current) : updater;
    this.commit({
      ...this.state,
      mobTemplates: next.mobTemplates,
      mobGroups: next.mobGroups,
      portalTemplates: next.portalTemplates,
    });
  }

  updateKnowledgeState(updater: KnowledgeState | ((current: KnowledgeState) => KnowledgeState)): void {
    const current = buildKnowledgeState(this.state);
    const next = typeof updater === "function" ? updater(current) : updater;
    this.commit({
      ...this.state,
      knowledgeEntities: next.knowledgeEntities,
      knowledgeRevisions: next.knowledgeRevisions,
      knowledgeOwnerships: next.knowledgeOwnerships,
    });
  }

  executeWorldCast(payload: WorldCastRequestPayload): string | null {
    const itemsById = payload.itemsById ?? buildItemIndex(this.state.items);
    const prepared = prepareWorldCastRequest({
      ...payload,
      itemsById,
    });
    if ("error" in prepared) {
      return prepared.error;
    }

    const engine = new WorldExecutionEngine({
      characters: this.state.characters,
      knowledgeState: buildKnowledgeState(this.state),
      itemsById,
    });
    const execution = engine.executePreparedRequest(prepared.request);
    if ("error" in execution) {
      return execution.error;
    }

    this.commit({
      ...this.state,
      characters: execution.result.characters,
      knowledgeEntities: execution.result.knowledgeState.knowledgeEntities,
      knowledgeRevisions: execution.result.knowledgeState.knowledgeRevisions,
      knowledgeOwnerships: execution.result.knowledgeState.knowledgeOwnerships,
    });
    return null;
  }

  executeArtifactAppraisal(args: {
    casterCharacterId: string;
    itemId: string;
    artifactAppraisalLevel: number;
  }): string | null {
    const casterCharacter =
      this.state.characters.find((character) => character.id === args.casterCharacterId) ?? null;
    const item = this.state.items.find((entry) => entry.id === args.itemId) ?? null;

    if (!casterCharacter || !item) {
      return "The selected character or item is no longer available.";
    }

    const result = executeArtifactAppraisalWorldCast({
      casterCharacter,
      item,
      artifactAppraisalLevel: args.artifactAppraisalLevel,
      knowledgeState: buildKnowledgeState(this.state),
      context: {
        itemBlueprints: this.state.itemBlueprints,
        itemCategoryDefinitions: this.state.itemCategoryDefinitions,
        itemSubcategoryDefinitions: this.state.itemSubcategoryDefinitions,
      },
    });
    if ("error" in result) {
      return result.error;
    }

    this.commit({
      ...this.state,
      knowledgeEntities: result.knowledgeState.knowledgeEntities,
      knowledgeRevisions: result.knowledgeState.knowledgeRevisions,
      knowledgeOwnerships: result.knowledgeState.knowledgeOwnerships,
      items: this.state.items.map((currentItem) =>
        currentItem.id === item.id ? result.item : currentItem
      ),
      characters: this.appendHistoryEntries(this.state.characters, result.historyEntries),
    });
    return null;
  }

  beginCombatEncounter(encounter: CombatEncounterState): void {
    this.commit({
      ...this.state,
      activeCombatEncounter: encounter,
    });
  }

  updateCombatEncounter(
    updater: CombatEncounterState | ((current: CombatEncounterState) => CombatEncounterState)
  ): void {
    if (!this.state.activeCombatEncounter) {
      return;
    }

    this.commit({
      ...this.state,
      activeCombatEncounter:
        typeof updater === "function" ? updater(this.state.activeCombatEncounter) : updater,
    });
  }

  clearCombatEncounter(): void {
    this.commit({
      ...this.state,
      activeCombatEncounter: null,
    });
  }

  reloadFromStorage(): void {
    this.commit({
      ...readPersistedCharactersFromStorage(this.storage),
      authChoice: this.state.authChoice,
      roleChoice: this.state.roleChoice,
    });
  }

  persist(): void {
    if (!this.persistOnChange) {
      return;
    }
    writePersistedCharactersToStorage(this.storage, this.toPersistedState());
  }

  private commit(nextState: AppDataInternalState): void {
    this.state = this.normalizePersistedState(nextState);
    this.persist();
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private normalizePersistedState(state: AppDataInternalState): AppDataInternalState {
    return {
      ...state,
      characters: state.characters.map((character) => ({
        ...character,
        sheet: this.normalizeSheetEquipment(character.sheet, state),
      })),
    };
  }

  private toPersistedState(): PersistedCharacterState {
    return {
      characters: this.state.characters,
      itemCategoryDefinitions: this.state.itemCategoryDefinitions,
      itemSubcategoryDefinitions: this.state.itemSubcategoryDefinitions,
      itemBlueprints: this.state.itemBlueprints,
      items: this.state.items,
      auctionEntries: this.state.auctionEntries,
      knowledgeEntities: this.state.knowledgeEntities,
      knowledgeRevisions: this.state.knowledgeRevisions,
      knowledgeOwnerships: this.state.knowledgeOwnerships,
      mobTemplates: this.state.mobTemplates,
      mobGroups: this.state.mobGroups,
      portalTemplates: this.state.portalTemplates,
      activeCombatEncounter: this.state.activeCombatEncounter,
      starterItemsInitialized: this.state.starterItemsInitialized,
      activePlayerCharacterId: this.state.activePlayerCharacterId,
      activeDmCharacterId: this.state.activeDmCharacterId,
    };
  }

  private normalizeSheetEquipment(
    sheet: CharacterDraft,
    state: PersistedCharacterState
  ): CharacterDraft {
    return normalizeCharacterEquipmentAnchors(
      normalizeCharacterDraft(sheet),
      buildItemIndex(state.items),
      {
        itemBlueprints: state.itemBlueprints,
        itemCategoryDefinitions: state.itemCategoryDefinitions,
        itemSubcategoryDefinitions: state.itemSubcategoryDefinitions,
      }
    );
  }

  private stripItemReferencesFromSheet(
    sheet: CharacterDraft,
    itemId: string,
    state: PersistedCharacterState
  ): CharacterDraft {
    return this.normalizeSheetEquipment(
      {
        ...sheet,
        ownedItemIds: sheet.ownedItemIds.filter((entry) => entry !== itemId),
        inventoryItemIds: sheet.inventoryItemIds.filter((entry) => entry !== itemId),
        activeItemIds: sheet.activeItemIds.filter((entry) => entry !== itemId),
        equipment: sheet.equipment.map((entry) =>
          entry.itemId === itemId ? { ...entry, itemId: null, anchorSlot: null } : entry
        ),
      },
      state
    );
  }

  private assignItemReferencesToSheet(
    sheet: CharacterDraft,
    itemId: string,
    state: PersistedCharacterState
  ): CharacterDraft {
    return this.normalizeSheetEquipment(
      {
        ...sheet,
        ownedItemIds: appendUnique(sheet.ownedItemIds, itemId),
        inventoryItemIds: appendUnique(sheet.inventoryItemIds, itemId),
      },
      state
    );
  }

  private appendHistoryEntries(
    characters: CharacterRecord[],
    entries: Array<{ characterId: string; entry: CharacterRecord["sheet"]["gameHistory"][number] }>
  ): CharacterRecord[] {
    return characters.map((character) => {
      const characterEntries = entries
        .filter((entry) => entry.characterId === character.id)
        .map((entry) => entry.entry);
      if (characterEntries.length === 0) {
        return character;
      }

      return {
        ...character,
        sheet: {
          ...character.sheet,
          gameHistory: [...characterEntries, ...(character.sheet.gameHistory ?? [])],
        },
      };
    });
  }
}

export function createAppDataController(
  options: AppDataControllerOptions = {}
): AppDataController {
  return new AppDataController(options);
}
