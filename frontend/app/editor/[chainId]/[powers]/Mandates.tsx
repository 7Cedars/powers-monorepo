"use client"

import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { useParams, useRouter } from "next/navigation";
import { Powers, Status, Mandate } from "@/context/types";
import { LoadingBox } from "@/components/LoadingBox";
import { bigintToRole } from "@/utils/bigintTo";

type MandatesProps = {
  powers: Powers | undefined;
  status: Status;
}

export function Mandates({powers, status}: MandatesProps) {
  const router = useRouter();
  const { chainId } = useParams<{ chainId: string }>()

  const activeMandates = powers?.mandates && powers?.mandates?.length > 0 ? powers?.mandates?.filter(mandate => mandate.active) : [];

  return (
    <div className="flex flex-col border border-border min-h-0">
      <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => router.push(`/protocol/${chainId}/${powers?.contractAddress}/mandates`)}
      >
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">ACTIVE MANDATES</span>
        <ArrowUpRightIcon className="w-4 h-4 text-muted-foreground" />
      </div>
      
      {status === 'pending' ? 
        <div className="px-4 py-8 flex justify-center items-center">
          <LoadingBox /> 
        </div>
      : 
      activeMandates && activeMandates.length > 0 ? 
        <div className="flex-1 overflow-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider w-16">ID</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Mandate</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider w-24">Role</th>
              </tr>
            </thead>
            <tbody>
              {activeMandates.map((mandate: Mandate, i) => {
                const mandateName = mandate.nameDescription || `Mandate #${mandate.index}`;
                const nameBeforeColon = mandateName.includes('::') ? mandateName.split('::')[0] : mandateName;
                const truncatedName = nameBeforeColon.length > 40 ? `${nameBeforeColon.slice(0, 40)}...` : nameBeforeColon;
                const roleName = mandate.conditions?.allowedRole != undefined 
                  ? bigintToRole(mandate.conditions?.allowedRole, powers as Powers) 
                  : "-";
                
                return (
                  <tr
                    key={i}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/protocol/${chainId}/${powers?.contractAddress}/mandates/${mandate.index}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">{mandate.index.toString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground">{truncatedName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">{roleName}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      :
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No mandates found
        </div>
      }
    </div>
  )
}

