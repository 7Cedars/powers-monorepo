import { Powers, Action } from "@/context/types";
import { toEurTimeFormat, toFullDateFormat } from "@/utils/toDates";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useBlocks } from "@/hooks/useBlocks";
import { callDataToActionParams } from "@/utils/callDataToActionParams";
import { setAction } from "@/context/store";

// Helper function to truncate addresses, preferring ENS names
const parseAddress = (address: string | undefined): string => {
  if (!address) return 'Unknown'
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
 
type MandateActionsProps = {
  mandateId: bigint; 
  powers: Powers | undefined;
  onRefresh?: () => void;
};

export const MandateActions = ({mandateId, powers}: MandateActionsProps) => {
  const { chainId } = useParams<{ chainId: string }>()
  const { timestamps, fetchTimestamps } = useBlocks()
  const mandateActions = powers?.mandates?.find(mandate => mandate.index == mandateId)?.actions || []
  const sortedActions = mandateActions
    ?.filter((action): action is Action => action !== undefined)
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
  // const allTimestamps = Array.from(new Set(sortedActions?.flatMap(action => [action?.requestedAt, action?.proposedAt, action?.fulfilledAt, action?.cancelledAt].filter((timestamp): timestamp is bigint => timestamp !== undefined && timestamp !== null))))
  const router = useRouter()
  // console.log("@MandateActions, waypoint 0", {timestamps, sortedActions})
  
  useEffect(() => {
    if (sortedActions && sortedActions.length > 0) {
      const allTimestamps = Array.from(new Set(
        sortedActions.flatMap(action => 
          [action?.requestedAt, action?.proposedAt, action?.fulfilledAt, action?.cancelledAt]
            .filter((timestamp): timestamp is bigint => timestamp !== undefined && timestamp !== null)
        )
      ))
      
      if (allTimestamps.length > 0) {
        fetchTimestamps(allTimestamps, chainId)
      }
    }
  }, [sortedActions, chainId, fetchTimestamps])


  return (
    <div className="w-full flex flex-col max-h-96 border border-border min-h-0" help-nav-item="latest-executions">
      <div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base text-sm">LATEST ACTIONS</span>
      </div>
      
    {
        mandateActions && mandateActions?.length > 0 ?  
          <div className="flex-1 overflow-auto">
              <table className="w-full font-mono text-xs">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider min-w-32">Date</th>
                    <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Executioner</th>
                    <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Action ID</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedActions.map((action, index) => (
                      <tr
                        key={index}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <a
                            href="#"
                            onClick={e => { 
                              const paramValues = callDataToActionParams(action, powers)
                              const mandate = powers?.mandates?.find(l => l.index === action.mandateId)
                              const dataTypes = mandate?.params?.map(p => p.dataType)
                              setAction({...action, paramValues: paramValues, dataTypes: dataTypes, upToDate: false})
                              e.preventDefault()
                              router.push(`/editor/${chainId}/${powers?.contractAddress}/mandates/${Number(action.mandateId)}`)
                            }}
                            className="text-foreground hover:text-primary hover:underline cursor-pointer"
                          >
                            {(() => {
                              const timestampToUse = action.requestedAt ? action.requestedAt : action.proposedAt ? action.proposedAt : 0n
                              const timestampData = timestamps.get(`${chainId}:${timestampToUse}`)
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
                          <span className="text-muted-foreground">
                            {parseAddress(action.caller)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            {action.actionId.toString().slice(0, 8)}...{action.actionId.toString().slice(-8)}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
          </div>
        :
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No actions found
        </div>
      }
    </div>
  )
}
