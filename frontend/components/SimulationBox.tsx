"use client";

import React, { useEffect, useState, useRef } from "react";
import { useReadContract } from 'wagmi'
import { mandateAbi } from "@/context/abi";
import { bytesToParams, parseParamValues } from "@/utils/parsers";
import { decodeAbiParameters, parseAbiParameters } from "viem";
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
  
  const { data } = useReadContract({
        abi: mandateAbi,
        address: mandate.mandateAddress,
        functionName: 'stateVars'
      })
  const params =  bytesToParams(data as `0x${string}`)  
  const dataTypes = params.map(param => param.dataType) 

  // console.log("@SimulationBox: waypoint 2", {jsxSimulation})
    
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

    if (simulation && simulation.length > 0) {
      for (let i = 0; i < simulation[1].length; i++) {
        jsxElements0 = [ 
          ... jsxElements0, 
          <tr
            key={i}
            className="text-xs font-mono text-foreground whitespace-nowrap"
          >
            <td className="px-3 py-2 text-left">{simulation[1][i]}</td> 
            <td className="px-3 py-2 text-left">{String(simulation[2][i])}</td>
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
  }, [simulation])

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
        <div className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2 bg-muted/30 border-b border-border">
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