"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import { Powers, Role } from "@/context/types";
import { bigintToRole } from "@/utils/bigintTo";
import { LoadingBox } from "@/components/LoadingBox";
import DynamicThumbnail from "@/components/DynamicThumbnail";

type RoleListProps = {
  powers: Powers | undefined
}

// Need to add a refetch button ? 

export function RoleList({powers}: RoleListProps) {
  const router = useRouter();
  const { chainId } = useParams<{ chainId: string }>()

  const roles = powers?.roles


  return (
    <div className="flex-1 flex flex-col border border-border border-b-0 min-h-0">
      {roles && roles.length > 0 ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Role name</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Role ID</th>
                <th className="px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">No. of holders</th>
              </tr>
            </thead>
            <tbody>
              {powers.roles?.map((role: Role, i: number) => (
                <tr 
                  key={i} 
                  className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => {
                    router.push(`/editor/${chainId}/${powers?.contractAddress}/roles/${role.roleId}`);
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-foreground">
                        {bigintToRole(role.roleId, powers as Powers)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">
                      {role.roleId == 115792089237316195423570985008687907853269984665640564039457584007913129639935n 
                        ? 'Public' 
                        : role.roleId.toString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">
                      {role?.amountHolders?.toString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No roles found
        </div>
      )}
    </div>
  );
}
