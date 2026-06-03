"use client";

import React, { useEffect } from "react";
import { MemberList } from "./MemberList";
import { useParams, useRouter } from "next/navigation";
import { TitleText } from "@/components/StandardFonts";
import { bigintToRole } from "@/utils/bigintTo";
import { usePowersStore, useUIStateStore } from "@/context/store";
import DynamicThumbnail from "@/components/DynamicThumbnail";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function Page() {
  const { roleId, chainId } = useParams<{ roleId: string; chainId: string }>()
  const powers = usePowersStore();
  const router = useRouter();
  const { setHighlightMode } = useUIStateStore();
  const roleName = powers ? bigintToRole(BigInt(roleId), powers) : "Loading..."

  const role = powers?.roles?.find(r => r.roleId === BigInt(roleId));
  const description = role?.description;

  useEffect(() => {
    if (roleId) {
      setHighlightMode({ type: 'role', roleId: BigInt(roleId) })
    }
  }, [roleId])

  return (
    <main className="min-h-full min-w-full flex flex-col bg-background scanlines pt-20 px-4 pb-16 gap-6">
      <button
        onClick={() => router.push(`/overview/${chainId}/${powers?.contractAddress}/roles`)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
      >
        <ArrowLeftIcon className="w-3 h-3" />
        <span>ALL ROLES</span>
      </button>
      <div className="w-full flex flex-col md:flex-row gap-8 items-center md:items-start mb-2">        
        <div className="flex flex-col gap-1 w-full">
            <TitleText
                title={`Role: ${roleName}`}
                subtitle={description || "View the members of this role."}
                size={2}
            />
        </div>
      </div>
      
      {powers && roleId && <MemberList powers={powers} roleId={BigInt(roleId)} />}
    </main>
  )
}
