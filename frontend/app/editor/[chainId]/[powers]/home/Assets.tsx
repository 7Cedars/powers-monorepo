`use client`

import { Powers, Status } from "@/context/types";
import { useAssets } from "@/hooks/useAssets";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export function Assets({powers}: {status: Status, powers: Powers | undefined}) {
  const router = useRouter();
  const { chainId } = useParams<{ chainId: string }>()
  const {status, tokens, native, fetchTokens} = useAssets(powers)

  useEffect(() => {
    if (chainId && powers) {
      fetchTokens(powers as Powers)   
    }
  }, [powers, fetchTokens, chainId])

  // Mock asset data - replace with actual asset data when available
  const assets = [
    { symbol: 'ETH', amount: '0', value: '0 USD' },
    // Add more assets as needed
  ];
  
  return (
    <div className="flex flex-col max-h-96  border border-border min-h-0">
      <div className="px-4 py-2 bg-muted/50 flex items-center justify-between cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => router.push(`/editor/${chainId}/${powers?.contractAddress}/treasury`)}
      >
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base text-sm">TREASURY</span>
        <ArrowUpRightIcon className="w-4 h-4 text-muted-foreground" />
      </div>
      
      {powers?.treasury && powers.treasury != '0x0000000000000000000000000000000000000000' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Asset</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Amount</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Value (ETH)</th>
              </tr>
            </thead>
            <tbody>
              {native && (
                <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-foreground">{native.symbol}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">
                      {String((Number(native?.value) / 10 ** Number(native?.decimals)).toFixed(4))}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">
                      {String((Number(native?.value) / 10 ** Number(native?.decimals)).toFixed(4))}
                    </span>
                  </td>
                </tr>
              )}
              {tokens && tokens.map((token, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-foreground">{token.symbol}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">
                      {String((Number(token.balance) / 10 ** Number(token.decimals)).toFixed(4))}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">
                      {token.valueNative ? token.valueNative : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No treasury set
        </div>
      )}
    </div>
  )
}
