/**
 * LibraryScreen — Standalone SRD reference browser at /library (RULES-01, RULES-02).
 *
 * Three-panel layout: left sidebar (section pills + search), center list, right detail.
 * Sections: Spells | Magic Items | Rules | Monsters.
 * Search is client-side (local state filter — no IPC per keystroke).
 * Reachable via navigate('/library') from CampaignListScreen and CampaignViewScreen.
 * Back button uses navigate(-1) to return to the launching screen.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { trpc } from '../lib/trpc'
import { ScrollArea } from '../components/ui/scroll-area'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'
import type { MagicItemEntry, RuleEntry, MonsterEntry } from '../../../main/trpc/routers/library'
import type { SpellEntry } from '../../../main/trpc/routers/spells'

// ─── Section type ─────────────────────────────────────────────────────────────

type Section = 'spells' | 'magic-items' | 'rules' | 'monsters'

const SECTION_LABELS: Record<Section, string> = {
  spells: 'Spells',
  'magic-items': 'Magic Items',
  rules: 'Rules',
  monsters: 'Monsters',
}

// ─── Rarity badge color ────────────────────────────────────────────────────────

function rarityBadgeClass(rarity: string): string {
  const r = rarity.toLowerCase()
  if (r === 'common') return 'border-transparent bg-muted text-muted-foreground'
  if (r === 'uncommon') return 'border-transparent bg-green-900/60 text-green-300'
  if (r === 'rare') return 'border-transparent bg-blue-900/60 text-blue-300'
  if (r.startsWith('very rare')) return 'border-transparent bg-purple-900/60 text-purple-300'
  if (r === 'legendary') return 'border-transparent bg-amber-900/60 text-amber-300'
  return 'border-transparent bg-muted text-muted-foreground'
}

// ─── LibraryScreen ────────────────────────────────────────────────────────────

export function LibraryScreen() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<Section>('spells')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── Data queries ─────────────────────────────────────────────────────────────
  const spellsQuery = useQuery({
    queryKey: ['library', 'spells'],
    queryFn: () => trpc.spells.listAllSpells.query(),
  })

  const magicItemsQuery = useQuery({
    queryKey: ['library', 'magicItems'],
    queryFn: () => trpc.library.magicItems.list.query(),
  })

  const rulesQuery = useQuery({
    queryKey: ['library', 'rules'],
    queryFn: () => trpc.library.rules.list.query(),
  })

  const monstersQuery = useQuery({
    queryKey: ['library', 'monsters'],
    queryFn: () => trpc.library.monsters.list.query(),
  })

  const spells: SpellEntry[] = spellsQuery.data ?? []
  const magicItems: MagicItemEntry[] = magicItemsQuery.data ?? []
  const rules: RuleEntry[] = rulesQuery.data ?? []
  const monsters: MonsterEntry[] = monstersQuery.data ?? []

  // ── Filter lists ─────────────────────────────────────────────────────────────
  const lq = query.toLowerCase()

  const filteredSpells = query
    ? spells.filter((s) => s.name.toLowerCase().includes(lq))
    : spells

  const filteredMagicItems = query
    ? magicItems.filter((m) => m.name.toLowerCase().includes(lq))
    : magicItems

  const filteredRules = query
    ? rules.filter((r) => r.title.toLowerCase().includes(lq) || r.category.toLowerCase().includes(lq))
    : rules

  const filteredMonsters = query
    ? monsters.filter((m) => m.name.toLowerCase().includes(lq))
    : monsters

  // ── Find selected item ───────────────────────────────────────────────────────
  const selectedSpell = activeSection === 'spells' && selectedId
    ? spells.find((s) => s.name === selectedId) ?? null
    : null

  const selectedMagicItem = activeSection === 'magic-items' && selectedId
    ? magicItems.find((m) => m.id === selectedId) ?? null
    : null

  const selectedRule = activeSection === 'rules' && selectedId
    ? rules.find((r) => r.id === selectedId) ?? null
    : null

  const selectedMonster = activeSection === 'monsters' && selectedId
    ? monsters.find((m) => m.id === selectedId) ?? null
    : null

  // ── Section switch ───────────────────────────────────────────────────────────
  function handleSectionChange(section: Section) {
    setActiveSection(section)
    setSelectedId(null)
    setQuery('')
  }

  // ── Empty state helper ───────────────────────────────────────────────────────
  function hasNoResults(): boolean {
    if (!query) return false
    switch (activeSection) {
      case 'spells': return filteredSpells.length === 0
      case 'magic-items': return filteredMagicItems.length === 0
      case 'rules': return filteredRules.length === 0
      case 'monsters': return filteredMonsters.length === 0
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-row bg-background">

      {/* ── Left sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-[200px] flex-shrink-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-2 py-3 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-sm px-2 h-8"
          >
            ← Back
          </Button>
          <span className="text-sm font-semibold text-foreground truncate">SRD Library</span>
        </div>

        {/* Section pills */}
        <div
          role="tablist"
          aria-label="Library sections"
          className="flex flex-col gap-1 mt-3 px-2"
        >
          {(Object.keys(SECTION_LABELS) as Section[]).map((section) => (
            <button
              key={section}
              role="tab"
              aria-selected={activeSection === section}
              onClick={() => handleSectionChange(section)}
              className={cn(
                'rounded-lg px-3 py-2 text-sm cursor-pointer text-left transition-colors',
                activeSection === section
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-secondary',
              )}
            >
              {SECTION_LABELS[section]}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="px-2 mt-3">
          <Input
            className="h-9"
            placeholder="Search…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedId(null)
            }}
          />
        </div>
      </div>

      {/* ── Center list panel ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <ScrollArea className="h-full">
          {hasNoResults() ? (
            <div className="flex items-center justify-center py-12 px-4 text-sm text-muted-foreground">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            <div className="flex flex-col">
              {activeSection === 'spells' &&
                filteredSpells.map((spell) => (
                  <button
                    key={spell.name}
                    onClick={() => setSelectedId(spell.name)}
                    className={cn(
                      'flex items-start gap-2 px-4 py-3 border-b border-border cursor-pointer hover:bg-secondary/60 transition-colors text-left w-full',
                      selectedId === spell.name && 'bg-secondary',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{spell.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} · {spell.school}
                      </div>
                    </div>
                  </button>
                ))}

              {activeSection === 'magic-items' &&
                filteredMagicItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'flex items-start gap-2 px-4 py-3 border-b border-border cursor-pointer hover:bg-secondary/60 transition-colors text-left w-full',
                      selectedId === item.id && 'bg-secondary',
                    )}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{item.name}</div>
                      <Badge
                        className={cn('text-xs w-fit', rarityBadgeClass(item.rarity))}
                      >
                        {item.rarity}
                      </Badge>
                    </div>
                  </button>
                ))}

              {activeSection === 'rules' &&
                filteredRules.map((rule) => (
                  <button
                    key={rule.id}
                    onClick={() => setSelectedId(rule.id)}
                    className={cn(
                      'flex items-start gap-2 px-4 py-3 border-b border-border cursor-pointer hover:bg-secondary/60 transition-colors text-left w-full',
                      selectedId === rule.id && 'bg-secondary',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{rule.title}</div>
                      <div className="text-xs text-muted-foreground">{rule.category}</div>
                    </div>
                  </button>
                ))}

              {activeSection === 'monsters' &&
                filteredMonsters.map((monster) => (
                  <button
                    key={monster.id}
                    onClick={() => setSelectedId(monster.id)}
                    className={cn(
                      'flex items-start gap-2 px-4 py-3 border-b border-border cursor-pointer hover:bg-secondary/60 transition-colors text-left w-full',
                      selectedId === monster.id && 'bg-secondary',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{monster.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {monster.type} · CR {monster.cr}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right detail panel ───────────────────────────────────────────────── */}
      <div className="w-[320px] border-l border-border p-4 overflow-y-auto flex-shrink-0">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select an entry to view details.
          </div>
        ) : (
          <>
            {selectedSpell && <SpellDetail spell={selectedSpell} />}
            {selectedMagicItem && <MagicItemDetail item={selectedMagicItem} />}
            {selectedRule && <RuleDetail rule={selectedRule} />}
            {selectedMonster && <MonsterDetail monster={selectedMonster} />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Detail components ────────────────────────────────────────────────────────

function SpellDetail({ spell }: { spell: SpellEntry }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-foreground">{spell.name}</h2>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>
          <span className="font-semibold">Level:</span>{' '}
          {spell.level === 0 ? 'Cantrip' : `${spell.level}`}
        </div>
        <div><span className="font-semibold">School:</span> {spell.school}</div>
        <div><span className="font-semibold">Cast Time:</span> {spell.castTime}</div>
        <div><span className="font-semibold">Range:</span> {spell.range}</div>
        <div><span className="font-semibold">Duration:</span> {spell.duration}</div>
        <div><span className="font-semibold">Components:</span> {spell.components}</div>
        {spell.concentration && (
          <div><Badge variant="secondary" className="text-xs">Concentration</Badge></div>
        )}
        {spell.ritual && (
          <div><Badge variant="secondary" className="text-xs">Ritual</Badge></div>
        )}
        {spell.classes.length > 0 && (
          <div><span className="font-semibold">Classes:</span> {spell.classes.join(', ')}</div>
        )}
      </div>
      <div className="text-sm text-foreground leading-relaxed">{spell.description}</div>
    </div>
  )
}

function MagicItemDetail({ item }: { item: MagicItemEntry }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-foreground">{item.name}</h2>
      <div className="flex flex-wrap gap-1.5">
        <Badge className={cn('text-xs', rarityBadgeClass(item.rarity))}>
          {item.rarity}
        </Badge>
        {item.attunement && item.attunement !== 'No' && item.attunement !== 'no' && (
          <Badge variant="outline" className="text-xs">
            Requires Attunement
            {item.attunement !== 'Yes' && item.attunement !== 'yes'
              ? `: ${item.attunement}`
              : ''}
          </Badge>
        )}
      </div>
      <div className="text-sm text-foreground leading-relaxed">{item.description}</div>
    </div>
  )
}

