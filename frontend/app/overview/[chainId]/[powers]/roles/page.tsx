"use client";

import React from "react";
import { RoleList } from "./RoleList";
import { Powers } from "@/context/types";
import { usePowersStore } from "@/context/store";
import { OrgBanner } from "@/components/OrgBanner";

export default function Page() {
  const powers = usePowersStore();

  console.log("@roles page rendered:", {powers})

  return (
    <div className="min-h-full min-w-full flex flex-col bg-background scanlines">
      <OrgBanner title="Roles" subtitle="View roles and their holders in the organization." />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {powers && <RoleList powers={powers} />}
      </main>
    </div>
  )
}

