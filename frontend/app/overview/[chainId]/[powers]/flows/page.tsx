'use client'

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { usePowersStore } from "@/context/store";
import { TitleText } from "@/components/StandardFonts";

export default function FlowsPage() {
  const powers = usePowersStore()
  const router = useRouter()
  const { chainId } = useParams<{ chainId: string }>()

  const flows = powers?.flows ?? []

  return (
    <main className="w-full h-full flex flex-col bg-background pt-20 px-4">
      <TitleText
        title="Flows"
        subtitle="View the flows of the organization."
        size={2}
      />
      {flows.length > 0 ? (
        <div className="w-full border border-border overflow-hidden">
          <table className="w-full table-auto text-sm">
            <thead className="border-b border-border bg-background">
              <tr className="text-xs font-light text-left text-muted-foreground">
                <th className="ps-4 px-2 py-3 font-light w-10">#</th>
                <th className="px-2 py-3 font-light w-auto">Name</th>
                <th className="px-2 py-3 font-light w-auto">Description</th>
                <th className="px-2 py-3 font-light w-24 text-right pe-4">Mandates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flows.map((flow, idx) => {
                const parts = (flow.nameDescription ?? '').split(':')
                const name = parts[0]?.trim() || `Flow ${idx}`
                const description = parts.slice(1).join(':').trim()
                return (
                  <tr
                    key={idx}
                    className="text-xs text-foreground hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/flows/${idx}`)}
                  >
                    <td className="ps-4 px-2 py-3 text-muted-foreground font-mono">{idx}</td>
                    <td className="px-2 py-3 font-mono">{name}</td>
                    <td className="px-2 py-3 text-muted-foreground truncate max-w-48">{description || '—'}</td>
                    <td className="px-2 py-3 text-muted-foreground text-right pe-4 font-mono">
                      {flow.mandateIds.length}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-full flex text-sm text-muted-foreground justify-center items-center text-center p-3 border border-border">
          No flows defined
        </div>
      )}
    </main>
  )
}
