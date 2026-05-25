import React from 'react'
import { cn } from '../../lib/utils'
import type { EquipmentPackageOption } from '../../../../main/db/contentTypes'
import type { WizardState } from './wizardTypes'

interface StepEquipmentProps {
  wizardState: WizardState
  equipmentPackages: EquipmentPackageOption[]
  onChange: (partial: Partial<WizardState>) => void
}

/**
 * Step 5 — Equipment package selection.
 * Per UI-SPEC §3.6 and D-12: 2-3 predefined packages per class.
 */
export function StepEquipment({ wizardState, equipmentPackages, onChange }: StepEquipmentProps) {
  const displayPkg =
    wizardState.selectedEquipmentPackage ??
    (equipmentPackages.length > 0 ? equipmentPackages[0] : null)

  // Use hovered package for preview, fallback to selected
  const [hoveredPkg, setHoveredPkg] = React.useState<EquipmentPackageOption | null>(null)
  const previewPkg = hoveredPkg ?? wizardState.selectedEquipmentPackage ?? displayPkg

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left column — package cards (200px) */}
      <div className="w-[200px] flex-shrink-0 border-r border-border overflow-y-auto p-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Choose Starting Equipment
        </p>
        {equipmentPackages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select a class first to see equipment options.
          </p>
        ) : (
          <div className="space-y-2">
            {equipmentPackages.map((pkg) => {
              const isSelected = wizardState.selectedEquipmentPackage?.id === pkg.id
              return (
                <button
                  key={pkg.id}
                  type="button"
                  className={cn(
                    'w-full text-left border rounded-lg p-3 cursor-pointer transition-colors',
                    isSelected
                      ? 'border-accent-gold bg-accent-gold/10'
                      : 'border-border hover:border-muted-foreground',
                  )}
                  onClick={() => onChange({ selectedEquipmentPackage: pkg })}
                  onMouseEnter={() => setHoveredPkg(pkg)}
                  onMouseLeave={() => setHoveredPkg(null)}
                >
                  <p className="text-sm font-semibold leading-tight">{pkg.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pkg.items
                      .slice(0, 3)
                      .map((i) => i.name)
                      .join(', ')}
                    {pkg.items.length > 3 ? '…' : ''}
                  </p>
                </button>
              )
            })}
          </div>
        )}
        {equipmentPackages.length > 0 && !wizardState.selectedEquipmentPackage && (
          <p className="text-sm text-destructive mt-3">
            Choose an equipment package to continue.
          </p>
        )}
      </div>

      {/* Right column — item list preview (460px) */}
      <div className="flex-1 overflow-y-auto p-4">
        {previewPkg ? (
          <div>
            <h3 className="text-base font-semibold mb-3">{previewPkg.label}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left pb-2 font-semibold">Name</th>
                  <th className="text-center pb-2 font-semibold w-12">Qty</th>
                  <th className="text-right pb-2 font-semibold w-20">Weight</th>
                </tr>
              </thead>
              <tbody>
                {previewPkg.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-1.5">
                      {item.name}
                      {item.isMagic && (
                        <span className="ml-1 text-xs text-accent-gold">(magic)</span>
                      )}
                    </td>
                    <td className="text-center py-1.5">{item.quantity}</td>
                    <td className="text-right py-1.5 text-muted-foreground">
                      {item.weight > 0 ? `${item.weight} lb` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(previewPkg.startingGold ?? 0) > 0 && (
              <p className="text-sm mt-3 font-semibold">
                Starting Gold: {previewPkg.startingGold} gp
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              Select a package to see the item list.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function isStep4Valid(state: WizardState): boolean {
  return state.selectedEquipmentPackage !== null
}
