"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Status, Powers } from "@/context/types";
import { parseChainId } from "@/utils/parsers";
import { powersAbi } from "@/context/abi";
import { readContracts } from "wagmi/actions";
import { wagmiConfig } from "@/context/wagmiConfig";
import { LoadingBox } from "@/components/LoadingBox";
import { useChains } from "wagmi";

export function MemberList({powers, roleId}: {powers: Powers | undefined, roleId: bigint}) {
  const { chainId } = useParams<{ chainId: string }>()
  const chains = useChains();
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [members, setMembers] = useState<`0x${string}`[]>([])

  // console.log("@MemberList: ", {powers, roleId, status, error, chainId})
  const blockExplorerUrl = chains.find(chain => chain.id === parseInt(chainId))?.blockExplorers?.default.url;

  const fetchRoleHolders = useCallback(
    async (roleId: bigint) => {
      setError(null)
      setStatus("pending")

      if (powers) {
        try {
          // First, get the amount of role holders
          const [amountResult] = await readContracts(wagmiConfig, {
            contracts: [{
              abi: powersAbi,
              address: powers.contractAddress as `0x${string}`,
              functionName: 'getAmountRoleHolders',
              args: [roleId],
              chainId: parseChainId(chainId)
            }]
          })
          
          if (amountResult.status !== 'success') {
            throw new Error('Failed to get amount of role holders')
          }
          
          const amount = Number(amountResult.result)
          // console.log("@fetchRoleHolders amount: ", {amount})
          
          if (amount === 0) {
            setMembers([])
            setStatus("success")
            return
          }
          
          // Build array of contract calls for all members
          const memberContracts = Array.from({ length: amount }, (_, i) => ({
            abi: powersAbi,
            address: powers.contractAddress as `0x${string}`,
            functionName: 'getRoleHolderAtIndex' as const,
            args: [roleId, BigInt(i)],
            chainId: parseChainId(chainId)
          }))
          
          // Fetch all members in parallel
          const results = await readContracts(wagmiConfig, {
            contracts: memberContracts
          })
          
          const fetchedMembers: `0x${string}`[] = results
            .filter(result => result.status === 'success')
            .map(result => result.result as `0x${string}`)
          
          // console.log("@fetchRoleHolders members: ", {fetchedMembers})
          setMembers(fetchedMembers)
          setStatus("success")
        } catch (error) {
          setStatus("error") 
          setError(error as Error)
          console.error("Error fetching role holders:", error)
        }
      }
    }, [powers, chainId])

  useEffect(() => {
    if (powers && roleId != undefined) {
      fetchRoleHolders(roleId)
    }
  }, [powers, roleId, fetchRoleHolders])

  return (
    <div className="flex flex-col max-h-96 border border-b-0 border-border min-h-0">

      {/* Table content */}
      {status == 'pending' ? 
        <div className="px-4 py-8 flex justify-center items-center">
          <LoadingBox /> 
        </div>
        : 
        members && members.length > 0 ?
          <div className="flex-1 overflow-auto">
              <table className="w-full font-mono text-xs">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider w-16">#</th>
                    <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {members?.map((member, i) =>
                    <tr key={i} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          {i + 1}
                        </span>
                      </td>
                      
                      <td className="px-4 py-3">
                        {blockExplorerUrl ? (
                          <a
                            href={`${blockExplorerUrl}/address/${member}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-primary hover:underline transition-colors"
                          >
                            {member}
                          </a>
                        ) : (
                          <span className="text-foreground">
                            {member}
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
          </div>
        :
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No members found
        </div>
      }
    </div>
  );
}

