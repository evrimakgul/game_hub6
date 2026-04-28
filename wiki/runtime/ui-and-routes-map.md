---
title: UI Reset And Future Interface Boundary
topic: runtime
kind: architecture
status: active
updated: 2026-04-27
confidence: high
---

## Summary

The previous route/component UI has been removed. The first rebuilt surface is now a compact player character sheet in React/Vite/CSS, while mechanics, data, persistence, and live-session access remain exposed through pure TypeScript services.

## Current State

- `src/App.tsx` now hosts the rebuilt player character sheet surface, or an empty-state create-character entrypoint when local storage has no player character.
- `src/ui/CharacterSheet.tsx` renders the new three-section player sheet: always-visible core state, summary-only middle cards, and a bottom detail workspace with top icon tabs.
- `src/ui/characterSheetModel.ts` maps controller snapshots into UI-local character-sheet display models, tab/icon config, mode indicators, and resistance projections.
- Old route pages, presentation components, UI hooks, route navigation, and screen CSS were removed.
- `src/services/appDataController.ts` is the future UI-facing app data controller for characters, items, auctions, knowledge, authoring content, world casts, Artifact Appraisal, and active encounters.
- `src/services/appDataPersistence.ts` owns local storage hydration, serialization, starter data backfill, and backup recovery.
- `src/services/onlineSessionService.ts` owns Supabase auth/profile session behavior without React context.
- `src/lib/realtimeSessionRepository.ts` remains the Supabase campaign/session/event repository layer.
- `src/selectors/*` remains pure TypeScript view-model support that a redesigned UI may reuse or replace.

## Intended Direction

- Continue rebuilding UI surfaces incrementally on top of the service layer.
- Future UI may be Figma-driven, Build Web Apps-driven, or hand-tuned in React/Vite/CSS.
- New screens should call services/selectors instead of recreating the removed React context/router coupling.
- Hidden information rules, item knowledge visibility, player/DM data separation, and combat masking must remain enforced by core logic, not by visual-only assumptions.
- The next character-sheet pass should closely match the accepted dark reference image at `1300 x 975`, while keeping `Resistances` in the middle dashboard where the reference shows `Combat Summary`. The top section should be shorter, the middle section should roughly double in height and show all resistances, total stats, total skills, powers with levels, and icon loadout slots, and the bottom workspace should be smaller with denser text.
- DM dashboard design remains deferred.

## Key Decisions

- Removing visual UI does not mean removing app behavior.
- React and Vite stay available for the next UI, but no old route/component hierarchy is authoritative.
- The character sheet uses UI-local tab state only; visual tab selection is not persisted into character data.
- The bottom detail workspace tabs are `Stats`, `Skills`, `Powers`, `Loadout`, `Inventory`, `Knowledge`, `History`, and `Notes`.
- Middle summary cards act as shortcuts into matching bottom detail tabs instead of expanding in place.
- The middle dashboard uses `Resistances` instead of duplicating combat summary values; resistance details live in the `Stats` tab and are derived from existing resistance mechanics.
- `NEW-UI-DESIGN-01E` is a visual fidelity pass only; it should not change mechanics/data contracts or persist tab state.

## Deferred / Open

- DM interface design.
- Character-sheet image-fidelity pass against the accepted reference.
- Rebuilding navigation and screen flows against the pure service layer.
- Revalidating visual hidden-information boundaries once the new UI exists.

## Sources

- [src/App.tsx](../../src/App.tsx)
- [src/main.tsx](../../src/main.tsx)
- [src/ui/CharacterSheet.tsx](../../src/ui/CharacterSheet.tsx)
- [src/ui/characterSheetModel.ts](../../src/ui/characterSheetModel.ts)
- [src/services/appDataController.ts](../../src/services/appDataController.ts)
- [src/services/appDataPersistence.ts](../../src/services/appDataPersistence.ts)
- [src/services/onlineSessionService.ts](../../src/services/onlineSessionService.ts)
- [src/lib/realtimeSessionRepository.ts](../../src/lib/realtimeSessionRepository.ts)
- [references/plan.md](../../references/plan.md)
