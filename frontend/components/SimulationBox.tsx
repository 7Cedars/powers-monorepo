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
};

export const SimulationBox = ({mandate, simulation}: SimulationBoxProps) => {
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
  const params =  bytesToParams(data as `0x${string}`)  
  const dataTypes = params.map(param => param.dataType) 

  // console.log("@SimulationBox: waypoint 2", {jsxSimulation})

  useEffect(() => {
    const fetchAbisAndDecode = async () => {
      if (!simulation) return;
      const targets = simulation[1];
      const values = simulation[2];
      const calldatas = simulation[3];
      
      const explorerUrl = publicClient?.chain?.blockExplorers?.default?.url;
      const apiUrl = publicClient?.chain?.blockExplorers?.default?.apiUrl;

      const newDecodedCalls = await Promise.all(targets.map(async (target, i) => {
        const value = values[i];
        const calldata = calldatas[i];
        let decodedFunctionName = "Unknown";
        let decodedArgs = "";

        if (target === "0x0000000000000000000000000000000000000000") {
          decodedFunctionName = "No Action";
        } else if (calldata === "0x") {
          decodedFunctionName = "Transfer";
        } else if (apiUrl) {
          try {
            const response = await fetch(`${apiUrl}?module=contract&action=getabi&address=${target}`);
            const data = await response.json();
            if (data.status === "1") {
              const abi = JSON.parse(data.result);
              const decoded = decodeFunctionData({ abi, data: calldata });
              decodedFunctionName = decoded.functionName;
              decodedArgs = decoded.args ? JSON.stringify(decoded.args, (key, value) => 
                typeof value === 'bigint' ? value.toString() : value
              , 2) : "";
            }
          } catch (e) {
            console.error("Failed to fetch/decode ABI for target:", target, e);
          }
        }

        return {
          target,
          explorerUrl: explorerUrl ? `${explorerUrl}/address/${target}` : undefined,
          valueEth: formatEther(value),
          calldata,
          functionName: decodedFunctionName,
          functionArgs: decodedArgs
        };
      }));
      setDecodedCalls(newDecodedCalls);
    };

    fetchAbisAndDecode();
  }, [simulation, publicClient]);
    
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
          jsxElements0 = [
            ...jsxElements0,
            <tr key={i} className="text-xs font-mono text-foreground">
              <td colSpan={3} className="px-3 py-2 text-center text-muted-foreground">
                No action will be executed.
              </td>
            </tr>
          ];
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
            <td className="px-3 py-2 text-left">
              <div className="flex flex-col">
                <span className="font-semibold">{call.functionName}</span>
                {call.functionArgs && <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">{call.functionArgs}</pre>}
                {call.functionName === "Unknown" && <span className="text-[10px] text-muted-foreground break-all">{call.calldata}</span>}
              </div>
            </td>
          </tr>
        ];
      }
    } else if (simulation && simulation.length > 0) {
      for (let i = 0; i < simulation[1].length; i++) {
        if (simulation[1][i] === "0x0000000000000000000000000000000000000000") {
          jsxElements0 = [
            ...jsxElements0,
            <tr key={i} className="text-xs font-mono text-foreground">
              <td colSpan={3} className="px-3 py-2 text-center text-muted-foreground">
                No action will be executed.
              </td>
            </tr>
          ];
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
            <td className="px-3 py-2 text-left">{simulation[3][i]}</td>
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
            <td className="px-3 py-2 text-left">{String(stateVarsParsed[i])}</td>
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
                  <th className="px-3 py-2 font-normal">Target contracts</th>
                  <th className="px-3 py-2 font-normal">Value</th>
                  <th className="px-3 py-2 font-normal">Calldata</th>
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