"use client";

import React from "react";
import { AssetList } from "./AssetList";
import { AddAsset } from "./AddAsset";
import { TitleText } from "@/components/StandardFonts";
import { usePowersStore } from "@/context/store";
import { useChains } from "wagmi";
import { parseChainId } from "@/utils/parsers";
import { useParams } from "next/navigation";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

export default function Page() {
  const { chainId, powers: addressPowers } = useParams<{ chainId: string, powers: string }>()  
  const powers = usePowersStore(); 
  const chains = useChains()
  const supportedChain = chains.find(chain => chain.id == parseChainId(chainId))

  console.log("@treasury page rendered:", {chains, supportedChain, powers})
   
  return (
    <main className="w-full min-h-screen flex flex-col bg-background scanlines pt-12">
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <TitleText
            title="Treasury"
            subtitle="View and manage the assets held by your Powers."
            size={2}
          />
        </div>
        
        {powers.treasury && powers.treasury !== "0x0000000000000000000000000000000000000000" ? (
          <>
            <div className="mb-4 border border-border bg-muted/50 px-4 py-3">
              <a
                href={`${supportedChain?.blockExplorers?.default.url}/address/${powers.treasury as `0x${string}`}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-xs font-mono break-all">
                  Treasury: {powers.treasury as `0x${string}`}
                </span>
                <ArrowUpRightIcon className="w-4 h-4 flex-shrink-0" />
              </a>
            </div>
            
            <div className="mb-6">
              <AssetList />
            </div>
            
            <AddAsset /> 
          </>
        ) : (
          <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm border border-border">
            No Treasury Address Set
          </div>
        )}
      </div>
    </main>
  )
}
