"use client"

import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { useParams, useRouter } from "next/navigation";
import { bigintToRole } from "@/utils/bigintTo";
import { Powers, Status } from "@/context/types";
import { LoadingBox } from "@/components/LoadingBox";

type RolesProps = {
  powers: Powers | undefined;
  status: Status;
}

export function Roles({powers, status}: RolesProps) {
  const router = useRouter();
  const { chainId } = useParams<{ chainId: string }>()

  // Count mandates for each role
  const getMandateCountForRole = (roleId: bigint) => {
    if (!powers?.mandates) return 0;
    const ActiveMandates = powers.mandates.filter(mandate => mandate.active)
    return ActiveMandates.filter(mandate => mandate.conditions?.allowedRole === roleId).length;
  };

  return (
    <div className="flex flex-col max-h-96 border border-border min-h-0">
      <div className="px-4 py-2 bg-muted/50 flex items-center justify-between cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => router.push(`/editor/${chainId}/${powers?.contractAddress}/roles`)}
      >
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base text-sm">ROLES</span>
        <ArrowUpRightIcon className="w-4 h-4 text-muted-foreground" />
      </div>
      
      {status === 'pending' ? 
        <div className="px-4 py-8 flex justify-center items-center">
          <LoadingBox /> 
        </div>
      : 
      powers?.roles && powers?.roles.length > 0 ? 
        <div className="flex-1 overflow-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Role</th>
                <th className="px-4 py-2 text-right text-muted-foreground uppercase text-[10px] tracking-wider w-24">Mandates</th>
              </tr>
            </thead>
            <tbody>
              {powers?.roles?.map((role, i) => (
                <tr
                  key={i}
                  className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/editor/${chainId}/${powers?.contractAddress}/roles/${role.roleId}`)}
                >
                  <td className="px-4 py-3">
                    <span className="text-foreground">
                      {role.roleId == 115792089237316195423570985008687907853269984665640564039457584007913129639935n 
                        ? 'Public' 
                        : bigintToRole(role.roleId as bigint, powers as Powers)
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-muted-foreground">
                      {getMandateCountForRole(role.roleId as bigint)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      :
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No roles found
        </div>
      }
    </div>
  )
}
