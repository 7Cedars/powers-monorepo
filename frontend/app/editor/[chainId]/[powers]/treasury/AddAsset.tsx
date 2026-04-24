// £todo 
// needs to take in: address + type of token (simple drop down menu).

import { Button } from "@/components/Button"; 
import { Powers } from "@/context/types";
import { useAssets } from "@/hooks/useAssets";
import { useState } from "react";
import { TwoSeventyRingWithBg } from "react-svg-spinners";
import { usePowersStore } from "@/context/store";

export function AddAsset() {
  const powers = usePowersStore(); 
  const [newToken, setNewToken] = useState<`0x${string}`>()
  const {status, error, addErc20} = useAssets(powers as Powers)

  return (
    <div className="w-full grow flex flex-col justify-start items-center border border-border overflow-hidden bg-background">
      {/* Header */}
      <div className="w-full px-4 py-2 border-b border-border bg-muted/50">
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-sm">Add ERC20 Token</span>
      </div>

      {/* Content Section - Input Form */}
      <div className="w-full flex flex-col gap-4 px-4 py-4">
        {/* Input and Button Row */}
        <div className="w-full flex flex-row gap-3 items-center">
          {/* Address input */}
          <div className="flex-1 min-w-0 flex items-center bg-background border border-border px-3">  
            <input 
              type="text" 
              name="input" 
              id="input"
              className="w-full h-10 pe-2 text-xs font-mono text-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none" 
              placeholder="Enter token address here."
              onChange={(event) => {setNewToken(event.target.value as `0x${string}`)}}
            />
          </div>

          {/* Add Button */}
          <div className="w-32">
            <Button 
              size={0} 
              role={6}
              selected={true}
              filled={false} 
              showBorder={true}
              onClick={() => {addErc20(newToken ? newToken : `0x0`)}}
            > 
              <div className="text-xs px-1">
                {status && status == 'pending' ? (
                  <TwoSeventyRingWithBg className="w-4 h-4" />
                ) : (
                  "Add Token"
                )}
              </div>    
            </Button>
          </div>
        </div>

        {/* Status Messages */}
        {(status === 'error' || status === 'success') && (
          <div className="w-full flex justify-center">
            <div className="text-xs text-center font-mono">
              {status === 'error' ? (
                <div className="text-red-600">
                  {typeof error === "string" ? error.slice(0, 50) : "Token not recognised"}
                </div> 
              ) : status === 'success' ? (
                <div className="text-green-600"> 
                  Token added. Please refresh to see it in the list.
                </div> 
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  ) 
} 