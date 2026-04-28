import assert from "node:assert/strict";

import { createEmptyBonusProfile } from "../src/lib/items.ts";
import { createAppDataController } from "../src/services/appDataController.ts";
import {
  buildCharacterSheetUiModel,
  CHARACTER_SHEET_DETAIL_TABS,
  CHARACTER_SHEET_SUMMARY_SECTIONS,
  isCharacterSheetDetailTabId,
} from "../src/ui/characterSheetModel.ts";
import { runTestSuite } from "./harness.ts";

export async function runCharacterSheetModelTests(): Promise<void> {
  await runTestSuite("characterSheetModel", [
    {
      name: "detail tab config preserves the accepted workspace order",
      run: () => {
        assert.deepEqual(
          CHARACTER_SHEET_DETAIL_TABS.map((tab) => tab.id),
          [
            "resistances",
            "stats",
            "skills",
            "powers",
            "loadout",
            "inventory",
            "knowledge",
            "history",
            "notes",
          ]
        );
        assert.equal(
          new Set(CHARACTER_SHEET_DETAIL_TABS.map((tab) => tab.id)).size,
          CHARACTER_SHEET_DETAIL_TABS.length
        );
        assert.ok(isCharacterSheetDetailTabId("resistances"));
        assert.ok(isCharacterSheetDetailTabId("loadout"));
        assert.equal(isCharacterSheetDetailTabId("combat"), false);
      },
    },
    {
      name: "summary sections use resistances and detail tabs as shortcuts",
      run: () => {
        assert.deepEqual(
          CHARACTER_SHEET_SUMMARY_SECTIONS.map((section) => section.id),
          ["resistances", "stats", "skills", "powers", "loadout"]
        );
        assert.equal(
          CHARACTER_SHEET_SUMMARY_SECTIONS.find((section) => section.id === "resistances")
            ?.targetTabId,
          "resistances"
        );
        assert.equal(
          CHARACTER_SHEET_SUMMARY_SECTIONS.find((section) => section.id === "stats")
            ?.targetTabId,
          "stats"
        );
      },
    },
    {
      name: "ui model maps controller data into core, summary, and detail sections",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const characterId = controller.createCharacter("player");
        controller.updateCharacter(characterId, (sheet) => ({
          ...sheet,
          name: "Tab Runner",
          concept: "Occult scout",
          faction: "Convergence",
          xpEarned: 40,
          xpUsed: 12,
          currentMana: 3,
          manaInitialized: true,
          powers: [
            {
              id: "awareness",
              name: "Awareness",
              level: 2,
              governingStat: "PER",
            },
          ],
        }));

        const snapshot = controller.getSnapshot();
        const character = snapshot.activePlayerCharacter;
        assert.ok(character);

        const model = buildCharacterSheetUiModel(snapshot, character);

        assert.equal(model.identity.name, "Tab Runner");
        assert.equal(model.identity.concept, "Occult scout");
        assert.equal(model.identity.xpLeftOver, 28);
        assert.equal(model.resources.mana, 3);
        assert.equal(model.powers[0]?.name, "Awareness");
        assert.equal(model.detailTabs.length, 9);
        assert.equal(model.summarySections.length, 5);
        assert.ok(model.statGroups.some((group) => group.title === "Physical"));
        assert.ok(model.skills.length > 0);
        assert.ok(model.loadoutSlots.some((slot) => slot.slotId === "weapon_primary"));
        assert.equal(model.loadoutSlots.length, 10);
        assert.ok(model.loadoutSlots.some((slot) => slot.slotId === "orbital" && !slot.item));
        assert.equal(model.resistanceRows.length, 11);
        assert.ok(model.modeIndicators.some((indicator) => indicator.label === "View Only"));
      },
    },
    {
      name: "ui model resolves resistance rows from base, item, and power modifiers",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const characterId = controller.createCharacter("player");
        const itemId = controller.createItem("weapon:one_handed", {
          name: "Hidden Ward Blade",
          bonusProfile: {
            ...createEmptyBonusProfile(),
            resistanceBonuses: { fire: 1 },
          },
        });
        controller.assignItemToCharacter(itemId, characterId);
        controller.updateCharacter(characterId, (sheet) => ({
          ...sheet,
          resistances: {
            ...sheet.resistances,
            fire: -1,
            cold: 2,
          },
          activeItemIds: [itemId],
          activePowerEffects: [
            {
              id: "effect-fire-ward",
              stackKey: "effect-fire-ward",
              effectKind: "direct",
              powerId: "light_support",
              powerName: "Light Support",
              sourceLevel: 5,
              casterCharacterId: characterId,
              casterName: "Tab Runner",
              targetCharacterId: characterId,
              sourceEffectId: null,
              shareMode: null,
              sharedTargetCharacterIds: null,
              label: "Fire Ward",
              summary: "Raises fire resistance.",
              actionType: null,
              manaCost: null,
              selectedStatId: null,
              modifiers: [
                {
                  targetType: "resistance",
                  targetId: "fire",
                  value: 1,
                  sourceLabel: "Fire Ward",
                },
              ],
              appliedAt: "2026-04-27T00:00:00.000Z",
            },
          ],
        }));

        const snapshot = controller.getSnapshot();
        const character = snapshot.activePlayerCharacter;
        assert.ok(character);

        const model = buildCharacterSheetUiModel(snapshot, character);
        const fire = model.resistanceRows.find((row) => row.id === "fire");
        const cold = model.resistanceRows.find((row) => row.id === "cold");

        assert.equal(fire?.baseLevel, -1);
        assert.equal(fire?.modifier, 2);
        assert.equal(fire?.resolvedLevel, 1);
        assert.equal(fire?.state, "resist");
        assert.equal(cold?.state, "immune");
        assert.deepEqual(
          model.highlightedResistanceRows.map((row) => row.id).sort(),
          ["cold", "fire"]
        );
        assert.ok(model.status.effects.includes("Fire Ward"));
      },
    },
    {
      name: "concealed inventory items do not expose hidden bonus details",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const characterId = controller.createCharacter("player");
        const itemId = controller.createItem("weapon:one_handed", {
          name: "Veiled Knife",
          isArtifact: true,
          bonusProfile: {
            ...createEmptyBonusProfile(),
            derivedBonuses: { melee_damage: 4 },
          },
        });
        controller.assignItemToCharacter(itemId, characterId);

        const snapshot = controller.getSnapshot();
        const character = snapshot.activePlayerCharacter;
        assert.ok(character);

        const model = buildCharacterSheetUiModel(snapshot, character);
        const item = model.inventoryItems.find((row) => row.id === itemId);

        assert.ok(item);
        assert.equal(item.isKnown, false);
        assert.doesNotMatch(item.summary, /Bonus:/);
        assert.doesNotMatch(item.summary, /Melee Damage/i);
        assert.doesNotMatch(item.summary, /\+4/);
      },
    },
  ]);
}
