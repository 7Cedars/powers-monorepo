'use client'

import { useEffect, useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { TrophyIcon } from '@heroicons/react/24/outline'
import { useSavedProtocolsStore } from '@/context/store'
import { powersAbi } from '@/context/abi'
import { Powers, Role } from '@/context/types'
import { useBlocks } from '@/hooks/useBlocks'
import { toFullDateFormat } from '@/utils/toDates'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

interface RolesProps {
  userAddress?: `0x${string}`
}

type RoleEntry = {
  protocol: Powers
  role: Role
}

export function Roles({ userAddress }: RolesProps) {
  const { savedProtocols } = useSavedProtocolsStore()
  const { timestamps, fetchTimestamps } = useBlocks()

  // Flatten all (protocol, role) pairs across saved orgs, skipping the implicit PUBLIC_ROLE
  const roleEntries = useMemo<RoleEntry[]>(() => {
    if (!userAddress) return []
    const entries: RoleEntry[] = []
    for (const protocol of savedProtocols) {
      for (const role of protocol.roles ?? []) {
        if (role.roleId === PUBLIC_ROLE) continue
        entries.push({ protocol, role })
      }
    }
    return entries
  }, [userAddress, savedProtocols])

  // Single batched call — wagmi groups contracts by chainId into one multicall3 per chain
  const { data: results, isLoading } = useReadContracts({
    contracts: roleEntries.map(({ protocol, role }) => ({
      address: protocol.contractAddress,
      abi: powersAbi,
      functionName: 'hasRoleSince' as const,
      args: [userAddress!, role.roleId] as const,
      chainId: Number(protocol.chainId),
    })),
    query: {
      enabled: !!userAddress && roleEntries.length > 0,
      staleTime: 0,
    },
  })

  // Group held roles (since > 0) by protocol
  const heldRolesByProtocol = useMemo(() => {
    if (!results) return []

    const map = new Map<string, { protocol: Powers; roles: { role: Role; since: bigint }[] }>()

    results.forEach((result, i) => {
      if (result.status !== 'success') return
      const since = result.result as bigint
      if (since === 0n) return

      const { protocol, role } = roleEntries[i]
      const key = protocol.contractAddress
      if (!map.has(key)) map.set(key, { protocol, roles: [] })
      map.get(key)!.roles.push({ role, since })
    })

    return [...map.values()]
  }, [results, roleEntries])

  // Fetch block timestamps for all held role grant blocks, grouped by chain
  useEffect(() => {
    if (heldRolesByProtocol.length === 0) return

    const byChain = new Map<string, bigint[]>()
    for (const { protocol, roles } of heldRolesByProtocol) {
      const chainId = String(protocol.chainId)
      if (!byChain.has(chainId)) byChain.set(chainId, [])
      for (const { since } of roles) byChain.get(chainId)!.push(since)
    }

    for (const [chainId, blockNumbers] of byChain) {
      fetchTimestamps(blockNumbers, chainId)
    }
  }, [heldRolesByProtocol, fetchTimestamps])

  return (
    <div className="border border-border space-y-3">
      <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
        <TrophyIcon className="h-4 w-4" /> Roles
      </h4>
      <div className="p-4">
        {!userAddress ? (
          <p className="font-mono text-xs text-muted-foreground">No wallet connected</p>
        ) : isLoading ? (
          <p className="font-mono text-xs text-muted-foreground">···</p>
        ) : heldRolesByProtocol.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No roles found in saved organisations</p>
        ) : (
          <div className="space-y-5">
            {heldRolesByProtocol.map(({ protocol, roles }) => (
              <div key={protocol.contractAddress} className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                  {protocol.name ?? `${protocol.contractAddress.slice(0, 6)}…${protocol.contractAddress.slice(-4)}`}
                </p>
                {roles.map(({ role, since }) => {
                  const ts = timestamps.get(`${String(protocol.chainId)}:${since}`)
                  return (
                    <div key={role.roleId.toString()} className="font-mono text-xs flex justify-between">
                      <span className="text-foreground">{role.label}</span>
                      <span className="text-muted-foreground">
                        since {ts ? toFullDateFormat(Number(ts.timestamp)) : '···'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