function RuleDetail({ rule }: { rule: RuleEntry }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-foreground">{rule.title}</h2>
      <div className="text-xs text-muted-foreground">{rule.category}</div>
      <div className="text-sm text-foreground leading-[1.5]">
        <ReactMarkdown>{rule.content}</ReactMarkdown>
      </div>
    </div>
  )
}

function MonsterDetail({ monster }: { monster: MonsterEntry }) {
  const abilities = monster.abilities ?? {}
  const ABILITY_ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

  function abilityMod(score: number): string {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-foreground">{monster.name}</h2>
      <div className="text-xs text-muted-foreground">
        {monster.type} · CR {monster.cr}
      </div>

      {/* Stat block — compact 2-column mono table */}
      <table className="w-full text-xs font-mono border border-border rounded-md">
        <tbody>
          <tr className="border-b border-border">
            <td className="px-2 py-1 text-muted-foreground font-semibold">AC</td>
            <td className="px-2 py-1 text-foreground">{monster.ac}</td>
            <td className="px-2 py-1 text-muted-foreground font-semibold">HP</td>
            <td className="px-2 py-1 text-foreground">{monster.hp}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-1 text-muted-foreground font-semibold">Speed</td>
            <td className="px-2 py-1 text-foreground" colSpan={3}>{monster.speed}</td>
          </tr>
          {ABILITY_ORDER.map((ab, i) => {
            // Pair them: STR/DEX, CON/INT, WIS/CHA
            if (i % 2 !== 0) return null
            const ab2 = ABILITY_ORDER[i + 1]
            const score1 = abilities[ab] ?? abilities[ab.toLowerCase()] ?? 10
            const score2 = abilities[ab2] ?? abilities[ab2.toLowerCase()] ?? 10
            return (
              <tr key={ab} className={i < ABILITY_ORDER.length - 2 ? 'border-b border-border' : ''}>
                <td className="px-2 py-1 text-muted-foreground font-semibold">{ab}</td>
                <td className="px-2 py-1 text-foreground">
                  {score1} ({abilityMod(score1)})
                </td>
                <td className="px-2 py-1 text-muted-foreground font-semibold">{ab2}</td>
                <td className="px-2 py-1 text-foreground">
                  {score2} ({abilityMod(score2)})
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Actions */}
      {monster.actions && monster.actions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Actions</h3>
          {monster.actions.map((action) => (
            <div key={action.name} className="text-sm">
              <span className="font-semibold text-foreground">{action.name}.</span>{' '}
              <span className="text-muted-foreground">{action.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
