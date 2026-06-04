'use client'

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePowersStore, useUIStateStore } from "@/context/store";
import { shorterDescription } from "@/utils/parsers";
import { bigintToRole } from "@/utils/bigintTo";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function FlowDetailPage() {
  const { flowIndex, chainId } = useParams<{ flowIndex: string; chainId: string }>()
  const powers = usePowersStore()
  const router = useRouter()
  const { setHighlightMode } = useUIStateStore()

  const idx = Number(flowIndex)
  const flow = powers?.flows?.[idx]
  const mandates = powers?.mandates ?? []

  useEffect(() => {
    if (flow?.mandateIds && flow.mandateIds.length > 0) {
      setHighlightMode({
        type: 'flow',
        mandateIds: new Set(flow.mandateIds.map(String)),
      })
    }
  }, [flowIndex, flow?.mandateIds?.length])

  if (!flow) {
    return (
      <main className="w-full h-full flex flex-col bg-background pt-12 px-4">
        <p className="text-xs text-muted-foreground font-mono">Flow not found.</p>
      </main>
    )
  }

  const parts = (flow.nameDescription ?? '').split(':')
  const name = parts[0]?.trim() || `Flow ${idx}`
  const description = parts.slice(1).join(':').trim()

  const flowMandates = flow.mandateIds
    .map(id => mandates.find(m => m.index === id))
    .filter((m): m is NonNullable<typeof m> => m != null)

  return (
    <main className="w-full h-full flex flex-col bg-background pt-20 px-4 pb-16 gap-6">
      {/* Back button */}
      <button
        onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/flows`)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
      >
        <ArrowLeftIcon className="w-3 h-3" />
        <span>ALL FLOWS</span>
      </button>

      {/* Name + description */}
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-sm font-semibold text-foreground">{name}</h2>
        {description && <p className="text-xs text-muted-foreground font-mono">{description}</p>}
      </div>

      {/* Mandates in this flow */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Mandates ({flowMandates.length})
        </span>
        {flowMandates.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono">No mandates in this flow.</p>
        ) : (
          <div className="border border-border divide-y divide-border">
            {flowMandates.map(mandate => {
              const mandateName = shorterDescription(mandate.nameDescription, 'short') ?? `Mandate ${mandate.index}`
              const mandateParts = mandate.nameDescription?.split(':') ?? []
              const mandateDesc = mandateParts.slice(1).join(':').trim()
              const roleName = mandate.conditions ? bigintToRole(mandate.conditions.allowedRole, powers) : '—'

              return (
                <button
                  key={String(mandate.index)}
                  className="w-full flex flex-col gap-1 px-3 py-3 font-mono text-xs text-left hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/mandates/${mandate.index}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">#{mandate.index.toString()}</span>
                    <span className="text-foreground font-semibold">{mandateName}</span>
                    <span className="text-muted-foreground text-[10px] ml-auto">{roleName}</span>
                  </div>
                  {mandateDesc && (
                    <p className="text-muted-foreground text-[10px] line-clamp-2">{mandateDesc}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
