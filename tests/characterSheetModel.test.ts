import assert from "node:assert/strict";

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
          ["stats", "skills", "powers", "loadout", "inventory", "knowledge", "history", "notes"]
        );
        assert.equal(
          new Set(CHARACTER_SHEET_DETAIL_TABS.map((tab) => tab.id)).size,
          CHARACTER_SHEET_DETAIL_TABS.length
        );
        assert.ok(isCharacterSheetDetailTabId("loadout"));
        assert.equal(isCharacterSheetDetailTabId("combat"), false);
      },
    },
    {
      name: "summary sections use detail tabs as shortcuts without making combat a tab",
      run: () => {
        assert.deepEqual(
          CHARACTER_SHEET_SUMMARY_SECTIONS.map((section) => section.id),
          ["combat", "stats", "skills", "powers", "loadout"]
        );
        assert.equal(
          CHARACTER_SHEET_SUMMARY_SECTIONS.find((section) => section.id === "combat")
            ?.targetTabId,
          null
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
        assert.equal(model.detailTabs.length, 8);
        assert.equal(model.summarySections.length, 5);
        assert.ok(model.statGroups.some((group) => group.title === "Physical"));
        assert.ok(model.skills.length > 0);
        assert.ok(model.loadoutSlots.some((slot) => slot.slotId === "weapon_primary"));
      },
    },
  ]);
}
