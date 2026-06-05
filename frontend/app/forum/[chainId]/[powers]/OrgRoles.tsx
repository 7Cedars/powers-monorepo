'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { readContracts } from 'wagmi/actions'
import { wagmiConfig } from '@/context/wagmiConfig'
import { powersAbi } from '@/context/abi'
import { Powers, Role, Status } from '@/context/types'
import { parseChainId } from '@/utils/parsers'
import { bigintToRole } from '@/utils/bigintTo'
import { LoadingBox } from '@/components/LoadingBox'
import { AddressLink } from '@/components/AddressLink'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

interface OrgRolesProps {
  powers: Powers
}

export function OrgRoles({ powers }: OrgRolesProps) {
  const { chainId } = useParams<{ chainId: string }>()

  const selectableRoles = (powers.roles ?? []).filter(r => r.roleId !== PUBLIC_ROLE)
  const defaultRole = selectableRoles.find(r => r.roleId === 1n) ?? selectableRoles[0]

  const [selectedRoleId, setSelectedRoleId] = useState<bigint | undefined>(defaultRole?.roleId)
  const [members, setMembers] = useState<`0x${string}`[]>([])
  const [status, setStatus] = useState<Status>('idle')

  const fetchMembers = useCallback(async (roleId: bigint) => {
    setStatus('pending')
    setMembers([])
    try {
      const [amountResult] = await readContracts(wagmiConfig, {
        contracts: [{
          abi: powersAbi,
          address: powers.contractAddress as `0x${string}`,
          functionName: 'getAmountRoleHolders',
          args: [roleId],
          chainId: parseChainId(chainId),
        }],
      })
      if (amountResult.status !== 'success') throw new Error('Failed to get role holder count')
      const amount = Number(amountResult.result)
      if (amount === 0) { setStatus('success'); return }

      const results = await readContracts(wagmiConfig, {
        contracts: Array.from({ length: amount }, (_, i) => ({
          abi: powersAbi,
          address: powers.contractAddress as `0x${string}`,
          functionName: 'getRoleHolderAtIndex' as const,
          args: [roleId, BigInt(i)],
          chainId: parseChainId(chainId),
        })),
      })
      setMembers(results.filter(r => r.status === 'success').map(r => r.result as `0x${string}`))
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }, [powers.contractAddress, chainId])

  useEffect(() => {
    if (selectedRoleId !== undefined) fetchMembers(selectedRoleId)
  }, [selectedRoleId, fetchMembers])

  if (selectableRoles.length === 0) {
    return <p className="text-xs text-muted-foreground font-mono py-4">No roles defined</p>
  }

  return (
    <div className="space-y-3">
      {/* Role selector */}
      <div className="flex flex-wrap gap-2">
        {selectableRoles.map(role => (
          <button
            key={role.roleId.toString()}
            onClick={() => setSelectedRoleId(role.roleId)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
              selectedRoleId === role.roleId
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            {bigintToRole(role.roleId, powers)} <span className="opacity-60">#{role.roleId.toString()}</span>
          </button>
        ))}
      </div>

      {/* Members table */}
      <div className="border border-border overflow-hidden">
        {status === 'pending' ? (
          <div className="px-4 py-8 flex justify-center">
            <LoadingBox />
          </div>
        ) : members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider w-12">#</th>
                  <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Address</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, i) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">
                      <AddressLink
                        address={member}
                        chainId={chainId}
                        showFull
                        className="text-foreground hover:text-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-muted-foreground text-xs">
            No members found for this role
          </div>
        )}
      </div>
    </div>
  )
}
