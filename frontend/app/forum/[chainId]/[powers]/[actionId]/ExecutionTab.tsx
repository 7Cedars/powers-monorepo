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

  // eslint-disable-next-line no-console
  console.log('DEBUG flowMandates', flowMandates.map(m => ({ index: m.index, needFulfilled: m.conditions?.needFulfilled, needNotFulfilled: m.conditions?.needNotFulfilled })), 'selected', selectedMandate.index)

  // Other mandates in the same flow that this mandate's fulfilment will block or enable.
  // Use String() comparison throughout: needFulfilled/needNotFulfilled come from uint16 ABI
  // and may decode as number or bigint depending on viem version; mandate.index is always bigint.
  const affectedMandates = useMemo(() => {
    const blocks: Mandate[] = []
    const enables: Mandate[] = []
    const selectedIdx = selectedMandate.index.toString()
    for (const m of flowMandates) {
      if (m.index.toString() === selectedIdx) continue
      if (m.conditions?.needFulfilled && String(m.conditions.needFulfilled) === selectedIdx) enables.push(m)
      if (m.conditions?.needNotFulfilled && String(m.conditions.needNotFulfilled) === selectedIdx) blocks.push(m)
    }
    return { blocks, enables }
  }, [flowMandates, selectedMandate])

  const hasTransactions = useMemo(() => {
    if (isSimulating || !simulation || !simulation[1]?.length) return false
    return simulation[1].some(target => target !== '0x0000000000000000000000000000000000000000')
  }, [simulation, isSimulating])

  // For the current mandate use the real action (preserving fulfilledAt for historical simulation).
  // For any other mandate in the flow, replay the same callData hypothetically — fulfilledAt cleared
  // so we always do a live "what if this mandate processed it" simulate, not a historical-block call.
  const targetAction = useMemo<Action | undefined>(() => {
    if (!currentAction?.callData || currentAction.callData === '0x0') return undefined
    if (selectedMandateIndex === currentMandate.index.toString()) return currentAction
    return { ...currentAction, fulfilledAt: undefined }
  }, [selectedMandateIndex, currentMandate, currentAction])

  useEffect(() => {
    setHasSimulated(false)
  }, [selectedMandateIndex])

  const isFulfilled = !!targetAction?.fulfilledAt && targetAction.fulfilledAt > 0n

  useEffect(() => {
    if (!targetAction?.callData || targetAction.callData === '0x0' || !ready || !wallets?.[0] || hasSimulated) return
    const run = async () => {
      setIsSimulating(true)
      try {
        await simulate(
          targetAction.caller ?? effectiveAddress ?? '0x0',
          targetAction.callData as `0x${string}`,
          BigInt(targetAction.nonce ?? 0),
          selectedMandate,
          isFulfilled ? targetAction.fulfilledAt! - 1n : undefined
        )
        setHasSimulated(true)
      } catch {
        setHasSimulated(true)
      } finally {
        setIsSimulating(false)
      }
    }
    run()
  }, [targetAction, selectedMandate, ready, wallets, hasSimulated, isFulfilled])

  return (
    <div className="space-y-4">
      {/* Mandate dropdown */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
          Mandate
        </label>
        {flowMandates.length > 1 ? (
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
        ) : (
          <div className="w-full flex items-center justify-between bg-background border border-border pl-3 pr-3 py-2 text-xs font-mono text-left">
            <span className="truncate">
              #{selectedMandate.index.toString()} {selectedMandate.nameDescription?.split(':')[0] ?? 'Mandate'} — {bigintToRole(selectedMandate.conditions?.allowedRole ?? 0n, powers)}
            </span>
          </div>
        )}
      </div>

      {/* Effects of fulfilling this action */}
      {(affectedMandates.blocks.length > 0 || affectedMandates.enables.length > 0 || hasTransactions) && (
        <div className="text-xs font-mono space-y-1">
          <p className="text-muted-foreground">Fulfilling this action</p>
          <ul className="list-disc list-inside pl-2 space-y-0.5">
            {affectedMandates.blocks.map(m => (
              <li key={`block-${m.index.toString()}`}>
                blocks #{m.index.toString()} {m.nameDescription?.split(':')[0] ?? 'Mandate'}
              </li>
            ))}
            {affectedMandates.enables.map(m => (
              <li key={`enable-${m.index.toString()}`}>
                enables #{m.index.toString()} {m.nameDescription?.split(':')[0] ?? 'Mandate'}
              </li>
            ))}
          </ul>
          {hasTransactions && <p className="text-muted-foreground">executes the following transactions:</p>}
        </div>
      )}

      {/* Simulation output */}
      <SimulationBox
        mandate={selectedMandate}
        simulation={!targetAction || isSimulating ? undefined : simulation}
        chainId={chainId}
        emptyMessage={
          !targetAction
            ? 'No call data available'
            : isSimulating
            ? 'Running simulation···'
            : simulation
            ? undefined
            : hasSimulated
            ? isFulfilled
              ? 'Already executed — simulation unavailable'
              : 'No simulation data available'
            : 'Loading simulation···'
        }
      />
    </div>
  )
}
