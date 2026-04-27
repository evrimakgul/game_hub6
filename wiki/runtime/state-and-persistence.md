---
title: State And Persistence
topic: runtime
kind: architecture
status: active
updated: 2026-04-26
confidence: high
---

## Summary

`game_hub5` remains local-first for offline/dev play, but live DM/player coordination still has an optional Supabase session layer. After the UI reset, app data and session behavior are exposed through pure TypeScript services rather than React providers.

## Current State

- `src/services/appDataController.ts` is the main app data controller for characters, item definition records, item blueprints, shared items, auction catalog entries, knowledge state, mob templates, mob groups, portal templates, active character selection, world casts, Artifact Appraisal, and the active combat encounter.
- `activeCombatEncounter` now also persists as a top-level local state collection so DM and player windows can read the same live encounter.
- `src/services/appDataPersistence.ts` handles read/write to local storage, starter data backfill, and recovery from malformed or older persisted state.
- `src/config/characterTemplate.ts` contains deep hydration helpers for character drafts, including powers, equipment, knowledge-linked history fields, status tags, and active effects.
- Persistence is local-only unless Supabase config is provided. Live DM/player sessions use Supabase Auth, Postgres rows, RLS, and realtime subscriptions.
- `src/services/onlineSessionService.ts` owns authenticated account/profile state, while `src/lib/realtimeSessionRepository.ts` owns live campaign/session/event repository operations.
- The hydration layer already carries migration burden for older item storage and seeded data evolution.
- Auction-house state now seeds from the workbook-derived catalog when old saves do not have an `auctionEntries` collection yet, while newer saves persist their current auction row set directly.
- Auction entries now persist both:
  - original stock/source text in `itemQuantity`
  - live numeric stock in `stockQuantity`
- Hydration now derives `stockQuantity` from older persisted source text such as numeric rows, `out of stock`, and `too many in stock`.
- Completed player auction transactions now mutate three persisted collections together:
  - the character sheet for money, inventory links, and history
  - shared items for the purchased item instance
  - auction entries for decremented stock
- Active combat encounter persistence now mutates a fourth top-level collection:
  - the encounter itself for round state, activity log, initiative order, and transient combatants
- The pure data controller can reload from storage and persists `activeCombatEncounter`; future UI can add window-level storage event wiring on top.
- The new authoring content types already use a Supabase-ready row/payload split at the domain layer even though current runtime storage is still browser-local.
- Authoring persistence now carries explicit difficulty metadata:
  - mob challenge rating
  - group target / party-mean challenge rating
  - portal party-mean challenge rating
  - per-stage target challenge rating
- Portal-bundle imports now normalize linked mob/group/portal ids on ingest before they are appended to local authoring state.
- The old visual UI no longer exists; future UI design should build on the service boundary instead of the removed route/component layer.

## Intended Direction

- Keep local-first storage as the offline/dev truth, but treat configured Supabase sessions as authoritative for live DM/player coordination.
- Preserve clear separation between persisted mutable data and derived runtime values so later migration stays possible.
- Continue using migration-aware hydration instead of destructive resets when storage shape changes.
- Preserve the authored-content boundary so `mob_templates`, `mob_groups`, and `portal_templates` can later move behind a repository without redesigning core data behavior.
- Build future UI state on top of the pure service layer; do not restore React context as the data source of truth.

## Key Decisions

- Local storage is the default persistence boundary; Supabase is the live-session boundary.
- Backup recovery is part of the runtime contract, not an afterthought.
- Seeded item definitions and blueprints may backfill missing persisted data without overwriting same-id user edits.
- Auction-linked shared items persist their source `auctionEntryId` alongside the normal blueprint/item-instance data.
- Auction stock is local-first mutable runtime state, not a recomputed view over the original workbook text.
- Negative HP and richer derived state must survive persistence/hydration.
- Authoring content is persisted as top-level local collections now, but its shape is already being kept compatible with a future `metadata columns + jsonb payload` storage model.
- Future visual preferences should store constrained design/layout preferences, not executable code.

## Deferred / Open

- General backend sync beyond live sessions remains out of scope.
- Encounter persistence beyond the current local runtime remains deferred for offline/dev mode.
- A future server model will need explicit mutable-vs-derived separation rules if reopened.
- New UI design and any personalized view sync remain deferred until the visual rebuild begins.

## Sources

- [src/services/appDataController.ts](../../src/services/appDataController.ts)
- [src/services/onlineSessionService.ts](../../src/services/onlineSessionService.ts)
- [src/lib/realtimeSessionRepository.ts](../../src/lib/realtimeSessionRepository.ts)
- [src/services/appDataPersistence.ts](../../src/services/appDataPersistence.ts)
- [src/config/characterTemplate.ts](../../src/config/characterTemplate.ts)
- [references/project_objective.md](../../references/project_objective.md)
- [references/project_risks.md](../../references/project_risks.md)
- [wiki/domains/view-personalization.md](../domains/view-personalization.md)
- [wiki/domains/realtime-sessions.md](../domains/realtime-sessions.md)

## Raw

- [THREAD-2.1](../../raw/codex-threads/thread-2.1-019cdf06-a91b-7df2-82ee-50051261f7f4.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [USER-AUCTION-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-auction-house-shopping.md)
- [USER-COMBAT-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-combat-mode.md)
- [USER-VIEW-PERSONALIZATION-2026-04-24](../../raw/user-approved/2026-04-24-view-personalization-roadmap.md)
- [USER-REALTIME-SESSION-2026-04-24](../../raw/user-approved/2026-04-24-realtime-dm-screen-session.md)

