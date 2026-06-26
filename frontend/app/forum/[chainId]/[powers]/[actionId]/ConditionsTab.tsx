'use client'

import React from 'react'
import { Mandate, Powers } from '@/context/types'
import { bigintToRole } from '@/utils/bigintTo'
import { blocksToApproxDuration } from '@/utils/toDates'
import { getConstants } from '@/context/constants'

interface ConditionsTabProps {
  mandate: Mandate
  allowedRole: bigint
  powers: Powers
  chainId: string
}

export const ConditionsTab: React.FC<ConditionsTabProps> = ({ mandate, allowedRole, powers, chainId }) => {
  const blocksPerHour = getConstants(Number(chainId)).BLOCKS_PER_HOUR

  const formatBlocks = (value: bigint | string | undefined): string => {
    if (!value || BigInt(value) === 0n) return '—'
    const v = BigInt(value)
    return `${v.toString()} blocks (${blocksToApproxDuration(v, blocksPerHour)})`
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Role</span>
        <span className="text-foreground">{bigintToRole(allowedRole, powers)}</span>
      </div>
      {mandate.conditions?.quorum != null && BigInt(mandate.conditions.quorum) !== 0n && (
        <>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Quorum</span>
            <span className="text-foreground">{mandate.conditions.quorum.toString()}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Succeed At</span>
            <span className="text-foreground">{mandate.conditions?.succeedAt?.toString() ?? '0'}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Voting Period</span>
            <span className="text-foreground">{formatBlocks(mandate.conditions?.votingPeriod)}</span>
          </div>
        </>
      )}
      {mandate.conditions?.timelock != null && BigInt(mandate.conditions.timelock) !== 0n && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Timelock</span>
          <span className="text-foreground">{formatBlocks(mandate.conditions.timelock)}</span>
        </div>
      )}
      {mandate.conditions?.throttleExecution != null && BigInt(mandate.conditions.throttleExecution) !== 0n && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Throttle</span>
          <span className="text-foreground">{formatBlocks(mandate.conditions.throttleExecution)}</span>
        </div>
      )}
      {mandate.conditions?.needFulfilled != null && BigInt(mandate.conditions.needFulfilled) !== 0n && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Need Fulfilled</span>
          <span className="text-foreground">#{mandate.conditions.needFulfilled.toString()}</span>
        </div>
      )}
      {mandate.conditions?.needNotFulfilled != null && BigInt(mandate.conditions.needNotFulfilled) !== 0n && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Need Not Fulfilled</span>
          <span className="text-foreground">#{mandate.conditions.needNotFulfilled.toString()}</span>
        </div>
      )}
    </div>
  )
}
