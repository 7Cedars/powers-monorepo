'use client'

import { Action, Powers, Status } from "@/context/types";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { useParams, useRouter } from "next/navigation";
import { toEurTimeFormat, toFullDateFormat } from "@/utils/toDates";
import { shorterDescription } from "@/utils/parsers";
import { useBlocks } from "@/hooks/useBlocks";
import { useEffect } from "react";
import { setAction } from "@/context/store";
import { callDataToActionParams } from "@/utils/callDataToActionParams";


type ActionsProps = {
  powers: Powers | undefined;
  status: Status;
}

export function Actions({ powers, status}: ActionsProps) {
  const router = useRouter();
  const { chainId } = useParams<{ chainId: string }>()
  const { timestamps, fetchTimestamps } = useBlocks()

  const allActions = powers?.mandates && powers?.mandates?.length > 0 ? powers?.mandates?.flatMap(mandate => mandate.actions) : []
  const sortedActions = allActions
    .filter((action): action is Action => action !== undefined)
    .sort((a, b) => {
      // Get block numbers, prioritizing proposedAt over requestedAt
      const getBlockNumber = (action: Action): bigint => {
        const proposed = typeof action.proposedAt === 'bigint' 
          ? action.proposedAt 
          : (action.proposedAt ? BigInt(action.proposedAt as unknown as string) : 0n);
        const requested = typeof action.requestedAt === 'bigint'
          ? action.requestedAt
          : (action.requestedAt ? BigInt(action.requestedAt as unknown as string) : 0n);
        
        return proposed > 0n ? proposed : requested;
      };
      
      const blockA = getBlockNumber(a);
      const blockB = getBlockNumber(b);
      
      // Sort descending (newer/higher block numbers first)
      return blockB > blockA ? 1 : blockB < blockA ? -1 : 0;
    })
  const allTimestamps = Array.from(new Set(
    sortedActions.flatMap(action => [
      action?.requestedAt,
      action?.proposedAt, 
      action?.fulfilledAt,
      action?.cancelledAt
    ].filter((timestamp): timestamp is bigint => 
      timestamp !== undefined && 
      timestamp !== null
    ))
  ))

  useEffect(() => {
    if (sortedActions) {
      fetchTimestamps(allTimestamps, chainId)
    }
  }, [sortedActions, chainId, fetchTimestamps])

  return ( 
    <div className="flex flex-col max-h-96  border border-border min-h-0">
      <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => router.push(`/editor/${chainId}/${powers?.contractAddress}/mandates`)}
      >
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base text-sm">LATEST ACTIONS</span>
        <ArrowUpRightIcon className="w-4 h-4 text-muted-foreground" />
      </div>
      {sortedActions.length > 0 ? 
        <div className="flex-1 overflow-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider min-w-32">Date</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Mandate</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Action ID</th>
              </tr>
            </thead>
            <tbody>
              {sortedActions?.map((action: Action, i) => {
                const mandate = powers?.mandates?.find(mandate => Number(mandate.index) == Number(action.mandateId))
                if (!mandate) return null
                return (
                  <tr
                    key={i}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <a
                        href="#"
                        onClick={(e) => {
                          const paramValues = callDataToActionParams(action, powers)
                          setAction({...action, paramValues: paramValues, upToDate: false})
                          e.preventDefault()
                          router.push(`/editor/${chainId}/${powers?.contractAddress}/mandates/${Number(action.mandateId)}`)
                        }}
                        className="text-foreground hover:text-primary hover:underline cursor-pointer"
                      >
                        {(() => {
                          let targetBlock: bigint | undefined;
                          const proposedAt = action.proposedAt 
                          const requestedAt = action.requestedAt 

                          if (proposedAt && requestedAt && proposedAt > 0n && requestedAt > 0n) {
                            targetBlock = proposedAt < requestedAt ? proposedAt : requestedAt;
                          } else if (proposedAt && proposedAt > 0n) {
                            targetBlock = proposedAt;
                          } else if (requestedAt && requestedAt > 0n) {
                            targetBlock = requestedAt;
                          }

                          if (!targetBlock) {
                            return 'No timestamp';
                          }

                          const timestampData = timestamps.get(`${chainId}:${targetBlock}`)
                          const timestamp = timestampData?.timestamp
                          
                          if (!timestamp || timestamp <= 0n) {
                            return 'Loading...'
                          }
                          
                          const timestampNumber = Number(timestamp)
                          if (isNaN(timestampNumber) || timestampNumber <= 0) {
                            return 'Invalid date'
                          }
                          
                          try {
                            return `${toFullDateFormat(timestampNumber)}: ${toEurTimeFormat(timestampNumber)}`
                          } catch (error) {
                            console.error('Date formatting error:', error, { timestamp, timestampNumber })
                            return 'Date error'
                          }
                        })()}
                      </a>
                    </td>
                    
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground truncate block">
                        {shorterDescription(mandate.nameDescription, "short")}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">
                        {action.actionId.toString()}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      :
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No recent executions found
        </div>
      }
    </div>
  )
}
