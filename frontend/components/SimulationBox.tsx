"use client";

import React, { useEffect, useState, useRef } from "react";
import { useReadContract, usePublicClient } from 'wagmi'
import { mandateAbi } from "@/context/abi";
import { bytesToParams, parseParamValues } from "@/utils/parsers";
import { decodeAbiParameters, parseAbiParameters, formatEther, decodeFunctionData } from "viem";
import { MandateSimulation, Mandate } from "@/context/types";

type SimulationBoxProps = {
  mandate: Mandate;
  simulation: MandateSimulation | undefined;
  chainId: number;
};

export const SimulationBox = ({mandate, simulation, chainId}: SimulationBoxProps) => {
  // console.log("@SimulationBox: waypoint 1", {mandate, simulation})
  const [jsxSimulation, setJsxSimulation] = useState<React.JSX.Element[][]> ([]); 
  const [hasOverflow, setHasOverflow] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);  
  const publicClient = usePublicClient();
  const [decodedCalls, setDecodedCalls] = useState<any[]>([]);

  const { data } = useReadContract({
    abi: mandateAbi,
    address: mandate.mandateAddress,
    functionName: 'stateVars'
  })
  const params = bytesToParams(data as `0x${string}`)  
  const dataTypes = params.map(param => param.dataType) 

  console.log("@SimulationBox: waypoint 2", {jsxSimulation})

  // Hide the simulation box if all targets are zero addresses
  const allTargetsZero = React.useMemo(() => {
    if (decodedCalls.length > 0) {
      return decodedCalls.every(call => call.target === "0x0000000000000000000000000000000000000000");
    }
    if (simulation && simulation[1] && simulation[1].length > 0) {
      return simulation[1].every(target => target === "0x0000000000000000000000000000000000000000");
    }
    return false;
  }, [decodedCalls, simulation]);

  useEffect(() => {
    const fetchAbisAndDecode = async () => {
      if (!simulation) return;
      const targets = simulation[1];
      const values = simulation[2];
      const calldatas = simulation[3];
      
      const explorerUrl = publicClient?.chain?.blockExplorers?.default?.url;

      // Step 1: Get unique target addresses that need ABI fetching
      const uniqueTargets = [...new Set(targets.filter(
        (target, i) => 
          target !== "0x0000000000000000000000000000000000000000" && 
          calldatas[i] !== "0x"
      ))];

      // Step 2: Fetch ABIs for unique targets only (deduplicated)
      const abiCache = new Map<string, any[]>();
      await Promise.all(uniqueTargets.map(async (target) => {
        try {
          const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ? `&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}` : '';
          const fetchUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${target}${apiKey}`;
          console.log("Fetching ABI for target:", target, "from", fetchUrl);
          const response = await fetch(fetchUrl);
          const data = await response.json();
          if (data.status === "1") {
            const abi = JSON.parse(data.result);
            abiCache.set(target.toLowerCase(), abi);
          }
        } catch (e) {
          console.error("Failed to fetch ABI for target:", target, e);
        }
      }));

      // Step 3: Decode each call using cached ABIs
      const newDecodedCalls = targets.map((target, i) => {
        const value = values[i];
        const calldata = calldatas[i];
        let functionSignature = "Unknown";
        let decodedArgs: { type: string; value: string }[] = [];

        if (target === "0x0000000000000000000000000000000000000000") {
          functionSignature = "No Action";
        } else if (calldata === "0x") {
          functionSignature = "Transfer";
        } else {
          const abi = abiCache.get(target.toLowerCase());
          if (abi) {
            try {
              const decoded = decodeFunctionData({ abi, data: calldata });
              
              // Find the function in the ABI to get input types
              const abiFunction = abi.find(
                (item: any) => item.type === "function" && item.name === decoded.functionName
              );
              
              if (abiFunction && abiFunction.inputs) {
                // Build full function signature with types
                const inputTypes = abiFunction.inputs.map((input: any) => input.type);
                functionSignature = `${decoded.functionName}(${inputTypes.join(",")})`;
                
                // Map decoded args with their types
                if (decoded.args) {
                  decodedArgs = decoded.args.map((arg: any, idx: number) => {
                    const type = abiFunction.inputs[idx]?.type || "unknown";
                    let value: string;
                    if (typeof arg === 'bigint') {
                      value = arg.toString();
                    } else if (typeof arg === 'object') {
                      value = JSON.stringify(arg, (k, v) => typeof v === 'bigint' ? v.toString() : v);
                    } else {
                      value = String(arg);
                    }
                    return { type, value };
                  });
                }
              } else {
                functionSignature = decoded.functionName;
              }
            } catch (e) {
              console.error("Failed to decode calldata for target:", target, e);
            }
          }
        }

        return {
          target,
          explorerUrl: explorerUrl ? `${explorerUrl}/address/${target}` : undefined,
          valueEth: formatEther(value),
          calldata,
          functionSignature,
          decodedArgs
        };
      });
      setDecodedCalls(newDecodedCalls);
    };

    fetchAbisAndDecode();
  }, [simulation, publicClient, chainId]);
    
  // Check for overflow
  useEffect(() => {
    const checkOverflow = () => {
      if (scrollContainerRef.current) {
        const hasHorizontalOverflow = 
          scrollContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth;
        setHasOverflow(hasHorizontalOverflow);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [jsxSimulation]);

  useEffect(() => {

    let jsxElements0: React.JSX.Element[] = []; 
    let jsxElements1: React.JSX.Element[] = []; 

    if (decodedCalls.length > 0) {
      for (let i = 0; i < decodedCalls.length; i++) {
        const call = decodedCalls[i];
        
        if (call.target === "0x0000000000000000000000000000000000000000") {
          continue;
        }

        jsxElements0 = [
          ... jsxElements0, 
          <tr
            key={i}
            className="text-xs font-mono text-foreground"
          >
            <td className="px-3 py-2 text-left whitespace-nowrap">
              {call.explorerUrl ? (
                <a href={call.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {call.target.slice(0, 6)}...{call.target.slice(-4)}
                </a>
              ) : (
                <span>{call.target.slice(0, 6)}...{call.target.slice(-4)}</span>
              )}
            </td> 
            <td className="px-3 py-2 text-left whitespace-nowrap">{call.valueEth} ETH</td>
            {call.functionSignature !== "Unknown" ? (
              <>
                <td className="px-3 py-2 text-left whitespace-nowrap font-semibold">
                  {call.functionSignature}
                </td>
                <td className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">
                  {call.decodedArgs.map((arg: { type: string; value: string }, idx: number) => (
                    <span key={idx}>
                      {idx > 0 && ", "}
                      <span className="text-muted-foreground/70">{arg.type}:</span> {arg.value}
                    </span>
                  ))}
                </td>
              </>
            ) : (
              <td className="px-3 py-2 text-left whitespace-nowrap" colSpan={2}>
                {call.calldata}
              </td>
            )}
          </tr>
        ];
      }
    } else if (simulation && simulation.length > 0) {
      for (let i = 0; i < simulation[1].length; i++) {
        if (simulation[1][i] === "0x0000000000000000000000000000000000000000") {
          continue;
        }

        jsxElements0 = [
          ... jsxElements0, 
          <tr
            key={i}
            className="text-xs font-mono text-foreground whitespace-nowrap"
          >
            <td className="px-3 py-2 text-left">{simulation[1][i]}</td> 
            <td className="px-3 py-2 text-left">{formatEther(simulation[2][i])} ETH</td>
            <td className="px-3 py-2 text-left" colSpan={2}>{simulation[3][i]}</td>
          </tr>
        ];
      }
    }
  
    if (simulation && simulation[4] && simulation[4] != "0x") {
        const stateVars = dataTypes.length > 0 ? decodeAbiParameters(parseAbiParameters(dataTypes.toString()), simulation[4]) : [];
        const stateVarsParsed = parseParamValues(stateVars)
        for (let i = 0; i < stateVarsParsed.length; i++) {
        jsxElements1 = [ 
          ... jsxElements1, 
          <tr
            key={i}
            className="text-xs font-mono text-foreground"
          >
            <td className="px-3 py-2 text-left">{dataTypes[i]}</td> 
            <td className="px-3 py-2 text-left" colSpan={3}>{String(stateVarsParsed[i])}</td>
          </tr>
        ];
      }
    }
    const sim = [jsxElements1, jsxElements0]
    setJsxSimulation(sim)
  }, [simulation, decodedCalls])

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  if (allTargetsZero) {
    return null;
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-background border border-border overflow-hidden">
        <div className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2 bg-muted/50 border-b border-border">
          <span className="flex-1 text-center">Calls to be executed by Powers</span>
          {hasOverflow && (
            <div className="flex gap-1">
              <button
                onClick={scrollLeft}
                className="p-1 hover:bg-muted transition-colors"
                aria-label="Scroll left"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <button
                onClick={scrollRight}
                className="p-1 hover:bg-muted  transition-colors"
                aria-label="Scroll right"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          )}
        </div>
        <div ref={scrollContainerRef} className="w-full overflow-x-auto">
          <table className="table-auto w-full">
            <thead className="w-full border-b border-border">
              <tr className="bg-background text-[10px] uppercase tracking-wider text-left text-muted-foreground">
                  <th className="px-3 py-2 font-normal">Contracts</th>
                  <th className="px-3 py-2 font-normal">Value</th>
                  <th className="px-3 py-2 font-normal">Function</th>
                  <th className="px-3 py-2 font-normal">Input</th>
              </tr>
            </thead>
            <tbody className="w-full text-xs text-foreground bg-background divide-y divide-border">
              {jsxSimulation[1] && jsxSimulation[1].map(row => {return (row)})} 
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}