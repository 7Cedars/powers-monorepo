"use client";

import React, { useEffect } from "react";
import { MemberList } from "./MemberList";
import { useParams, useRouter } from "next/navigation";
import { bigintToRole } from "@/utils/bigintTo";
import { usePowersStore, useUIStateStore } from "@/context/store";
import DynamicThumbnail from "@/components/DynamicThumbnail";
import { OrgBanner } from "@/components/OrgBanner";

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
    <main className="min-h-full min-w-full flex flex-col bg-background scanlines pb-16">
      <OrgBanner title={`Role: ${roleName}`} subtitle={description || "View the members of this role."} backButton={{ label: "ALL ROLES", href: `/overview/${chainId}/${powers?.contractAddress}/roles` }} />
      <div className="px-4 flex flex-col gap-6 mt-6">
        {powers && roleId && <MemberList powers={powers} roleId={BigInt(roleId)} />}
      </div>
    </main>
  )
}
