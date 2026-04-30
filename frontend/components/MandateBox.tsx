"use client";

import React from "react";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { useChains } from 'wagmi'
import { parseChainId } from "@/utils/parsers";
import { Checks, DataType, Execution, Mandate, Powers, Status } from "@/context/types";
import { useParams } from "next/navigation";
import { bigintToRole, bigintToRoleHolders } from '@/utils/bigintTo';
import { DynamicForm } from '@/components/DynamicForm';
import { DynamicActionButton } from "./DynamicActionButton";
import { useChecks } from "@/hooks/useChecks";

type MandateBoxProps = {
  powers: Powers;
  mandate: Mandate;
  params: {
    varName: string;
    dataType: DataType;
    }[]; 
  selectedExecution?: Execution | undefined;
  status: Status; 
};

export function MandateBox({powers, mandate, params, status, selectedExecution }: MandateBoxProps) {
  const { chainId } = useParams<{ chainId: string }>()
  const chains = useChains()
  const supportedChain = chains.find(chain => chain.id == parseChainId(chainId))
  const { fetchChecks, checks } = useChecks();

  return (
    <main className="w-full" help-nav-item="mandate-input">
      <section className="font-mono w-full border-2 border-border overflow-hidden pb-4">
      {/* Header with mandate info */}
      <div className="w-full border-b border-border bg-muted/50 px-6 py-4 mb-6">
        <div className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground shrink-0">
            #{mandate.index.toString()}
          </span>
          <span className="font-semibold text-foreground truncate">
            {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] : `Mandate ${mandate.index}`}
          </span>
        </div>
        {mandate?.conditions && powers && bigintToRole(mandate.conditions.allowedRole, powers) && (
          <span className="text-muted-foreground">
            {bigintToRole(mandate.conditions.allowedRole, powers)}
          </span>
        )}
        {mandate?.nameDescription && mandate.nameDescription.split(':')[1] && (
          <p className="text-sm text-muted-foreground mt-2">
            Description: {mandate.nameDescription.split(':')[1].trim()}
          </p>
        )}
        {mandate.mandateAddress && supportedChain?.blockExplorers?.default.url && (
          <a
            href={`${supportedChain.blockExplorers.default.url}/address/${mandate.mandateAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 mt-2 w-fit"
          >
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors break-all">
              Contract: {mandate.mandateAddress}
            </span>
            <ArrowUpRightIcon className="w-3 h-3 text-muted-foreground shrink-0" />
          </a>
        )}
        {selectedExecution && (
          <a
            href={`${supportedChain?.blockExplorers?.default.url}/tx/${selectedExecution.log.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <div className="flex flex-row gap-1 items-center justify-start mt-1">
              <div className="text-left text-sm text-slate-500 break-all w-fit">
                Tx: {selectedExecution.log.transactionHash}
              </div>
              <ArrowUpRightIcon className="w-4 h-4 text-slate-500" />
            </div>
          </a>
        )}
      </div>

      {/* dynamic form */}
      <DynamicForm mandate={mandate} params={params} status={status} checks={checks as Checks} chainId={parseChainId(chainId)} onCheck={fetchChecks} />
      
      {/* Here dynamic button conditional on status of action  */}
      <DynamicActionButton checks={checks as Checks} /> 

      </section>
    </main>
  );
}