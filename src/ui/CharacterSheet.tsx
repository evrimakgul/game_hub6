import { useMemo, useState } from "react";

import { formatDateDayMonthYear } from "../lib/dateTime.ts";
import type { AppDataSnapshot } from "../services/appDataController.ts";
import type { CharacterRecord } from "../types/character.ts";
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

function renderStatsDetail(model: CharacterSheetUiModel) {
  return (
    <>
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
                  <strong>{stat.id}</strong>
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
      <section className="detail-card resistance-detail-card">
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
    </>
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
          className={getSummaryButtonClass("resistances", "stats", activeTabId)}
          key="resistances"
          onClick={() => setActiveTabId("stats")}
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

function renderSkillsDetail(model: CharacterSheetUiModel) {
  return (
    <div className="detail-card detail-card-full">
      <div className="skill-table">
        <span>Skill</span>
        <span>Stat</span>
        <span>Base</span>
        <span>Total</span>
        {model.skills.map((skill) => (
          <div className="skill-row" key={skill.id}>
            <strong>{skill.label}</strong>
            <span>{skill.rollStat}</span>
            <span>{skill.base}</span>
            <strong>{formatSigned(skill.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderPowersDetail(model: CharacterSheetUiModel) {
  if (model.powers.length === 0) {
    return <EmptyList label="No known powers yet." />;
  }

  return (
    <div className="power-grid">
      {model.powers.map((power) => (
        <section className="detail-card power-card" key={power.id}>
          <h3>
            <SheetIcon icon="power" />
            {power.name}
          </h3>
          <div className="power-meta">
            <span>Level {power.level}</span>
            <span>{power.governingStat}</span>
          </div>
        </section>
      ))}
    </div>
  );
}

function renderLoadoutDetail(model: CharacterSheetUiModel) {
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
            </>
          ) : (
            <p>Open slot</p>
          )}
        </section>
      ))}
    </div>
  );
}

function renderInventoryDetail(model: CharacterSheetUiModel) {
  if (model.inventoryItems.length === 0) {
    return <EmptyList label="No carried items." />;
  }

  return (
    <div className="inventory-list">
      {model.inventoryItems.map((item) => (
        <section className="detail-card inventory-item" key={item.id}>
          <ItemLine item={item} />
          <p>{item.summary}</p>
        </section>
      ))}
    </div>
  );
}

function renderKnowledgeDetail(model: CharacterSheetUiModel) {
  if (model.knowledgeRows.length === 0) {
    return <EmptyList label="No knowledge cards owned." />;
  }

  return (
    <div className="knowledge-grid">
      {model.knowledgeRows.map((row) => (
        <section className="detail-card knowledge-card" key={row.id}>
          <div className="knowledge-card-heading">
            <h3>{row.title}</h3>
            <span>{row.type}</span>
          </div>
          <p>{row.summary || "No summary."}</p>
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

function renderNotesDetail(model: CharacterSheetUiModel) {
  if (model.notes.length === 0) {
    return <EmptyList label="No notes yet." />;
  }

  return (
    <div className="notes-grid">
      {model.notes.map((entry) => (
        <section className="detail-card" key={entry.id}>
          <h3>{entry.gameDateTime || "Session Note"}</h3>
          <p>{entry.detail}</p>
        </section>
      ))}
    </div>
  );
}

function renderDetail(model: CharacterSheetUiModel, activeTabId: CharacterSheetDetailTabId) {
  switch (activeTabId) {
    case "stats":
      return renderStatsDetail(model);
    case "skills":
      return renderSkillsDetail(model);
    case "powers":
      return renderPowersDetail(model);
    case "loadout":
      return renderLoadoutDetail(model);
    case "inventory":
      return renderInventoryDetail(model);
    case "knowledge":
      return renderKnowledgeDetail(model);
    case "history":
      return renderHistoryDetail(model);
    case "notes":
      return renderNotesDetail(model);
  }
}

export function CharacterSheet({ snapshot, character }: CharacterSheetProps) {
  const [activeTabId, setActiveTabId] = useState<CharacterSheetDetailTabId>("stats");
  const actualDate = useMemo(() => formatDateDayMonthYear(new Date()), []);
  const model = useMemo(
    () => buildCharacterSheetUiModel(snapshot, character),
    [character, snapshot]
  );
  const activeTab =
    CHARACTER_SHEET_DETAIL_TABS.find((tab) => tab.id === activeTabId) ??
    CHARACTER_SHEET_DETAIL_TABS[0];
  const primaryEffect = model.status.effects[0] ?? model.status.tags[0] ?? "Ready";
  const primaryUtility = model.status.utilityTraits[0] ?? "No active utility trait";
  const powerTracking =
    model.powers.length > 0 ? `${model.powers.length} known powers` : "No known powers";
  const relatedKnowledge = model.knowledgeRows[0];

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
          <button className="sheet-mode-action" type="button">
            Edit / DM Mode
          </button>
        </header>

        <section className="sheet-top" aria-label="Core character state">
          <article className="identity-panel panel-frame">
            <div className="portrait-mark" aria-hidden="true">
              {getInitials(model.identity.name) || "C"}
            </div>
            <div className="identity-copy">
              <h1>{model.identity.name}</h1>
              <p>
                {model.identity.concept} <span>/</span> {model.identity.faction}
              </p>
              <div className="identity-badges">
                <span>Rank {model.identity.rank}</span>
                <span>CR {model.identity.cr}</span>
                <span>
                  XP {model.identity.xpUsed} / {model.identity.xpEarned}
                </span>
              </div>
              <div className="bio-lines" aria-label="Character biography">
                <p>{model.identity.biographyPrimary || "No primary biography yet."}</p>
                <p>{model.identity.biographySecondary || "No secondary biography yet."}</p>
              </div>
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
                <strong>{character.sheet.gameDateTime}</strong>
              </div>
            </div>
            <div className="xp-block">
              <span>XP</span>
              <div>
                <small>Earned</small>
                <strong>{model.identity.xpEarned}</strong>
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
              {model.modeIndicators.map((indicator) => (
                <span className={`mode-pill ${indicator.tone}`} key={indicator.id}>
                  {indicator.label}
                </span>
              ))}
            </div>
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
            <div className="detail-scroll">{renderDetail(model, activeTabId)}</div>
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
    </main>
  );
}
