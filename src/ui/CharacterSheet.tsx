import { useMemo, useState } from "react";

import { formatDateDayMonthYear } from "../lib/dateTime.ts";
import {
  getKnowledgeEntityTypeLabel,
  getKnowledgeGroupsForOwner,
} from "../lib/knowledge.ts";
import { getWorldCastTargetOptions } from "../lib/worldCasting.ts";
import {
  getCastPowerAllowedStats,
  getCastPowerTargetModeForVariant,
  getCastPowerVariantOptions,
} from "../rules/powerEffects.ts";
import type { AppDataSnapshot } from "../services/appDataController.ts";
import type { CharacterRecord, StatId } from "../types/character.ts";
import type { CastPowerVariantId } from "../powers/spellTypes.ts";
import {
  buildCharacterSheetModeIndicators,
  canUseAdminAction,
  canUseProgressionEdit,
  canUseRuntimeEdit,
  canUseSheetEdit,
  DEFAULT_CHARACTER_SHEET_MODE_STATE,
  type CharacterSheetActions,
  type CharacterSheetModeState,
} from "./characterSheetActions.ts";
import {
  buildCharacterSheetUiModel,
  CHARACTER_SHEET_DETAIL_TABS,
  type CharacterSheetDetailTabId,
  type CharacterSheetIconId,
  type CharacterSheetItemRow,
  type CharacterSheetResistanceRow,
  type CharacterSheetSummarySectionId,
  type CharacterSheetUiModel,
} from "./characterSheetModel.ts";

type CharacterSheetProps = {
  snapshot: AppDataSnapshot;
  character: CharacterRecord;
  actions: CharacterSheetActions;
};

type DetailRenderContext = {
  character: CharacterRecord;
  snapshot: AppDataSnapshot;
  actions: CharacterSheetActions;
  mode: CharacterSheetModeState;
  statFloors: Partial<Record<StatId, number>>;
  selectedPowerId: string;
  setSelectedPowerId: (powerId: string) => void;
  selectedVariantId: CastPowerVariantId;
  setSelectedVariantId: (variantId: CastPowerVariantId) => void;
  selectedTargetIds: string[];
  setSelectedTargetIds: (targetIds: string[]) => void;
  selectedStatId: StatId | null;
  setSelectedStatId: (statId: StatId | null) => void;
  castMessage: string;
  setCastMessage: (message: string) => void;
  selectedAddPowerId: string;
  setSelectedAddPowerId: (powerId: string) => void;
  sessionNote: string;
  setSessionNote: (note: string) => void;
  showArchivedKnowledge: boolean;
  setShowArchivedKnowledge: (showArchived: boolean) => void;
  selectedKnowledgeRevisionId: string;
  setSelectedKnowledgeRevisionId: (revisionId: string) => void;
  compareKnowledgeRevisionId: string;
  setCompareKnowledgeRevisionId: (revisionId: string) => void;
  knowledgeDraftTitle: string;
  setKnowledgeDraftTitle: (title: string) => void;
  knowledgeDraftSummary: string;
  setKnowledgeDraftSummary: (summary: string) => void;
  shareRecipientId: string;
  setShareRecipientId: (recipientId: string) => void;
};

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SheetIcon({ icon }: { icon: CharacterSheetIconId }) {
  switch (icon) {
    case "armor":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
          <path d="M12 6v11" />
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 4h8a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4V4z" />
          <path d="M17 8h2v12" />
          <path d="M8 8h5M8 12h5" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7l8-4 8 4-8 4-8-4z" />
          <path d="M4 7v10l8 4 8-4V7" />
          <path d="M12 11v10" />
        </svg>
      );
    case "brain":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 4a4 4 0 0 0-4 4v7a5 5 0 0 0 5 5h1V4H9z" />
          <path d="M15 4a4 4 0 0 1 4 4v7a5 5 0 0 1-5 5h-1V4h2z" />
          <path d="M7 10h4M13 10h4M8 15h3M13 15h3" />
        </svg>
      );
    case "clock":
    case "history":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
          <path d="M5 5v5h5" />
        </svg>
      );
    case "coin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 7v10M9 9h5a2 2 0 0 1 0 4H9" />
        </svg>
      );
    case "flame":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21a7 7 0 0 0 7-7c0-4-4-7-5-11-3 2-7 6-7 11a5 5 0 0 0 5 5z" />
          <path d="M12 17a3 3 0 0 0 3-3c0-2-2-4-3-5-1 1-3 3-3 5a3 3 0 0 0 3 3z" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20s-8-5-8-11a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 6-6 9-6 11z" />
        </svg>
      );
    case "loadout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h10l2 6-2 10H7L5 10l2-6z" />
          <path d="M9 4v6h6V4M7 14h10" />
        </svg>
      );
    case "mana":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l6 8-6 10-6-10 6-8z" />
          <path d="M8 11h8" />
        </svg>
      );
    case "note":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h9l3 3v15H6V3z" />
          <path d="M14 3v4h4M9 11h6M9 15h6" />
        </svg>
      );
    case "power":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2L5 13h6l-1 9 9-12h-6l0-8z" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" />
        </svg>
      );
    case "skill":
    case "target":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7z" />
        </svg>
      );
    case "stats":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19V9M12 19V5M19 19v-7" />
          <path d="M4 19h16" />
        </svg>
      );
    case "sword":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4l6 6-9 9-6-6 9-9z" />
          <path d="M5 19l4-4M8 12l4 4" />
        </svg>
      );
    case "walk":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
          <path d="M10 8l4 3-2 4 4 5M10 8l-3 4M12 15l-5 5" />
        </svg>
      );
  }
}

function EmptyList({ label }: { label: string }) {
  return <p className="empty-list">{label}</p>;
}

function ItemLine({ item }: { item: CharacterSheetItemRow }) {
  return (
    <div className="item-line">
      <span className="item-line-icon">
        <SheetIcon icon={item.icon} />
      </span>
      <span>
        <strong>{item.name}</strong>
        <small>{item.blueprintLabel}</small>
      </span>
      <em className={item.isKnown ? "known" : "concealed"}>
        {item.isKnown ? "Known" : "Concealed"}
      </em>
    </div>
  );
}

function ResistanceChip({
  row,
  compact = false,
}: {
  row: CharacterSheetResistanceRow;
  compact?: boolean;
}) {
  return (
    <div className={`resistance-chip resistance-${row.state} ${compact ? "compact" : ""}`}>
      <span>{row.label}</span>
      <strong>{row.levelLabel}</strong>
      <small>
        {row.multiplierLabel}
        {row.modifier !== 0 ? ` / ${formatSigned(row.modifier)}` : ""}
      </small>
    </div>
  );
}

