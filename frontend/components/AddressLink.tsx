'use client'

import { useChains } from 'wagmi'
import { usePathname } from 'next/navigation'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { useAddressDisplay } from '@/hooks/useAddressDisplay'
import { useAddressType } from '@/hooks/useAddressType'

interface AddressLinkProps {
  address: string | undefined
  chainId: number | string | undefined
  className?: string
  showFull?: boolean
}

export const AddressLink = ({ address, chainId, className = '', showFull = false }: AddressLinkProps) => {
  const numericChainId = chainId !== undefined ? parseInt(chainId.toString()) : undefined
  const { displayName } = useAddressDisplay(address)
  const { isPowers, isLoading } = useAddressType(address, numericChainId)
  const chains = useChains()
  const pathname = usePathname()

  const blockExplorerUrl = chains.find(c => c.id === numericChainId)?.blockExplorers?.default.url

  const text = showFull ? (address ?? 'Unknown') : displayName

  if (!address || isLoading) {
    return <span className={className}>{isLoading ? displayName : 'Unknown'}</span>
  }

  let href: string | undefined
  if (isPowers && numericChainId !== undefined) {
    href = pathname.startsWith('/overview')
      ? `/overview/${numericChainId}/${address}/organisation`
      : `/forum/${numericChainId}/${address}`
  } else if (blockExplorerUrl) {
    href = `${blockExplorerUrl}/address/${address}`
  }

  if (!href) {
    return <span className={className}>{text}</span>
  }

  return (
    <a
      href={href}
      target={isPowers ? '_self' : '_blank'}
      rel="noreferrer"
      className={`inline-flex items-center gap-1 hover:underline transition-colors ${className}`}
    >
      {text} 
    </a>
  )
}
