/**
 * RuleCatalogPanel — src/components/ui/RuleCatalogPanel.tsx
 *
 * Browsable, searchable catalog of all governance rule packs, grouped by domain.
 * Rendered as a tab within GovernancePanel ("Rule Packs" tab).
 *
 * Layout:
 *   Search bar + domain filter dropdown
 *   Accordion sections by domain
 *   Each pack: name, rule count, status badge, enable/disable button
 *
 * Data source: static RULE_PACK_REGISTRY from rulePackRegistryClient.ts
 * (renderer-side mirror — no cross-boundary imports).
 *
 * IPC: enable/disable via the `onEnablePack` / `onDisablePack` callbacks,
 * which are wired to window.flintAPI.governance.togglePack by the parent.
 *
 * Mithril Safety:
 *   - All classes from the Flint token palette.
 *   - No arbitrary hex or spacing.
 */

import { useState, useMemo } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { RULE_PACK_REGISTRY, ORDERED_DOMAINS, DOMAIN_LABELS, groupPacksByDomain, type RulePackClient, type ComplianceDomain } from '../../core/rulePackRegistryClient';

// ── Props ──────────────────────────────────────────────────────────────────

interface RuleCatalogPanelProps {
  /** Currently active preset IDs from the resolved config */
  activePresets: string[];
  /** Called when the user clicks "Enable" on a pack */
  onEnablePack: (packId: string) => void;
  /** Called when the user clicks "Disable" on an active pack */
  onDisablePack: (packId: string) => void;
  /** True while a pack toggle IPC call is in flight */
  isToggling: boolean;
}

// ── Status badge ──────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: RulePackClient['status'];
  isActive: boolean;
}
function PackStatusBadge({
  status,
  isActive
}: StatusBadgeProps) {
  if (isActive) {
    return <span className="rounded border border-emerald-500/30 bg-emerald-900/20 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-semibold uppercase tracking-wider text-emerald-400">
                Active
            </span>;
  }
  if (status === 'coming-soon') {
    return <span className="rounded border border-zinc-700/40 bg-zinc-800/60 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium uppercase tracking-wider text-zinc-600">
                Coming Soon
            </span>;
  }
  return <span className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-semibold uppercase tracking-wider text-zinc-500">
            Available
        </span>;
}

// ── Pack row ──────────────────────────────────────────────────────────────

interface PackRowProps {
  pack: RulePackClient;
  isActive: boolean;
  isToggling: boolean;
  onEnable: () => void;
  onDisable: () => void;
}
function PackRow({
  pack,
  isActive,
  isToggling,
  onEnable,
  onDisable
}: PackRowProps) {
  const isComingSoon = pack.status === 'coming-soon';
  return <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-800/30 ${isComingSoon ? 'opacity-50' : ''}`}>
            {/* Pack info */}
            <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium ${isActive ? 'text-zinc-100' : 'text-zinc-300'}`}>
                    {pack.name}
                </p>
                <p className="mt-0.5 truncate text-[var(--spacing.2, 8px)] text-zinc-500">
                    {pack.description}
                </p>
                {pack.jurisdictions.length > 0 && <div className="mt-1 flex flex-wrap gap-1">
                        {pack.jurisdictions.map(j => <span key={j} className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[var(--spacing.2, 8px)] text-zinc-600">
                                {j}
                            </span>)}
                    </div>}
            </div>

            {/* Rule count chip */}
            <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[var(--spacing.2, 8px)] text-zinc-500">
                {pack.ruleCount} rules
            </span>

            {/* Status badge */}
            <PackStatusBadge status={pack.status} isActive={isActive} />

            {/* Action button */}
            {!isComingSoon && <button type="button" disabled={isToggling} onClick={isActive ? onDisable : onEnable} aria-label={isActive ? `Disable ${pack.name}` : `Enable ${pack.name}`} className={`shrink-0 rounded border px-2.5 py-1 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-700/40 hover:bg-red-900/10 hover:text-red-400' : 'border-indigo-500/30 bg-indigo-900/20 text-indigo-400 hover:border-indigo-500/60 hover:bg-indigo-900/40 hover:text-indigo-300'}`}>
                    {isActive ? 'Disable' : 'Enable'}
                </button>}
        </div>;
}

// ── Domain section ─────────────────────────────────────────────────────────