function getLoadoutTooltip(slot: CharacterSheetUiModel["loadoutSlots"][number]): string {
  if (!slot.item) {
    return `${slot.label}: open slot`;
  }

  return `${slot.label}: ${slot.item.name}. ${slot.item.summary}`;
}

function StatusRow({
  icon,
  label,
  value,
}: {
  icon: CharacterSheetIconId;
  label: string;
  value: string;
}) {
  return (
    <div className="status-row">
      <SheetIcon icon={icon} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResourceTile({
  icon,
  label,
  value,
  tone,
  dots,
}: {
  icon: CharacterSheetIconId;
  label: string;
  value: string;
  tone: string;
  dots?: number;
}) {
  return (
    <div className={`resource-tile ${tone}`}>
      <SheetIcon icon={icon} />
      <span>{label}</span>
      {dots ? (
        <div className="resource-dots" aria-label={`${label}: ${dots}`}>
          {Array.from({ length: Math.min(dots, 5) }, (_, index) => (
            <i key={index} />
          ))}
        </div>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function ReadinessMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="readiness-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : <small>&nbsp;</small>}
    </div>
  );
}

function NumberEditor({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field-control compact">
      <span>{label}</span>
      <input
        disabled={disabled}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TextEditor({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className={`field-control ${multiline ? "multiline" : ""}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function ProgressionButtons({
  onDecrease,
  onIncrease,
  disabled,
}: {
  onDecrease: () => void;
  onIncrease: () => void;
  disabled: boolean;
}) {
  if (disabled) {
    return null;
  }

  return (
    <span className="stepper-controls">
      <button type="button" onClick={onDecrease}>
        -
      </button>
      <button type="button" onClick={onIncrease}>
        +
      </button>
    </span>
  );
}

function getProgressionOptions(context: DetailRenderContext) {
  return {
    adminOverride: context.mode.adminOverride,
    reason: context.mode.reason,
    statFloors: context.statFloors,
  };
}

function renderStatsDetail(model: CharacterSheetUiModel, context: DetailRenderContext) {
  const canProgress = canUseProgressionEdit(context.mode) && canUseAdminAction(context.mode);
  return (
    <div className="stat-detail-grid">
      {model.statGroups.map((group) => (
        <section className="detail-card" key={group.title}>
          <h3>
            <SheetIcon icon={group.icon} />
            {group.title}
          </h3>
          <div className="stat-table">
            <span>Stat</span>
            <span>Base</span>
            <span>Gear</span>
            <span>Buffs</span>
            <span>Total</span>
            {group.stats.map((stat) => (
              <div className="stat-row" key={stat.id}>
                <strong>
                  {stat.id}
                  <ProgressionButtons
                    disabled={!canProgress}
                    onDecrease={() =>
                      context.actions.adjustStat(
                        context.character.id,
                        stat.id,
                        -1,
                        getProgressionOptions(context)
                      )
                    }
                    onIncrease={() =>
                      context.actions.adjustStat(
                        context.character.id,
                        stat.id,
                        1,
                        getProgressionOptions(context)
                      )
                    }
                  />
                </strong>
                <span>{stat.base}</span>
                <span>{formatSigned(stat.gear)}</span>
                <span>{formatSigned(stat.buffs)}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function renderResistanceDetail(model: CharacterSheetUiModel) {
  return (
    <section className="detail-card detail-card-full resistance-detail-card standalone">
      <h3>
        <SheetIcon icon="shield" />
        Resistances
      </h3>
      <div className="resistance-detail-grid">
        {model.resistanceRows.map((row) => (
          <ResistanceChip key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function getSummaryButtonClass(
  summaryId: CharacterSheetSummarySectionId,
  targetTabId: CharacterSheetDetailTabId,
  activeTabId: CharacterSheetDetailTabId
): string {
  return `summary-card panel-frame summary-button summary-${summaryId}${
    activeTabId === targetTabId ? " summary-active" : ""
  }`;
}

function renderResistanceSummary(model: CharacterSheetUiModel) {
  return (
    <div className="resistance-summary-grid">
      {model.resistanceRows.map((row) => (
        <ResistanceChip compact key={row.id} row={row} />
      ))}
    </div>
  );
}

function renderSummaryCard(
  model: CharacterSheetUiModel,
  activeTabId: CharacterSheetDetailTabId,
  setActiveTabId: (tabId: CharacterSheetDetailTabId) => void,
  summaryId: CharacterSheetSummarySectionId
) {
  switch (summaryId) {
    case "resistances":
      return (
        <button
          className={getSummaryButtonClass("resistances", "resistances", activeTabId)}
          key="resistances"
          onClick={() => setActiveTabId("resistances")}
          type="button"
        >
          <header>
            <SheetIcon icon="shield" />
            <h2>Resistances</h2>
          </header>
          {renderResistanceSummary(model)}
        </button>
      );
    case "stats":
      return (
        <button
          className={getSummaryButtonClass("stats", "stats", activeTabId)}
          key="stats"
          type="button"
          onClick={() => setActiveTabId("stats")}
        >
          <header>
            <SheetIcon icon="stats" />
            <h2>Stats</h2>
          </header>
          <div className="summary-stat-groups">
            {model.statGroups.map((group) => (
              <div className="summary-stat-group" key={group.title}>
                <span>{group.title}</span>
                <div>
                  {group.stats.map((stat) => (
                    <strong key={stat.id}>
                      {stat.id}
                      <em>{stat.value}</em>
                    </strong>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </button>
      );
    case "skills":
      return (
        <button
          className={getSummaryButtonClass("skills", "skills", activeTabId)}
          key="skills"
          type="button"
          onClick={() => setActiveTabId("skills")}
        >
          <header>
            <SheetIcon icon="skill" />
            <h2>Skills</h2>
          </header>
          <div className="summary-skill-grid">
            {model.skills.map((skill) => (
              <div className="summary-mini-row" key={skill.id}>
                <span>{skill.label}</span>
                <strong>{formatSigned(skill.total)}</strong>
              </div>
            ))}
          </div>
        </button>
      );
    case "powers":
      return (
        <button
          className={getSummaryButtonClass("powers", "powers", activeTabId)}
          key="powers"
          type="button"
          onClick={() => setActiveTabId("powers")}
        >
          <header>
            <SheetIcon icon="power" />
            <h2>Powers</h2>
          </header>
          {model.powers.length > 0 ? (
            <div className="summary-power-list">
              {model.powers.map((power) => (
                <div className="summary-mini-row" key={power.id}>
                  <span>{power.name}</span>
                  <strong>Lv {power.level}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyList label="No powers." />
          )}
        </button>
      );
    case "loadout":
      return (
        <button
          className={getSummaryButtonClass("loadout", "loadout", activeTabId)}
          key="loadout"
          type="button"
          onClick={() => setActiveTabId("loadout")}
        >
          <header>
            <SheetIcon icon="loadout" />
            <h2>Loadout</h2>
          </header>
          <div className="summary-loadout-grid" aria-label="Loadout slots">
            {model.loadoutSlots.map((slot) => (
              <span
                className={`summary-loadout-slot ${slot.item ? "equipped" : "open"}`}
                data-tooltip={getLoadoutTooltip(slot)}
                key={slot.slotId}
                title={getLoadoutTooltip(slot)}
              >
                <SheetIcon icon={slot.item?.icon ?? slot.icon} />
                <small>{slot.label}</small>
              </span>
            ))}
          </div>
        </button>
      );
    default:
      return null;
  }
}

function renderSkillsDetail(model: CharacterSheetUiModel, context: DetailRenderContext) {
  const canProgress = canUseProgressionEdit(context.mode) && canUseAdminAction(context.mode);
  return (
    <div className="detail-card detail-card-full">
      <div className="skill-table">
        <span>Skill</span>
        <span>Stat</span>
        <span>Base</span>
        <span>Total</span>
        {model.skills.map((skill) => (
          <div className="skill-row" key={skill.id}>
            <strong>
              {skill.label}
              <ProgressionButtons
                disabled={!canProgress}
                onDecrease={() =>
                  context.actions.adjustSkill(
                    context.character.id,
                    skill.id,
                    -1,
                    getProgressionOptions(context)
                  )
                }
                onIncrease={() =>
                  context.actions.adjustSkill(
                    context.character.id,
                    skill.id,
                    1,
                    getProgressionOptions(context)
                  )
                }
              />
            </strong>
            <span>{skill.rollStat}</span>
            <span>{skill.base}</span>
            <strong>{formatSigned(skill.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderPowersDetail(model: CharacterSheetUiModel, context: DetailRenderContext) {
  const canProgress = canUseProgressionEdit(context.mode) && canUseAdminAction(context.mode);
  const selectedPower =
    context.character.sheet.powers.find((power) => power.id === context.selectedPowerId) ??
    context.character.sheet.powers[0] ??
    null;
  const variantOptions = selectedPower ? getCastPowerVariantOptions(selectedPower) : [];
  const selectedVariant =
    variantOptions.find((option) => option.id === context.selectedVariantId) ??
    variantOptions[0] ??
    null;
  const targetOptions =
    selectedPower && selectedVariant
      ? getWorldCastTargetOptions({
          casterCharacter: context.character,
          characters: context.snapshot.characters,
          selectedPower,
          selectedVariantId: selectedVariant.id,
        })
      : [];
  const targetMode =
    selectedPower && selectedVariant
      ? getCastPowerTargetModeForVariant(selectedPower, selectedVariant.id)
      : "single";
  const statOptions = selectedPower ? getCastPowerAllowedStats(selectedPower) : [];

  const castSelectedPower = () => {
    if (!selectedPower || !selectedVariant) {
      context.setCastMessage("Select a power first.");
      return;
    }

    const error = context.actions.castWorldPower({
      characterId: context.character.id,
      powerId: selectedPower.id,
      variantId: selectedVariant.id,
      targetIds:
        targetMode === "self"
          ? [context.character.id]
          : context.selectedTargetIds.length > 0
            ? context.selectedTargetIds
            : targetOptions[0]
              ? [targetOptions[0].id]
              : [],
      selectedStatId: context.selectedStatId,
      castMode: "self",
      selectedDamageType: null,
      bonusManaSpend: 0,
      selectedSummonOptionId: null,
      healingAllocations: {},
    });
    context.setCastMessage(error ?? `${selectedPower.name} resolved.`);
  };

  if (model.powers.length === 0 && !canProgress) {
    return <EmptyList label="No known powers yet." />;
  }

  return (
    <div className="power-workspace">
      <div className="power-grid">
        {model.powers.map((power) => (
          <section className="detail-card power-card" key={power.id}>
            <h3>
              <SheetIcon icon="power" />
              {power.name}
              <ProgressionButtons
                disabled={!canProgress}
                onDecrease={() =>
                  context.actions.adjustPower(
                    context.character.id,
                    power.id,
                    -1,
                    getProgressionOptions(context)
                  )
                }
                onIncrease={() =>
                  context.actions.adjustPower(
                    context.character.id,
                    power.id,
                    1,
                    getProgressionOptions(context)
                  )
                }
              />
            </h3>
            <div className="power-meta">
              <span>Level {power.level}</span>
              <span>{power.governingStat}</span>
            </div>
            <button
              className="inline-action"
              type="button"
              onClick={() => {
                context.setSelectedPowerId(power.id);
                const firstVariant = getCastPowerVariantOptions(
                  context.character.sheet.powers.find((entry) => entry.id === power.id) ??
                    context.character.sheet.powers[0]
                )[0];
                if (firstVariant) {
                  context.setSelectedVariantId(firstVariant.id);
                }
              }}
            >
              Use
            </button>
          </section>
        ))}
      </div>
      {canProgress ? (
        <section className="detail-card action-panel">
          <h3>Add Power</h3>
          <div className="inline-form">
            <select
              value={context.selectedAddPowerId}
              onChange={(event) => context.setSelectedAddPowerId(event.target.value)}
            >
              <option value="">Select power</option>
              {model.availablePowerOptions.map((power) => (
                <option key={power.id} value={power.id}>
                  {power.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!context.selectedAddPowerId}
              onClick={() =>
                context.actions.addPower(
                  context.character.id,
                  context.selectedAddPowerId,
                  getProgressionOptions(context)
                )
              }
            >
              Add
            </button>
          </div>
        </section>
      ) : null}
      {selectedPower ? (
        <section className="detail-card action-panel power-cast-panel">
          <h3>Use Power: {selectedPower.name}</h3>
          <label className="field-control">
            <span>Variant</span>
            <select
              value={selectedVariant?.id ?? ""}
              onChange={(event) => context.setSelectedVariantId(event.target.value as CastPowerVariantId)}
            >
              {variantOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {targetMode !== "self" ? (
            <label className="field-control">
              <span>Target</span>
              <select
                multiple={targetMode === "multiple"}
                value={context.selectedTargetIds}
                onChange={(event) =>
                  context.setSelectedTargetIds(
                    Array.from(event.currentTarget.selectedOptions).map((option) => option.value)
                  )
                }
              >
                {targetOptions.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {statOptions.length > 0 ? (
            <label className="field-control">
              <span>Stat Used</span>
              <select
                value={context.selectedStatId ?? statOptions[0] ?? ""}
                onChange={(event) => context.setSelectedStatId(event.target.value as StatId)}
              >
                {statOptions.map((statId) => (
                  <option key={statId} value={statId}>
                    {statId}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="action-row">
            <button type="button" onClick={castSelectedPower}>
              Cast / Use
            </button>
            <button
              type="button"
              onClick={() => context.actions.resetPowerUsage(context.character.id, "daily")}
            >
              Reset Daily
            </button>
            <button
              type="button"
              onClick={() => context.actions.resetPowerUsage(context.character.id, "longRest")}
            >
              Reset Long Rest
            </button>
          </div>
          {model.powerUsageRows.length > 0 ? (
            <div className="usage-list">
              {model.powerUsageRows.map((row) => (
                <span key={row.id}>
                  {row.label}: {row.detail} ({row.resetLabel})
                </span>
              ))}
            </div>
          ) : null}
          {context.castMessage ? <p className="form-message">{context.castMessage}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function renderLoadoutDetail(model: CharacterSheetUiModel, context: DetailRenderContext) {
  const carriedItems = model.inventoryItems.filter((item) => item.isCarried);
  return (
    <div className="loadout-grid">
      {model.loadoutSlots.map((slot) => (
        <section
          className={`detail-card loadout-slot ${slot.item ? "equipped" : "open"}`}
          key={slot.slotId}
        >
          <h3>
            <SheetIcon icon={slot.icon} />
            {slot.label}
            <span className="slot-state">{slot.item ? "Equipped" : "Open"}</span>
          </h3>
          {slot.item ? (
            <>
              <strong>{slot.item.name}</strong>
              <p>{slot.item.summary}</p>
              <button
                className="inline-action"
                type="button"
                onClick={() => context.actions.unequipItem(context.character.id, slot.item!.id)}
              >
                Unequip
              </button>
            </>
          ) : (
            <>
              <p>Open slot</p>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    context.actions.equipItem(
                      context.character.id,
                      slot.slotId,
                      event.target.value
                    );
                  }
                }}
              >
                <option value="">Equip carried item</option>
                {carriedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

function renderInventoryDetail(model: CharacterSheetUiModel, context: DetailRenderContext) {
  if (model.inventoryItems.length === 0) {
    return <EmptyList label="No carried items." />;
  }

  return (
    <div className="inventory-list">
      {model.inventoryItems.map((item) => (
        <section className="detail-card inventory-item" key={item.id}>
          <ItemLine item={item} />
          <p>{item.summary}</p>
          <div className="chip-row">
            <button
              className={item.isOwned ? "state-chip active" : "state-chip"}
              type="button"
              onClick={() => context.actions.setItemOwned(context.character.id, item.id, !item.isOwned)}
            >
              {item.isOwned ? "Owned" : "Not owned"}
            </button>
            <button
              className={item.isCarried ? "state-chip active" : "state-chip"}
              type="button"
              onClick={() =>
                context.actions.setItemCarried(context.character.id, item.id, !item.isCarried)
              }
            >
              {item.isCarried ? "Carried" : "Not carried"}
            </button>
            <button
              className={item.isActive ? "state-chip active" : "state-chip"}
              type="button"
              onClick={() => context.actions.setItemActive(context.character.id, item.id, !item.isActive)}
            >
              {item.isActive ? "Active" : "Inactive"}
            </button>
            {item.equippedSlots.length > 0 ? (
              <span className="state-chip active">Equipped: {item.equippedSlots.join(", ")}</span>
            ) : null}
          </div>
          <div className="action-row">
            {model.loadoutSlots.map((slot) => (
              <button
                key={slot.slotId}
                type="button"
                onClick={() => context.actions.equipItem(context.character.id, slot.slotId, item.id)}
              >
                Equip {slot.label}
              </button>
            ))}
            <button type="button" onClick={() => context.actions.unequipItem(context.character.id, item.id)}>
              Unequip
            </button>
            {item.canAppraise ? (
              <button
                type="button"
                onClick={() => {
                  const error = context.actions.appraiseItem(context.character.id, item.id, 5);
                  context.setCastMessage(error ?? "Artifact Appraisal completed.");
                }}
              >
                Artifact Appraisal
              </button>
            ) : null}
          </div>
          {!item.isKnown ? <small className="concealed-note">Bonus details hidden.</small> : null}
        </section>
      ))}
    </div>
  );
}

function renderKnowledgeDetail(_model: CharacterSheetUiModel, context: DetailRenderContext) {
  const groups = getKnowledgeGroupsForOwner(
    context.snapshot.knowledgeState,
    context.character.id
  )
    .map((group) => ({
      ...group,
      revisions: context.showArchivedKnowledge
        ? group.revisions
        : group.revisions.filter((entry) => !entry.ownership.isArchived),
    }))
    .filter((group) => group.revisions.length > 0);
  const selectedRevision =
    context.snapshot.knowledgeRevisions.find(
      (revision) => revision.id === context.selectedKnowledgeRevisionId
    ) ??
    groups[0]?.revisions[0]?.revision ??
    null;
  const selectedEntity = selectedRevision
    ? context.snapshot.knowledgeEntities.find((entity) => entity.id === selectedRevision.entityId) ??
      null
    : null;
  const selectedOwnership = selectedRevision
    ? context.snapshot.knowledgeOwnerships.find(
        (ownership) =>
          ownership.ownerCharacterId === context.character.id &&
          ownership.revisionId === selectedRevision.id
      ) ?? null
    : null;
  const compareRevision =
    context.snapshot.knowledgeRevisions.find(
      (revision) => revision.id === context.compareKnowledgeRevisionId
    ) ?? null;

  if (groups.length === 0) {
    return (
      <section className="detail-card action-panel">
        <EmptyList label="No knowledge cards owned." />
        <KnowledgeCreateControls context={context} />
      </section>
    );
  }

  return (
    <div className="knowledge-workspace">
      <aside className="detail-card knowledge-column">
        <div className="workspace-heading">
          <h3>Entities</h3>
          <button
            type="button"
            onClick={() => context.setShowArchivedKnowledge(!context.showArchivedKnowledge)}
          >
            {context.showArchivedKnowledge ? "Hide Archived" : "Show Archived"}
          </button>
        </div>
        {groups.map((group) => (
          <button
            className={
              selectedEntity?.id === group.entity.id ? "knowledge-row active" : "knowledge-row"
            }
            key={group.entity.id}
            type="button"
            onClick={() => context.setSelectedKnowledgeRevisionId(group.revisions[0]?.revision.id ?? "")}
          >
            <strong>{group.entity.displayName}</strong>
            <span>
              {getKnowledgeEntityTypeLabel(group.entity.type)} / {group.revisions.length}
            </span>
          </button>
        ))}
        <KnowledgeCreateControls context={context} />
      </aside>
      <aside className="detail-card knowledge-column">
        <h3>Revisions</h3>
        {selectedEntity
          ? groups
              .find((group) => group.entity.id === selectedEntity.id)
              ?.revisions.map((entry) => (
                <button
                  className={
                    selectedRevision?.id === entry.revision.id
                      ? "knowledge-row active"
                      : "knowledge-row"
                  }
                  key={entry.revision.id}
                  type="button"
                  onClick={() => context.setSelectedKnowledgeRevisionId(entry.revision.id)}
                >
                  <strong>{entry.displayLabel}</strong>
                  <span>V{entry.revision.revisionNumber}</span>
                </button>
              ))
          : null}
      </aside>
      <section className="detail-card knowledge-detail">
        {selectedRevision && selectedEntity && selectedOwnership ? (
          <>
            <div className="knowledge-card-heading">
              <h3>{selectedRevision.title}</h3>
              <span>{getKnowledgeEntityTypeLabel(selectedEntity.type)}</span>
            </div>
            <p>{selectedRevision.summary || "No summary."}</p>
            <div className="knowledge-actions">
              <button type="button" onClick={() => context.actions.duplicateKnowledge(context.character.id, selectedRevision.id)}>
                Duplicate
              </button>
              <button
                type="button"
                onClick={() =>
                  context.actions.createEditedKnowledge(
                    context.character.id,
                    selectedRevision.id,
                    context.knowledgeDraftTitle,
                    context.knowledgeDraftSummary
                  )
                }
              >
                Edited Copy
              </button>
              <button type="button" onClick={() => context.actions.toggleKnowledgePinned(selectedOwnership.id)}>
                {selectedOwnership.isPinned ? "Unpin" : "Pin"}
              </button>
              <button type="button" onClick={() => context.actions.toggleKnowledgeArchived(selectedOwnership.id)}>
                {selectedOwnership.isArchived ? "Unarchive" : "Archive"}
              </button>
            </div>
            <div className="inline-form">
              <input
                placeholder="Local label"
                value={context.knowledgeDraftTitle}
                onChange={(event) => context.setKnowledgeDraftTitle(event.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  context.actions.renameKnowledge(selectedOwnership.id, context.knowledgeDraftTitle)
                }
              >
                Save Label
              </button>
            </div>
            <div className="inline-form">
              <select
                value={context.shareRecipientId}
                onChange={(event) => context.setShareRecipientId(event.target.value)}
              >
                <option value="">Share with...</option>
                {context.snapshot.characters
                  .filter((character) => character.id !== context.character.id)
                  .map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.sheet.name.trim() || character.id}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!context.shareRecipientId}
                onClick={() =>
                  context.actions.shareKnowledge(
                    context.character.id,
                    selectedRevision.id,
                    context.shareRecipientId
                  )
                }
              >
                Send Card
              </button>
            </div>
            <div className="inline-form">
              <select
                value={context.compareKnowledgeRevisionId}
                onChange={(event) => context.setCompareKnowledgeRevisionId(event.target.value)}
              >
                <option value="">Compare revision...</option>
                {context.snapshot.knowledgeRevisions
                  .filter((revision) => revision.entityId === selectedEntity.id)
                  .map((revision) => (
                    <option key={revision.id} value={revision.id}>
                      V{revision.revisionNumber}: {revision.title}
                    </option>
                  ))}
              </select>
              <button type="button" onClick={() => context.setCompareKnowledgeRevisionId("")}>
                Clear
              </button>
            </div>
            <KnowledgeRevisionView revision={selectedRevision} />
            {compareRevision ? (
              <div className="comparison-panel">
                <h3>Comparison</h3>
                <KnowledgeRevisionView revision={compareRevision} />
              </div>
            ) : null}
          </>
        ) : (
          <EmptyList label="Select a knowledge card to inspect it." />
        )}
      </section>
    </div>
  );
}

function KnowledgeCreateControls({ context }: { context: DetailRenderContext }) {
  return (
    <div className="knowledge-create">
      <TextEditor
        label="Card Title"
        value={context.knowledgeDraftTitle}
        onChange={context.setKnowledgeDraftTitle}
      />
      <TextEditor
        label="Summary"
        value={context.knowledgeDraftSummary}
        onChange={context.setKnowledgeDraftSummary}
        multiline
      />
      <div className="action-row">
        <button type="button" onClick={() => context.actions.snapshotKnowledge(context.character.id)}>
          Snapshot Card
        </button>
        <button
          type="button"
          onClick={() =>
            context.actions.createManualKnowledge({
              ownerCharacterId: context.character.id,
              title: context.knowledgeDraftTitle,
              summary: context.knowledgeDraftSummary,
            })
          }
        >
          Manual Card
        </button>
      </div>
    </div>
  );
}

function KnowledgeRevisionView({
  revision,
}: {
  revision: AppDataSnapshot["knowledgeRevisions"][number];
}) {
  return (
    <div className="knowledge-sections">
      {revision.content.map((section) => (
        <section key={section.id}>
          <h4>{section.title}</h4>
          {section.entries.map((entry) => (
            <p key={entry.id}>
              {entry.label ? <strong>{entry.label}: </strong> : null}
              {entry.value}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

function renderHistoryDetail(model: CharacterSheetUiModel) {
  if (model.historyRows.length === 0) {
    return <EmptyList label="No history yet." />;
  }

  return (
    <div className="history-list">
      {model.historyRows.map((entry) => (
        <section className="history-entry" key={entry.id}>
          <span>{entry.actualDateTime || entry.gameDateTime || "Undated"}</span>
          <strong>{entry.title}</strong>
          <p>{entry.detail}</p>
        </section>
      ))}
    </div>
  );
}

function renderNotesDetail(model: CharacterSheetUiModel, context: DetailRenderContext) {
  return (
    <div className="notes-workspace">
      <section className="detail-card action-panel">
        <h3>Session Notes</h3>
        <TextEditor
          label="Note"
          value={context.sessionNote}
          onChange={context.setSessionNote}
          multiline
        />
        <button
          type="button"
          disabled={!context.sessionNote.trim()}
          onClick={() => {
            context.actions.appendHistoryNote(context.character.id, context.sessionNote);
            context.setSessionNote("");
          }}
        >
          Add To Game History
        </button>
      </section>
      {model.notes.length === 0 ? <EmptyList label="No notes yet." /> : null}
      <div className="notes-grid">
        {model.notes.map((entry) => (
          <section className="detail-card" key={entry.id}>
            <h3>{entry.gameDateTime || "Session Note"}</h3>
            <p>{entry.detail}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function renderDetail(
  model: CharacterSheetUiModel,
  activeTabId: CharacterSheetDetailTabId,
  context: DetailRenderContext
) {
  switch (activeTabId) {
    case "resistances":
      return renderResistanceDetail(model);
    case "stats":
      return renderStatsDetail(model, context);
    case "skills":
      return renderSkillsDetail(model, context);
    case "powers":
      return renderPowersDetail(model, context);
    case "loadout":
      return renderLoadoutDetail(model, context);
    case "inventory":
      return renderInventoryDetail(model, context);
    case "knowledge":
      return renderKnowledgeDetail(model, context);
    case "history":
      return renderHistoryDetail(model);
    case "notes":
      return renderNotesDetail(model, context);
  }
}

function RollHelper({
  model,
  actions,
}: {
  model: CharacterSheetUiModel;
  actions: CharacterSheetActions;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [customModifiers, setCustomModifiers] = useState<number[]>([]);
  const [lastRoll, setLastRoll] = useState<ReturnType<CharacterSheetActions["rollDicePool"]> | null>(
    null
  );
  const selectedTargets = model.rollTargets.filter((target) =>
    selectedTargetIds.includes(target.id)
  );
  const poolSize =
    selectedTargets.reduce((total, target) => total + target.value, 0) +
    customModifiers.reduce((total, value) => total + value, 0);

  const toggleTarget = (targetId: string) => {
    setSelectedTargetIds((current) =>
      current.includes(targetId)
        ? current.filter((entry) => entry !== targetId)
        : current.length >= 9
          ? current
          : [...current, targetId]
    );
  };

  return (
    <aside className={isOpen ? "roll-helper open" : "roll-helper"} aria-label="D10 roll helper">
      <button className="roll-fab" type="button" onClick={() => setIsOpen(!isOpen)}>
        D10
      </button>
      {isOpen ? (
        <section className="roll-popover panel-frame">
          <div className="workspace-heading">
            <h3>Roll Helper</h3>
            <button type="button" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
          <p>
            Pool <strong>{Math.max(0, poolSize)}</strong>
          </p>
          <div className="roll-targets">
            {model.rollTargets.map((target) => (
              <button
                className={selectedTargetIds.includes(target.id) ? "active" : ""}
                key={target.id}
                type="button"
                onClick={() => toggleTarget(target.id)}
              >
                {target.label} {formatSigned(target.value)}
              </button>
            ))}
          </div>
          <div className="inline-form">
            <input
              placeholder="+2"
              value={customInput}
              onChange={(event) => setCustomInput(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                const value = Number(customInput);
                if (Number.isFinite(value) && value !== 0) {
                  setCustomModifiers((current) => [...current, Math.trunc(value)]);
                  setCustomInput("");
                }
              }}
            >
              Add
            </button>
          </div>
          {customModifiers.length > 0 ? (
            <div className="chip-row">
              {customModifiers.map((modifier, index) => (
                <button
                  className="state-chip active"
                  key={`${modifier}-${index}`}
                  type="button"
                  onClick={() =>
                    setCustomModifiers((current) =>
                      current.filter((_, modifierIndex) => modifierIndex !== index)
                    )
                  }
                >
                  {formatSigned(modifier)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="action-row">
            <button
              type="button"
              disabled={poolSize <= 0}
              onClick={() => setLastRoll(actions.rollDicePool(poolSize))}
            >
              Roll D10
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTargetIds([]);
                setCustomModifiers([]);
                setCustomInput("");
                setLastRoll(null);
              }}
            >
              Clear
            </button>
          </div>
          {lastRoll ? (
            <div className="last-roll">
              <strong>Successes: {lastRoll.successes}</strong>
              <span>{lastRoll.botch ? "Botch: Yes" : "Botch: No"}</span>
              <small>{lastRoll.faces.join(", ")}</small>
            </div>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}

export function CharacterSheet({ snapshot, character, actions }: CharacterSheetProps) {
  const [activeTabId, setActiveTabId] = useState<CharacterSheetDetailTabId>("stats");
  const [mode, setMode] = useState<CharacterSheetModeState>(DEFAULT_CHARACTER_SHEET_MODE_STATE);
  const [statFloors, setStatFloors] = useState<Partial<Record<StatId, number>>>({});
  const [selectedPowerId, setSelectedPowerId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<CastPowerVariantId>("default");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([character.id]);
  const [selectedStatId, setSelectedStatId] = useState<StatId | null>(null);
  const [selectedAddPowerId, setSelectedAddPowerId] = useState("");
  const [castMessage, setCastMessage] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [showArchivedKnowledge, setShowArchivedKnowledge] = useState(false);
  const [selectedKnowledgeRevisionId, setSelectedKnowledgeRevisionId] = useState("");
  const [compareKnowledgeRevisionId, setCompareKnowledgeRevisionId] = useState("");
  const [knowledgeDraftTitle, setKnowledgeDraftTitle] = useState("");
  const [knowledgeDraftSummary, setKnowledgeDraftSummary] = useState("");
  const [shareRecipientId, setShareRecipientId] = useState("");
  const actualDate = useMemo(() => formatDateDayMonthYear(new Date()), []);
  const model = useMemo(
    () => buildCharacterSheetUiModel(snapshot, character),
    [character, snapshot]
  );
  const modeIndicators = useMemo(
    () => buildCharacterSheetModeIndicators(snapshot, character, mode),
    [character, mode, snapshot]
  );
  const detailContext: DetailRenderContext = {
    character,
    snapshot,
    actions,
    mode,
    statFloors,
    selectedPowerId,
    setSelectedPowerId,
    selectedVariantId,
    setSelectedVariantId,
    selectedTargetIds,
    setSelectedTargetIds,
    selectedStatId,
    setSelectedStatId,
    castMessage,
    setCastMessage,
    selectedAddPowerId,
    setSelectedAddPowerId,
    sessionNote,
    setSessionNote,
    showArchivedKnowledge,
    setShowArchivedKnowledge,
    selectedKnowledgeRevisionId,
    setSelectedKnowledgeRevisionId,
    compareKnowledgeRevisionId,
    setCompareKnowledgeRevisionId,
    knowledgeDraftTitle,
    setKnowledgeDraftTitle,
    knowledgeDraftSummary,
    setKnowledgeDraftSummary,
    shareRecipientId,
    setShareRecipientId,
  };
  const sheetEditable = canUseSheetEdit(mode) && canUseAdminAction(mode);
  const runtimeEditable = canUseRuntimeEdit(mode) && canUseAdminAction(mode);
  const activeTab =
    CHARACTER_SHEET_DETAIL_TABS.find((tab) => tab.id === activeTabId) ??
    CHARACTER_SHEET_DETAIL_TABS[0];
  const primaryEffect = model.status.effects[0] ?? model.status.tags[0] ?? "Ready";
  const primaryUtility = model.status.utilityTraits[0] ?? "No active utility trait";
  const powerTracking =
    model.powers.length > 0 ? `${model.powers.length} known powers` : "No known powers";
  const relatedKnowledge = model.knowledgeRows[0];

  const toggleProgressionEdit = () => {
    setMode((current) => {
      const nextProgressionEdit = !current.progressionEdit;
      if (nextProgressionEdit) {
        setStatFloors(
          Object.fromEntries(
            Object.entries(character.sheet.statState).map(([statId, stat]) => [
              statId,
              stat.base,
            ])
          ) as Partial<Record<StatId, number>>
        );
      }
      return {
        ...current,
        progressionEdit: nextProgressionEdit,
      };
    });
  };

  return (
    <main className="character-shell" aria-label="Convergence character sheet">
      <div className="character-sheet">
        <header className="sheet-chrome panel-frame" aria-label="Character sheet navigation">
          <div className="sheet-brand">
            <SheetIcon icon="book" />
            <span>PORTALS</span>
            <strong>game_hub5</strong>
          </div>
          <nav className="sheet-actions" aria-label="Primary navigation">
            <button type="button">
              <SheetIcon icon="shield" />
              Main Menu
            </button>
            <button type="button">
              <SheetIcon icon="sword" />
              Combat Mode
            </button>
            <button type="button">
              <SheetIcon icon="spark" />
              Player Menu
            </button>
          </nav>
          <div className="sheet-title-mark">
            <SheetIcon icon="stats" />
            <strong>Convergence Character Sheet</strong>
          </div>
          <div className="sheet-mode-actions">
            <button
              className={mode.sheetEdit ? "sheet-mode-action active" : "sheet-mode-action"}
              type="button"
              onClick={() => setMode((current) => ({ ...current, sheetEdit: !current.sheetEdit }))}
            >
              {mode.sheetEdit ? "Lock Sheet" : "Edit Sheet"}
            </button>
            <button
              className={mode.progressionEdit ? "sheet-mode-action active" : "sheet-mode-action"}
              type="button"
              onClick={toggleProgressionEdit}
            >
              Progression
            </button>
            <button
              className={mode.dmRuntimeEdit ? "sheet-mode-action active" : "sheet-mode-action"}
              type="button"
              onClick={() =>
                setMode((current) => ({ ...current, dmRuntimeEdit: !current.dmRuntimeEdit }))
              }
            >
              Runtime
            </button>
            <button
              className={mode.adminOverride ? "sheet-mode-action caution" : "sheet-mode-action"}
              type="button"
              onClick={() =>
                setMode((current) => ({ ...current, adminOverride: !current.adminOverride }))
              }
            >
              Admin
            </button>
          </div>
        </header>

        <section className="sheet-top" aria-label="Core character state">
          <article className="identity-panel panel-frame">
            <div className="portrait-mark" aria-hidden="true">
              {getInitials(model.identity.name) || "C"}
            </div>
            <div className="identity-copy">
              {sheetEditable ? (
                <div className="identity-edit-grid">
                  <TextEditor
                    label="Name"
                    value={character.sheet.name}
                    onChange={(value) =>
                      actions.updateSheetField(character.id, "name", value, {
                        adminOverride: mode.adminOverride,
                        reason: mode.reason,
                      })
                    }
                  />
                  <TextEditor
                    label="Concept"
                    value={character.sheet.concept}
                    onChange={(value) =>
                      actions.updateSheetField(character.id, "concept", value, {
                        adminOverride: mode.adminOverride,
                        reason: mode.reason,
                      })
                    }
                  />
                  <TextEditor
                    label="Faction"
                    value={character.sheet.faction}
                    onChange={(value) =>
                      actions.updateSheetField(character.id, "faction", value, {
                        adminOverride: mode.adminOverride,
                        reason: mode.reason,
                      })
                    }
                  />
                </div>
              ) : (
                <>
                  <h1>{model.identity.name}</h1>
                  <p>
                    {model.identity.concept} <span>/</span> {model.identity.faction}
                  </p>
                </>
              )}
              <div className="identity-badges">
                <span>Rank {model.identity.rank}</span>
                <span>CR {model.identity.cr}</span>
                <span>Age {model.identity.age ?? "-"}</span>
                <span>
                  XP {model.identity.xpUsed} / {model.identity.xpEarned}
                </span>
              </div>
              {sheetEditable ? (
                <div className="bio-edit-grid">
                  <NumberEditor
                    label="Age"
                    value={character.sheet.age ?? 0}
                    onChange={(value) =>
                      actions.updateSheetField(character.id, "age", value > 0 ? value : null, {
                        adminOverride: mode.adminOverride,
                        reason: mode.reason,
                      })
                    }
                  />
                  <label className="field-control compact">
                    <span>Apparel</span>
                    <select
                      value={character.sheet.apparelMode}
                      onChange={(event) =>
                        actions.updateSheetField(
                          character.id,
                          "apparelMode",
                          event.target.value as "humanoid" | "none",
                          {
                            adminOverride: mode.adminOverride,
                            reason: mode.reason,
                          }
                        )
                      }
                    >
                      <option value="humanoid">Humanoid</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <TextEditor
                    label="Primary Bio"
                    value={character.sheet.biographyPrimary}
                    onChange={(value) =>
                      actions.updateSheetField(character.id, "biographyPrimary", value, {
                        adminOverride: mode.adminOverride,
                        reason: mode.reason,
                      })
                    }
                    multiline
                  />
                  <TextEditor
                    label="Secondary Bio"
                    value={character.sheet.biographySecondary}
                    onChange={(value) =>
                      actions.updateSheetField(character.id, "biographySecondary", value, {
                        adminOverride: mode.adminOverride,
                        reason: mode.reason,
                      })
                    }
                    multiline
                  />
                </div>
              ) : (
                <div className="bio-lines" aria-label="Character biography">
                  <p>{model.identity.biographyPrimary || "No primary biography yet."}</p>
                  <p>{model.identity.biographySecondary || "No secondary biography yet."}</p>
                </div>
              )}
            </div>
          </article>

          <article className="chronicle-panel panel-frame">
            <div className="date-stack">
              <div>
                <SheetIcon icon="clock" />
                <span>Actual Date</span>
                <strong>{actualDate}</strong>
              </div>
              <div>
                <SheetIcon icon="history" />
                <span>Game Date-Time</span>
                {sheetEditable ? (
                  <input
                    value={character.sheet.gameDateTime}
                    onChange={(event) =>
                      actions.updateSheetField(character.id, "gameDateTime", event.target.value, {
                        adminOverride: mode.adminOverride,
                        reason: mode.reason,
                      })
                    }
                  />
                ) : (
                  <strong>{character.sheet.gameDateTime}</strong>
                )}
              </div>
            </div>
            <div className="xp-block">
              <span>XP</span>
              <div>
                <small>Earned</small>
                {sheetEditable ? (
                  <input
                    type="number"
                    value={character.sheet.xpEarned}
                    onChange={(event) =>
                      actions.updateSheetField(
                        character.id,
                        "xpEarned",
                        Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                        {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        }
                      )
                    }
                  />
                ) : (
                  <strong>{model.identity.xpEarned}</strong>
                )}
              </div>
              <div>
                <small>Used</small>
                <strong>{model.identity.xpUsed}</strong>
              </div>
              <div>
                <small>Left-Over</small>
                <strong>{model.identity.xpLeftOver}</strong>
              </div>
            </div>
          </article>

          <article className="state-panel panel-frame">
            <StatusRow icon="spark" label="Active Effect" value={primaryEffect} />
            <StatusRow icon="target" label="Utility Trait" value={primaryUtility} />
            <StatusRow icon="flame" label="Power Tracking" value={powerTracking} />
            <div className="mode-strip" aria-label="View and edit mode">
              {modeIndicators.map((indicator) => (
                <span className={`mode-pill ${indicator.tone}`} key={indicator.id}>
                  {indicator.label}
                </span>
              ))}
            </div>
            {(mode.adminOverride || mode.dmRuntimeEdit) ? (
              <label className="reason-input">
                <span>{mode.adminOverride ? "Admin Reason" : "DM Reason"}</span>
                <input
                  value={mode.reason}
                  onChange={(event) =>
                    setMode((current) => ({ ...current, reason: event.target.value }))
                  }
                  placeholder="Reason..."
                />
              </label>
            ) : null}
          </article>
        </section>

        <section className="readiness-band" aria-label="Resources and combat readiness">
          <div className="resource-strip">
            <ResourceTile
              icon="heart"
              label="HP"
              value={`${model.resources.hp} / ${model.resources.maxHp}`}
              tone="hp"
            />
            <ResourceTile
              icon="mana"
              label="Mana"
              value={`${model.resources.mana} / ${model.resources.maxMana}`}
              tone="mana"
            />
            <ResourceTile
              dots={Math.max(model.resources.inspiration, 1)}
              icon="spark"
              label="Inspiration"
              value={`${model.resources.inspiration}`}
              tone="inspiration"
            />
            <ResourceTile
              dots={Math.max(model.resources.positiveKarma + model.resources.negativeKarma, 1)}
              icon="coin"
              label="Karma"
              value={`+${model.resources.positiveKarma} / -${model.resources.negativeKarma}`}
              tone="karma"
            />
            <ResourceTile
              icon="coin"
              label="Money"
              value={`${model.resources.money}`}
              tone="money"
            />
            {(runtimeEditable || sheetEditable) ? (
              <div className="resource-editors panel-frame">
                {runtimeEditable ? (
                  <>
                    <NumberEditor
                      label="HP"
                      value={character.sheet.currentHp}
                      onChange={(value) =>
                        actions.updateRuntimeField(character.id, "currentHp", value, {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        })
                      }
                    />
                    <NumberEditor
                      label="Mana"
                      value={character.sheet.currentMana}
                      onChange={(value) =>
                        actions.updateRuntimeField(character.id, "currentMana", value, {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        })
                      }
                    />
                    <NumberEditor
                      label="Inspiration"
                      value={character.sheet.inspiration}
                      onChange={(value) =>
                        actions.updateRuntimeField(character.id, "inspiration", value, {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        })
                      }
                    />
                    <NumberEditor
                      label="+Karma"
                      value={character.sheet.positiveKarma}
                      onChange={(value) =>
                        actions.updateRuntimeField(character.id, "positiveKarma", value, {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        })
                      }
                    />
                    <NumberEditor
                      label="-Karma"
                      value={character.sheet.negativeKarma}
                      onChange={(value) =>
                        actions.updateRuntimeField(character.id, "negativeKarma", value, {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        })
                      }
                    />
                  </>
                ) : null}
                {sheetEditable ? (
                  <>
                    <NumberEditor
                      label="Temp HP"
                      value={character.sheet.temporaryHp}
                      onChange={(value) =>
                        actions.updateSheetField(character.id, "temporaryHp", Math.max(0, value), {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        })
                      }
                    />
                    <NumberEditor
                      label="Temp Insp"
                      value={character.sheet.temporaryInspiration}
                      onChange={(value) =>
                        actions.updateSheetField(
                          character.id,
                          "temporaryInspiration",
                          Math.max(0, value),
                          {
                            adminOverride: mode.adminOverride,
                            reason: mode.reason,
                          }
                        )
                      }
                    />
                    <NumberEditor
                      label="Money"
                      value={character.sheet.money}
                      onChange={(value) =>
                        actions.updateSheetField(character.id, "money", Math.max(0, value), {
                          adminOverride: mode.adminOverride,
                          reason: mode.reason,
                        })
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="combat-strip panel-frame">
            <ReadinessMetric
              label="Init"
              value={`${model.combat.initiative}`}
              detail="DEX + WITS"
            />
            <ReadinessMetric label="Move" value={model.combat.movement} detail="Base + dash" />
            <ReadinessMetric label="AC" value={`${model.combat.armorClass}`} detail="DEX + gear" />
            <ReadinessMetric label="DR" value={`${model.combat.damageReduction}`} detail="Armor" />
            <ReadinessMetric label="Soak" value={`${model.combat.soak}`} detail="STAM" />
            <ReadinessMetric
              label="Melee Atk"
              value={`${model.combat.meleeAttack}`}
              detail="Derived"
            />
            <ReadinessMetric
              label="Ranged Atk"
              value={`${model.combat.rangedAttack}`}
              detail="Derived"
            />
            <ReadinessMetric
              label="Melee Dmg"
              value={`${model.combat.meleeDamage}`}
              detail="STR + Gear"
            />
            <ReadinessMetric label="Ranged Dmg" value={model.combat.rangedDamage} />
          </div>
        </section>

        <section className="summary-grid" aria-label="Character summaries">
          {model.summarySections.map((section) =>
            renderSummaryCard(model, activeTabId, setActiveTabId, section.id)
          )}
        </section>

        <section className="detail-workspace panel-frame" aria-label="Character details">
          <nav className="detail-tab-rail" aria-label="Character detail tabs">
            {model.detailTabs.map((tab) => (
              <button
                aria-pressed={tab.id === activeTabId}
                className={tab.id === activeTabId ? "active" : ""}
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.label}
                type="button"
              >
                <SheetIcon icon={tab.icon} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <article className="detail-panel">
            <header className="detail-heading">
              <div>
                <SheetIcon icon={activeTab.icon} />
                <h2>{activeTab.label}</h2>
              </div>
            </header>
            <div className="detail-scroll">{renderDetail(model, activeTabId, detailContext)}</div>
          </article>
        </section>

        <aside className="related-knowledge-bar panel-frame" aria-label="Related knowledge">
          <span>
            <SheetIcon icon="book" />
            Related Knowledge
          </span>
          {relatedKnowledge ? <strong>{relatedKnowledge.title}</strong> : <em>No related cards</em>}
        </aside>
      </div>
      <RollHelper actions={actions} model={model} />
    </main>
  );
}
