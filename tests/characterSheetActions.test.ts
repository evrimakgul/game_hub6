import assert from "node:assert/strict";

import { createAppDataController } from "../src/services/appDataController.ts";
import {
  buildCharacterSheetModeIndicators,
  createCharacterSheetActions,
} from "../src/ui/characterSheetActions.ts";
import { runTestSuite } from "./harness.ts";

export async function runCharacterSheetActionTests(): Promise<void> {
  await runTestSuite("characterSheetActions", [
    {
      name: "mode indicators reflect active edit states",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const characterId = controller.createCharacter("player");
        const snapshot = controller.getSnapshot();
        const character = snapshot.characters.find((entry) => entry.id === characterId);
        assert.ok(character);

        const indicators = buildCharacterSheetModeIndicators(snapshot, character, {
          sheetEdit: true,
          progressionEdit: true,
          dmRuntimeEdit: false,
          adminOverride: false,
          reason: "",
        });

        assert.ok(indicators.some((entry) => entry.label === "Sheet Edit / Progression Edit"));
        assert.ok(indicators.some((entry) => entry.label === "Admin Locked"));
      },
    },
    {
      name: "sheet and runtime actions mutate the active character",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const actions = createCharacterSheetActions(controller);
        const characterId = controller.createCharacter("player");

        actions.updateSheetField(characterId, "name", "Elarion");
        actions.updateRuntimeField(characterId, "currentHp", 3);
        actions.appendHistoryNote(characterId, "Recovered at camp.");

        const character = controller.getSnapshot().characters.find((entry) => entry.id === characterId);
        assert.equal(character?.sheet.name, "Elarion");
        assert.equal(character?.sheet.currentHp, 3);
        assert.equal(character?.sheet.gameHistory[0]?.type, "note");
      },
    },
    {
      name: "progression actions spend XP and admin override writes audit entries",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const actions = createCharacterSheetActions(controller);
        const characterId = controller.createCharacter("player");
        controller.updateCharacter(characterId, (sheet) => ({
          ...sheet,
          xpEarned: 50,
        }));

        actions.adjustSkill(characterId, "melee", 1, {
          adminOverride: false,
          reason: "",
        });
        let character = controller.getSnapshot().characters.find((entry) => entry.id === characterId);
        assert.equal(character?.sheet.skills.find((skill) => skill.id === "melee")?.base, 1);
        assert.ok((character?.sheet.xpUsed ?? 0) > 0);

        const xpUsedAfterNormalProgression = character?.sheet.xpUsed ?? 0;
        actions.adjustStat(characterId, "STR", 1, {
          adminOverride: true,
          reason: "test override",
        });
        character = controller.getSnapshot().characters.find((entry) => entry.id === characterId);
        assert.equal(character?.sheet.statState.STR.base, 3);
        assert.equal(character?.sheet.xpUsed, xpUsedAfterNormalProgression);
        assert.ok(
          character?.sheet.dmAuditLog.some((entry) => entry.editLayer === "admin_override")
        );
      },
    },
    {
      name: "loadout, power usage, knowledge, and roll actions use existing services",
      run: () => {
        const controller = createAppDataController({ persistOnChange: false });
        const actions = createCharacterSheetActions(controller);
        const characterId = controller.createCharacter("player");
        const itemId = controller.createItem("weapon:one_handed", { name: "Test Blade" });
        controller.assignItemToCharacter(itemId, characterId);

        actions.equipItem(characterId, "weapon_primary", itemId);
        actions.snapshotKnowledge(characterId);
        actions.resetPowerUsage(characterId, "daily");
        const roll = actions.rollDicePool(4);

        const snapshot = controller.getSnapshot();
        const character = snapshot.characters.find((entry) => entry.id === characterId);
        assert.equal(
          character?.sheet.equipment.find((entry) => entry.slot === "weapon_primary")?.itemId,
          itemId
        );
        assert.equal(snapshot.knowledgeOwnerships.length, 1);
        assert.equal(roll.faces.length, 4);
        assert.equal(typeof roll.successes, "number");
      },
    },
  ]);
}
