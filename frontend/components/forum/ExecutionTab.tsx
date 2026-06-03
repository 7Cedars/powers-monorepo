'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { useWallets } from '@privy-io/react-auth'
import { useEffectiveAddress } from '@/hooks/useEffectiveAddress'
import { useMandate } from '@/hooks/useMandate'
import { SimulationBox } from '@/components/SimulationBox'
import { usePowersStore } from '@/context/store'
import { Action, Mandate } from '@/context/types'
import { bigintToRole } from '@/utils/bigintTo'
import { useChainId } from 'wagmi'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface ExecutionTabProps {
  currentAction: Action
  currentMandate: Mandate
}

export function ExecutionTab({ currentAction, currentMandate }: ExecutionTabProps) {
  const { chainId: chainIdStr } = useParams<{ chainId: string }>()
  const powers = usePowersStore()
  const { simulation, simulate } = useMandate()
  const { wallets, ready } = useWallets()
  const effectiveAddress = useEffectiveAddress()
  const chainId = useChainId()

  // Collect all mandates in the same flow as the current mandate
  const flowMandates = useMemo<Mandate[]>(() => {
    const allMandates = powers.mandates ?? []
    const targetFlow = powers.flows?.find(flow =>
      flow.mandateIds.some(id => id.toString() === currentMandate.index.toString())
    )
    if (!targetFlow) return [currentMandate]
    return targetFlow.mandateIds
      .map(id => allMandates.find(m => m.index.toString() === id.toString()))
      .filter((m): m is Mandate => !!m)
  }, [powers.mandates, powers.flows, currentMandate])

  const [selectedMandateIndex, setSelectedMandateIndex] = useState<string>(currentMandate.index.toString())
  const [isSimulating, setIsSimulating] = useState(false)
  const [hasSimulated, setHasSimulated] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const rectRef = useRef<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleDropdown = () => {
    if (!isDropdownOpen && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      rectRef.current = { top: r.bottom, left: r.left, width: r.width }
    }
    setIsDropdownOpen(o => !o)
  }

  const selectedMandate = useMemo(
    () => flowMandates.find(m => m.index.toString() === selectedMandateIndex) ?? currentMandate,
    [flowMandates, selectedMandateIndex, currentMandate]
  )

  // Find the action to use for simulation for the selected mandate
  const targetAction = useMemo<Action | undefined>(() => {
    if (selectedMandateIndex === currentMandate.index.toString()) return currentAction
    // Find most recent action in the selected mandate
    const mandate = flowMandates.find(m => m.index.toString() === selectedMandateIndex)
    if (!mandate?.actions || mandate.actions.length === 0) return undefined
    return [...mandate.actions].sort((a, b) => {
      const aBlock = a.fulfilledAt ?? a.requestedAt ?? a.proposedAt ?? 0n
      const bBlock = b.fulfilledAt ?? b.requestedAt ?? b.proposedAt ?? 0n
      return aBlock > bBlock ? -1 : 1
    })[0]
  }, [selectedMandateIndex, currentMandate, currentAction, flowMandates])

  useEffect(() => {
    setHasSimulated(false)
  }, [selectedMandateIndex])

  useEffect(() => {
    if (!targetAction?.callData || targetAction.callData === '0x0' || !ready || !wallets?.[0] || hasSimulated) return
    const run = async () => {
      setIsSimulating(true)
      try {
        await simulate(
          targetAction.caller ?? effectiveAddress ?? '0x0',
          targetAction.callData as `0x${string}`,
          BigInt(targetAction.nonce ?? 0),
          selectedMandate
        )
        setHasSimulated(true)
      } catch {
        setHasSimulated(true)
      } finally {
        setIsSimulating(false)
      }
    }
    run()
  }, [targetAction, selectedMandate, ready, wallets, hasSimulated])

  return (
    <div className="space-y-4">
      {/* Mandate dropdown */}
      {flowMandates.length > 1 && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
            Mandate
          </label>
          <div ref={dropdownRef} className="relative">
            <button
              ref={buttonRef}
              type="button"
              onClick={handleToggleDropdown}
              className="w-full flex items-center justify-between bg-background border border-border pl-3 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-foreground/50 transition-colors cursor-pointer text-left"
            >
              <span className="truncate">
                {(() => {
                  const m = flowMandates.find(m => m.index.toString() === selectedMandateIndex)
                  return m ? `#${m.index.toString()} ${m.nameDescription?.split(':')[0] ?? 'Mandate'} — ${bigintToRole(m.conditions?.allowedRole ?? 0n, powers)}` : ''
                })()}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
            </button>
            {isDropdownOpen && rectRef.current && createPortal(
              <ul
                ref={listRef}
                style={{ position: 'fixed', top: rectRef.current.top, left: rectRef.current.left, width: rectRef.current.width, zIndex: 9999 }}
                className="border border-border bg-background shadow-md"
              >
                {flowMandates.map(m => (
                  <li
                    key={m.index.toString()}
                    onClick={() => { setSelectedMandateIndex(m.index.toString()); setIsDropdownOpen(false) }}
                    className={`px-3 py-2 text-xs font-mono cursor-pointer hover:bg-muted/50 ${m.index.toString() === selectedMandateIndex ? 'bg-muted/30' : ''}`}
                  >
                    #{m.index.toString()} {m.nameDescription?.split(':')[0] ?? 'Mandate'} — {bigintToRole(m.conditions?.allowedRole ?? 0n, powers)}
                  </li>
                ))}
              </ul>,
              document.body
            )}
          </div>
        </div>
      )}

      {/* Simulation output */}
      {!targetAction ? (
        <p className="text-xs text-muted-foreground font-mono">No actions found for this mandate</p>
      ) : isSimulating ? (
        <p className="text-xs text-muted-foreground font-mono">Running simulation···</p>
      ) : simulation ? (
        <SimulationBox mandate={selectedMandate} simulation={simulation} chainId={chainId} />
      ) : hasSimulated ? (
        <p className="text-xs text-muted-foreground font-mono">No simulation data available</p>
      ) : (
        <p className="text-xs text-muted-foreground font-mono">Loading simulation···</p>
      )}
    </div>
  )
}
