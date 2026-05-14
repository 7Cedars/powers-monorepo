"use client";

import React, { useEffect } from "react";
import { ArrowPathIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { useChains } from "wagmi";
import { useAssets } from "@/hooks/useAssets";
import { Token, Powers } from "@/context/types";
import { LoadingBox } from "@/components/LoadingBox";
import { useParams } from "next/navigation";
import { parseChainId } from "@/utils/parsers";
import { usePowersStore } from "@/context/store";

export function AssetList() {
  const { chainId } = useParams<{ chainId: string }>()
  const chains = useChains()
  const supportedChain = chains.find(chain => chain.id == parseChainId(chainId))
  const powers = usePowersStore(); 
  const {status, tokens, native, fetchTokens} = useAssets(powers)

  // console.log("@AssetList: waypoint 0", {powers, status, tokens, native})

  useEffect(() => {
    if (supportedChain && powers) {
      fetchTokens(powers as Powers)   
    }
  }, [powers, fetchTokens, supportedChain])

  return (
    <div className="w-full grow flex flex-col justify-start items-center border border-border overflow-hidden">
      {/* Header */}
      <div className="w-full px-4 py-2 bg-muted/50 flex items-center justify-between">
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-sm">
          ASSETS
        </span>
        {supportedChain && powers && (
          <button
            onClick={() => {
              if (powers) {
                fetchTokens(powers)
              }
            }}
            className="flex items-center justify-center p-1.5 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Assets"
          >
            <ArrowPathIcon 
              className={`w-4 h-4 text-muted-foreground ${status == "pending" ? 'animate-spin' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Table content - matching LogsList.tsx structure */}
      {status && status == 'pending' ? 
        <div className="w-full flex flex-col justify-center items-center p-6">
          <LoadingBox />
        </div>
        :
        (native || (tokens && tokens.length > 0)) ?
          <div className="w-full h-fit max-h-full flex flex-col justify-start items-center overflow-hidden">
            <div className="w-full overflow-x-auto overflow-y-auto">
              <table className="w-full table-auto font-mono text-xs">
                <thead className="w-full border-b border-border sticky top-0 bg-background">
                  <tr className="w-full text-[10px] text-left text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-2 w-auto">Asset</th>
                    <th className="px-4 py-2">Symbol</th>
                    <th className="px-4 py-2">Address</th>
                    <th className="px-4 py-2">Quantity</th>
                    <th className="px-4 py-2">{`Value (${native?.symbol})`}</th>
                    <th className="px-4 py-2">Value</th>
                  </tr>
                </thead>
                <tbody className="w-full text-left divide-y divide-border">
                  {native && (
                    <tr className="border-b border-border hover:bg-muted/50 transition-colors">
                      {/* Asset */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          {supportedChain?.nativeCurrency?.name}
                        </span>
                      </td>
                      
                      {/* Symbol */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          {native?.symbol}
                        </span>
                      </td>
                      
                      {/* Address */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          -
                        </span>
                      </td>
                      
                      {/* Quantity */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          {String((Number(native?.value)/ 10 ** Number(native?.decimals)).toFixed(4))}
                        </span>
                      </td>
                      
                      {/* Value (Native) */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          {String((Number(native?.value)/ 10 ** Number(native?.decimals)).toFixed(4))}
                        </span>
                      </td>
                      
                      {/* Value */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          -
                        </span>
                      </td>
                    </tr>
                  )}
                  {
                    tokens?.map((token: Token, i) => 
                      <tr className="border-b border-border hover:bg-muted/50 transition-colors" key={i}>
                        {/* Asset */}
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            {token.name}
                          </span>
                        </td>
                        
                        {/* Symbol */}
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            {token.symbol}
                          </span>
                        </td>
                        
                        {/* Address */}
                        <td className="px-4 py-3">
                          <a
                            href={`${supportedChain?.blockExplorers?.default.url}/address/${token.address}#code`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground underline"
                          >
                            {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                          </a>
                        </td>
                        
                        {/* Quantity */}
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            {String((Number(token.balance)/ 10 ** Number(token.decimals)).toFixed(4))}
                          </span>
                        </td>
                        
                        {/* Value (Native) */}
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            {token.valueNative ? token.valueNative : '-'}
                          </span>
                        </td>
                        
                        {/* Value */}
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            -
                          </span>
                        </td>
                      </tr>
                    )
                  }
                </tbody>
              </table>
            </div>
          </div>
        :
        <div className="w-full px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No assets found
        </div>
      }
    </div>
  );
}