interface DomainSectionProps {
  label: string;
  domain: ComplianceDomain;
  packs: RulePackClient[];
  activePresets: string[];
  isToggling: boolean;
  onEnablePack: (packId: string) => void;
  onDisablePack: (packId: string) => void;
}
function DomainSection({
  label,
  packs,
  activePresets,
  isToggling,
  onEnablePack,
  onDisablePack
}: DomainSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const totalRules = packs.reduce((sum, p) => sum + p.ruleCount, 0);
  const activePacks = packs.filter(p => p.status === 'active' || p.preset !== undefined && activePresets.includes(p.preset));
  return <div className="border-b border-zinc-800/60 last:border-0">
            {/* Section header — collapsible */}
            <button type="button" onClick={() => setIsExpanded(v => !v)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-800/20" aria-expanded={isExpanded}>
                <ChevronRight size={12} className={`shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <span className="flex-1 text-xs font-medium text-zinc-300">{label}</span>
                <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[var(--spacing.2, 8px)] text-zinc-500">
                    {totalRules} rules
                </span>
                {activePacks.length > 0 && <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-900/20 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] text-emerald-400">
                        {activePacks.length} active
                    </span>}
            </button>

            {/* Pack rows */}
            {isExpanded && <div className="divide-y divide-zinc-800/30">
                    {packs.map(pack => {
        const isActive = pack.status === 'active' || pack.preset !== undefined && activePresets.includes(pack.preset);
        return <PackRow key={pack.id} pack={pack} isActive={isActive} isToggling={isToggling} onEnable={() => onEnablePack(pack.id)} onDisable={() => onDisablePack(pack.id)} />;
      })}
                </div>}
        </div>;
}

// ── RuleCatalogPanel ───────────────────────────────────────────────────────

export function RuleCatalogPanel({
  activePresets,
  onEnablePack,
  onDisablePack,
  isToggling
}: RuleCatalogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<ComplianceDomain | 'all'>('all');

  // Filter packs by search query and domain
  const filteredPacks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return RULE_PACK_REGISTRY.filter(pack => {
      const matchesDomain = domainFilter === 'all' || pack.domain === domainFilter;
      const matchesSearch = q === '' || pack.name.toLowerCase().includes(q) || pack.description.toLowerCase().includes(q) || pack.jurisdictions.some(j => j.toLowerCase().includes(q));
      return matchesDomain && matchesSearch;
    });
  }, [searchQuery, domainFilter]);
  const groups = useMemo(() => groupPacksByDomain(filteredPacks), [filteredPacks]);
  const totalActive = useMemo(() => RULE_PACK_REGISTRY.filter(p => p.status === 'active' || p.preset !== undefined && activePresets.includes(p.preset)).length, [activePresets]);
  return <div className="flex flex-col">
            {/* ── Toolbar ── */}
            <div className="shrink-0 border-b border-zinc-800 px-3 py-2">
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                        <input type="text" placeholder="Search packs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full rounded border border-zinc-700/50 bg-zinc-800 py-1.5 pl-7 pr-2 text-xs text-zinc-300 placeholder-zinc-600 transition-colors focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30" aria-label="Search rule packs" />
                    </div>

                    {/* Domain filter */}
                    <select value={domainFilter} onChange={e => setDomainFilter(e.target.value as ComplianceDomain | 'all')} className="rounded border border-zinc-700/50 bg-zinc-800 py-1.5 px-2 text-xs text-zinc-300 transition-colors focus:border-indigo-500/50 focus:outline-none" aria-label="Filter by domain">
                        <option value="all">All domains</option>
                        {ORDERED_DOMAINS.map(d => <option key={d} value={d}>
                                {DOMAIN_LABELS[d]}
                            </option>)}
                    </select>
                </div>

                {/* Summary line */}
                <p className="mt-1.5 text-[var(--spacing.2, 8px)] text-zinc-600">
                    {RULE_PACK_REGISTRY.length} packs · {totalActive} active
                </p>
            </div>

            {/* ── Pack groups ── */}
            <div className="flex-1 overflow-y-auto">
                {groups.length === 0 ? <p className="py-8 text-center text-xs text-zinc-600">
                        No packs match your search
                    </p> : groups.map(group => <DomainSection key={group.domain} label={group.label} domain={group.domain} packs={group.packs} activePresets={activePresets} isToggling={isToggling} onEnablePack={onEnablePack} onDisablePack={onDisablePack} />)}
            </div>
        </div>;
}