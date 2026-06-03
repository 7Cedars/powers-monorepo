"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePowersStore, useUIStateStore } from "@/context/store";
import { shorterDescription } from "@/utils/parsers";
import { bigintToRole } from "@/utils/bigintTo";
import { MandateActions } from "./MandateActions";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-row items-start justify-between gap-4 py-2 border-b border-border last:border-0 font-mono text-xs">
    <span className="text-muted-foreground uppercase tracking-wider shrink-0 w-36">{label}</span>
    <span className="text-foreground text-right">{value}</span>
  </div>
)

export default function MandateDetailPage() {
  const { mandateId, chainId } = useParams<{ mandateId: string; chainId: string }>()
  const powers = usePowersStore()
  const router = useRouter()
  const { setHighlightMode } = useUIStateStore()

  const mandate = powers?.mandates?.find(m => String(m.index) === mandateId)

  useEffect(() => {
    if (mandateId) {
      setHighlightMode({ type: 'mandate', mandateId: String(mandateId) })
    }
  }, [mandateId])

  if (!mandate) {
    return (
      <main className="w-full h-full flex flex-col bg-background pt-12 px-4">
        <p className="text-xs text-muted-foreground font-mono">Mandate not found.</p>
      </main>
    )
  }

  const nameParts = mandate.nameDescription?.split(':') ?? []
  const name = nameParts[0]?.trim() ?? `Mandate ${mandate.index}`
  const description = nameParts.slice(1).join(':').trim()
  const cond = mandate.conditions
  const roleName = cond ? bigintToRole(cond.allowedRole, powers) : '—'

  const formatBlocks = (value: bigint | undefined): string => {
    if (!value || value === 0n) return '—'
    return `${value.toString()} blocks`
  }

  return (
    <main className="w-full h-full flex flex-col bg-background pt-20 px-4 pb-16 gap-6">
      {/* Back button */}
      <button
        onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/mandates`)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
      >
        <ArrowLeftIcon className="w-3 h-3" />
        <span>ALL MANDATES</span>
      </button>

      {/* Name + description */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">#{mandate.index.toString()}</span>
          <h2 className="font-mono text-sm font-semibold text-foreground">{name}</h2>
        </div>
        {description && <p className="text-xs text-muted-foreground font-mono">{description}</p>}
      </div>

      {/* Conditions */}
      {cond && (
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Conditions</span>
          <div className="border border-border px-3">
            <Row label="Role required" value={roleName} />
            {cond.quorum > 0n && (
              <Row label="Quorum" value={`${cond.quorum.toString()} votes`} />
            )}
            {cond.votingPeriod > 0n && (
              <Row label="Voting period" value={formatBlocks(cond.votingPeriod)} />
            )}
            {cond.timelock > 0n && (
              <Row label="Timelock" value={formatBlocks(cond.timelock)} />
            )}
            {cond.throttleExecution > 0n && (
              <Row label="Throttle" value={formatBlocks(cond.throttleExecution)} />
            )}
            {cond.needFulfilled > 0n && (
              <Row
                label="Needs fulfilled"
                value={
                  <button
                    className="hover:text-primary hover:underline transition-colors"
                    onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/mandates/${cond.needFulfilled}`)}
                  >
                    #{cond.needFulfilled.toString()} {shorterDescription(
                      powers?.mandates?.find(m => m.index === cond.needFulfilled)?.nameDescription, 'short'
                    )}
                  </button>
                }
              />
            )}
            {cond.needNotFulfilled > 0n && (
              <Row
                label="Needs not fulfilled"
                value={
                  <button
                    className="hover:text-primary hover:underline transition-colors"
                    onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/mandates/${cond.needNotFulfilled}`)}
                  >
                    #{cond.needNotFulfilled.toString()} {shorterDescription(
                      powers?.mandates?.find(m => m.index === cond.needNotFulfilled)?.nameDescription, 'short'
                    )}
                  </button>
                }
              />
            )}
          </div>
        </div>
      )}

      {/* Input parameter types */}
      {mandate.params && mandate.params.length > 0 && (
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Input types</span>
          <div className="border border-border divide-y divide-border">
            {mandate.params.map((param, i) => (
              <div key={i} className="flex flex-row items-center gap-3 px-3 py-2 font-mono text-xs">
                <span className="text-foreground">{param.varName}</span>
                <span className="text-muted-foreground text-[10px] ml-auto">{param.dataType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest actions */}
      {mandate && <MandateActions mandateId={mandate.index} powers={powers} />}
    </main>
  )
}
