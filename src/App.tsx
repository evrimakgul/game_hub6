import { useEffect, useMemo, useState } from "react";

import { createAppDataController } from "./services/appDataController.ts";
import { CharacterSheet } from "./ui/CharacterSheet.tsx";
import { createCharacterSheetActions } from "./ui/characterSheetActions.ts";

function getBrowserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export default function App() {
  const controller = useMemo(
    () => createAppDataController({ storage: getBrowserStorage() }),
    []
  );
  const characterSheetActions = useMemo(
    () => createCharacterSheetActions(controller),
    [controller]
  );
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());

  useEffect(() => controller.subscribe(setSnapshot), [controller]);
  const activeCharacter =
    snapshot.activePlayerCharacter ??
    snapshot.characters.find((character) => character.ownerRole === "player") ??
    null;

  if (!activeCharacter) {
    return (
      <main className="empty-shell" aria-label="Convergence character sheet setup">
        <section className="panel-frame empty-panel">
          <span className="eyebrow">Convergence</span>
          <h1>No player character selected</h1>
          <p>Create a player character to open the new character sheet framework.</p>
          <button type="button" onClick={() => controller.createCharacter("player")}>
            Create Player Character
          </button>
        </section>
      </main>
    );
  }

  return (
    <CharacterSheet
      actions={characterSheetActions}
      snapshot={snapshot}
      character={activeCharacter}
    />
  );
}
