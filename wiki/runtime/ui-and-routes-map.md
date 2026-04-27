---
title: UI Reset And Future Interface Boundary
topic: runtime
kind: architecture
status: active
updated: 2026-04-26
confidence: high
---

## Summary

The previous route/component UI has been removed. The repo now keeps a minimal React/Vite/CSS shell only as a future interface entrypoint, while mechanics, data, persistence, and live-session access are exposed through pure TypeScript services.

## Current State

- `src/App.tsx` is a placeholder shell, not the game UI.
- Old route pages, presentation components, UI hooks, route navigation, and screen CSS were removed.
- `src/services/appDataController.ts` is the future UI-facing app data controller for characters, items, auctions, knowledge, authoring content, world casts, Artifact Appraisal, and active encounters.
- `src/services/appDataPersistence.ts` owns local storage hydration, serialization, starter data backfill, and backup recovery.
- `src/services/onlineSessionService.ts` owns Supabase auth/profile session behavior without React context.
- `src/lib/realtimeSessionRepository.ts` remains the Supabase campaign/session/event repository layer.
- `src/selectors/*` remains pure TypeScript view-model support that a redesigned UI may reuse or replace.

## Intended Direction

- Design the new UI last, after the core cleanup is stable.
- Future UI may be Figma-driven, Build Web Apps-driven, or hand-tuned in React/Vite/CSS.
- New screens should call services/selectors instead of recreating the removed React context/router coupling.
- Hidden information rules, item knowledge visibility, player/DM data separation, and combat masking must remain enforced by core logic, not by visual-only assumptions.

## Key Decisions

- Removing visual UI does not mean removing app behavior.
- React and Vite stay available for the next UI, but no old route/component hierarchy is authoritative.
- The new UI should be designed from current service boundaries instead of restoring the deleted pages.

## Deferred / Open

- New player and DM interface design.
- Rebuilding navigation and screen flows against the pure service layer.
- Revalidating visual hidden-information boundaries once the new UI exists.

## Sources

- [src/App.tsx](../../src/App.tsx)
- [src/main.tsx](../../src/main.tsx)
- [src/services/appDataController.ts](../../src/services/appDataController.ts)
- [src/services/appDataPersistence.ts](../../src/services/appDataPersistence.ts)
- [src/services/onlineSessionService.ts](../../src/services/onlineSessionService.ts)
- [src/lib/realtimeSessionRepository.ts](../../src/lib/realtimeSessionRepository.ts)
- [references/plan.md](../../references/plan.md)
