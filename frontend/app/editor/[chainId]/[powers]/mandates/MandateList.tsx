"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Mandate, Powers } from "@/context/types";
import { bigintToRole } from "@/utils/bigintTo";
import { LoadingBox } from "@/components/LoadingBox";
import { useChains } from "wagmi";

export function MandateList({powers, status}: {powers: Powers | undefined, status: string, onRefresh?: () => void}) {
  const router = useRouter();
  const chains = useChains();
  const { chainId } = useParams<{ chainId: string }>()
  const [deselectedRoles, setDeselectedRoles] = useState<bigint[]>([])
  const ActiveMandates = powers?.mandates?.filter(mandate => mandate.active)

  const handleRoleSelection = (role: bigint) => {
    let newDeselection: bigint[] = []

    if (deselectedRoles?.includes(role)) {
      newDeselection = deselectedRoles?.filter(oldRole => oldRole != role)
    } else {
      newDeselection = [...deselectedRoles, role]
    }
    setDeselectedRoles(newDeselection)
  };

  const blockExplorerUrl = chains.find(chain => chain.id === parseInt(chainId))?.blockExplorers?.default.url;

  return (
    <div className="w-full grow flex flex-col justify-start items-center bg-background border border-border overflow-hidden">
      {/* Role filter bar */}
      <div className="w-full flex flex-row gap-12 justify-start items-center py-4 overflow-x-auto border-b border-border p-4 pe-8">
        {powers?.roles?.map((role, i) => (
          <button 
            key={i}
            onClick={() => handleRoleSelection(BigInt(role.roleId))}
            className="w-fit h-full hover:text-foreground/80 text-sm aria-selected:text-foreground text-foreground/50 cursor-pointer whitespace-nowrap"
            aria-selected={!deselectedRoles?.includes(BigInt(role.roleId))}
          >  
            <p className="text-sm text-left">{bigintToRole(role.roleId, powers)}</p>
          </button>
        ))}
      </div>

      {/* Table content */}
      {status == "pending" ?  
        <div className="w-full flex flex-col justify-center items-center p-6">
          <LoadingBox /> 
        </div>
        :
        ActiveMandates && ActiveMandates.length > 0 ?
          <div className="flex-1 overflow-auto w-full">
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">ID</th>
                  <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Description</th>
                  <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Role</th>
                  <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Contract Address</th>
                </tr>
              </thead>
              <tbody>
                {ActiveMandates
                  ?.filter(mandate => mandate.conditions?.allowedRole != undefined && !deselectedRoles?.includes(BigInt(`${mandate.conditions?.allowedRole}`)))
                  ?.map((mandate: Mandate, i) => {
                    const roleName = mandate.conditions?.allowedRole != undefined ? bigintToRole(mandate.conditions?.allowedRole, powers as Powers) : "-";
                    const fullText = mandate.nameDescription || `Mandate #${mandate.index}`;
                    const [name, ...descParts] = fullText.split(":");
                    const description = descParts.length > 0 ? descParts.join(":").trim() : "";
                    
                    return (
                      <tr 
                        key={i}
                        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => { router.push(`/editor/${chainId}/${powers?.contractAddress}/mandates/${mandate.index}`); }}
                      >
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            {mandate.index}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-foreground">
                            {name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-foreground">
                            {description}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">
                            {roleName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {blockExplorerUrl && mandate.mandateAddress ? (
                            <a
                              href={`${blockExplorerUrl}/address/${mandate.mandateAddress}#code`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {mandate.mandateAddress.slice(0,8)}...{mandate.mandateAddress.slice(-6)}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">
                              {mandate.mandateAddress ? `${mandate.mandateAddress.slice(0,8)}...${mandate.mandateAddress.slice(-6)}` : '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        :
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No active mandates found
        </div>
      }
    </div>
  );
}
