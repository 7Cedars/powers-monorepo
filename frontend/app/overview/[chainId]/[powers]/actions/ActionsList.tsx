"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Action, Powers } from "@/context/types";
import { parseProposalStatus, shorterDescription } from "@/utils/parsers";
import { toEurTimeFormat, toFullDateFormat } from "@/utils/toDates";
import { useBlocks } from "@/hooks/useBlocks";
import { useLatestActions } from "@/hooks/useLatestActions";

export function ActionsList({ powers }: { powers: Powers | undefined }) {
  const { chainId } = useParams<{ chainId: string }>()
  const router = useRouter()
  const { timestamps, fetchTimestamps } = useBlocks()
  const allLatest = useLatestActions(200)

  // Deduplicate by actionId — keep the entry with the highest block number
  const deduplicatedActions = React.useMemo(() => {
    const map = new Map<string, typeof allLatest[0]>()
    for (const action of allLatest) {
      const existing = map.get(action.actionId)
      if (!existing || action.highestBlockNumber > existing.highestBlockNumber) {
        map.set(action.actionId, action)
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      b.highestBlockNumber > a.highestBlockNumber ? 1 : b.highestBlockNumber < a.highestBlockNumber ? -1 : 0
    )
  }, [allLatest])

  useEffect(() => {
    if (deduplicatedActions.length > 0) {
      const blockNums = deduplicatedActions.flatMap(a =>
        [a.proposedAt, a.requestedAt, a.fulfilledAt, a.cancelledAt].filter((b): b is bigint => !!b && b > 0n)
      )
      if (blockNums.length > 0) fetchTimestamps(blockNums, chainId)
    }
  }, [deduplicatedActions, chainId, fetchTimestamps])

  const mandates = powers?.mandates ?? []

  return (
    <div className="w-full flex flex-col justify-start items-center bg-background border border-border overflow-hidden">
      {deduplicatedActions.length > 0 ? (
        <div className="w-full overflow-x-auto overflow-y-auto">
          <table className="w-full table-auto text-sm">
            <thead className="w-full border-b border-border sticky top-0 bg-background">
              <tr className="text-xs font-light text-left text-muted-foreground">
                <th className="ps-4 px-2 py-3 font-light w-40">Date</th>
                <th className="px-2 py-3 font-light w-32">Action ID</th>
                <th className="px-2 py-3 font-light w-auto">Mandate</th>
                <th className="px-2 py-3 font-light w-auto">Description</th>
                <th className="px-2 py-3 font-light w-24">Status</th>
              </tr>
            </thead>
            <tbody className="w-full text-sm text-left text-muted-foreground divide-y divide-border">
              {deduplicatedActions.map((action: Action) => {
                const blockForDate = action.proposedAt && action.proposedAt > 0n
                  ? action.proposedAt
                  : action.requestedAt && action.requestedAt > 0n
                  ? action.requestedAt
                  : undefined
                const timestampData = blockForDate ? timestamps.get(`${chainId}:${blockForDate}`) : undefined
                const ts = timestampData?.timestamp

                let dateLabel = 'Loading...'
                if (!blockForDate) dateLabel = '—'
                else if (ts && ts > 0n) {
                  try { dateLabel = `${toFullDateFormat(Number(ts))}: ${toEurTimeFormat(Number(ts))}` }
                  catch { dateLabel = 'Date error' }
                }

                const mandateName = shorterDescription(
                  mandates.find(m => m.index === action.mandateId)?.nameDescription,
                  "short"
                )

                return (
                  <tr
                    key={action.actionId}
                    className="text-xs text-left text-foreground hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/actions/${action.actionId}`)}
                  >
                    <td className="ps-4 px-2 py-3 w-40 whitespace-nowrap text-muted-foreground">{dateLabel}</td>
                    <td className="px-2 py-3 w-32 font-mono text-muted-foreground truncate">
                      {`${action.actionId.slice(0, 6)}...${action.actionId.slice(-4)}`}
                    </td>
                    <td className="px-2 py-3 w-auto text-muted-foreground truncate">{mandateName}</td>
                    <td className="px-2 py-3 w-auto text-muted-foreground truncate">
                      {action.description
                        ? action.description.length > 24 ? action.description.slice(0, 24) + '...' : action.description
                        : '—'}
                    </td>
                    <td className="px-2 py-3 w-24 text-muted-foreground">
                      {parseProposalStatus(String(action.state))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-full flex text-sm text-muted-foreground justify-center items-center text-center p-3">
          No actions found
        </div>
      )}
    </div>
  )
}
