import assert from "node:assert/strict";

import { createAppDataController } from "../src/services/appDataController.ts";
import { CHARACTER_STORAGE_KEY } from "../src/services/appDataPersistence.ts";
import type { WorldCastRequestPayload } from "../src/lib/powerCasting.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import { runTestSuite } from "./harness.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createWorldPayload(args: {
  casterCharacter: CharacterRecord;
  characters: CharacterRecord[];
  selectedPower: CharacterRecord["sheet"]["powers"][number];
  selectedTargetIds: string[];
  selectedVariantId?: WorldCastRequestPayload["selectedVariantId"];
  selectedStatId?: WorldCastRequestPayload["selectedStatId"];
}): WorldCastRequestPayload {
  return {
    casterCharacter: args.casterCharacter,
    casterDisplayName: args.casterCharacter.sheet.name,
    selectedPower: args.selectedPower,
    selectedVariantId: args.selectedVariantId ?? "default",
    attackOutcome: "unresolved",
    selectedTargetIds: args.selectedTargetIds,
    fallbackTargetIds: args.selectedTargetIds,
    healingAllocations: {},
    selectedStatId: args.selectedStatId ?? null,
    castMode: "self",
    selectedDamageType: null,
    bonusManaSpend: 0,
    selectedSummonOptionId: null,
    characters: args.characters,
    itemsById: {},
  };
}

export async function runAppDataControllerTests(): Promise<void> {
  await runTestSuite("appDataController", [
    {
      name: "controller creates characters and persists core state without React",
      run: () => {
        const storage = new MemoryStorage();
        const controller = createAppDataController({ storage });
        let notifications = 0;
        controller.subscribe(() => {
          notifications += 1;
        });

        const characterId = controller.createCharacter("player");
        const snapshot = controller.getSnapshot();

        assert.equal(snapshot.activePlayerCharacter?.id, characterId);
        assert.equal(snapshot.characters.length, 1);
        assert.ok(notifications >= 1);
        assert.ok(storage.getItem(CHARACTER_STORAGE_KEY)?.includes(characterId));
      },
    },
    {
      name: "controller assigns items and completes auction transactions",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const characterId = controller.createCharacter("player");
        controller.updateCharacter(characterId, (sheet) => ({
          ...sheet,
          name: "Buyer",
          money: 1_000_000,
        }));

        const directItemId = controller.createItem("weapon:one_handed", { name: "Test Sword" });
        controller.assignItemToCharacter(directItemId, characterId);

        const entry = controller
          .getSnapshot()
          .auctionEntries.find(
            (candidate) =>
              typeof candidate.buyout === "number" &&
              candidate.buyout > 0 &&
              (candidate.stockQuantity ?? 0) > 0
          );
        assert.ok(entry);

        const transaction = controller.completeAuctionTransaction({
          entryId: entry.id,
          characterId,
          mode: "buyout",
        });
        assert.ok(!("error" in transaction));

        const snapshot = controller.getSnapshot();
        const character = snapshot.characters.find((candidate) => candidate.id === characterId);
        assert.ok(character?.sheet.inventoryItemIds.includes(directItemId));
        assert.ok(character?.sheet.inventoryItemIds.includes(transaction.itemId));
        assert.equal(
          snapshot.auctionEntries.find((candidate) => candidate.id === entry.id)?.stockQuantity,
          (entry.stockQuantity ?? 0) - 1
        );
      },
    },
    {
      name: "controller executes world casts and artifact appraisal through core services",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const casterId = controller.createCharacter("player");
        const targetId = controller.createCharacter("player");
        controller.updateCharacter(casterId, (sheet) => ({
          ...sheet,
          name: "Caster",
          currentMana: 20,
          manaInitialized: true,
          powers: [
            {
              id: "body_reinforcement",
              name: "Body Reinforcement",
              level: 3,
              governingStat: "STAM",
            },
          ],
          statState: {
            ...sheet.statState,
            STAM: {
              ...sheet.statState.STAM,
              base: 4,
            },
          },
        }));
        controller.updateCharacter(targetId, (sheet) => ({
          ...sheet,
          name: "Target",
        }));

        const castSnapshot = controller.getSnapshot();
        const caster = castSnapshot.characters.find((character) => character.id === casterId);
        assert.ok(caster);
        const castError = controller.executeWorldCast(
          createWorldPayload({
            casterCharacter: caster,
            characters: castSnapshot.characters,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [targetId],
            selectedStatId: "STR",
          })
        );
        assert.equal(castError, null);
        assert.equal(
          controller
            .getSnapshot()
            .characters.find((character) => character.id === targetId)?.sheet.activePowerEffects
            .length,
          1
        );

        const itemId = controller.createItem("weapon:one_handed", { name: "Unknown Sword" });
        const appraisalError = controller.executeArtifactAppraisal({
          casterCharacterId: casterId,
          itemId,
          artifactAppraisalLevel: 1,
        });
        assert.equal(appraisalError, null);

        const finalSnapshot = controller.getSnapshot();
        assert.equal(finalSnapshot.knowledgeEntities.length, 1);
        assert.ok(
          finalSnapshot.characters
            .find((character) => character.id === casterId)
            ?.sheet.gameHistory.some((entry) => entry.knowledgeLink)
        );
      },
    },
  ]);
}
