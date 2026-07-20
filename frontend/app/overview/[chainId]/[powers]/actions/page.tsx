"use client";

import React from "react";
import { ActionsList } from "./ActionsList";
import { usePowersStore } from "@/context/store";
import { OrgBanner } from "@/components/OrgBanner";

export default function Page() {
  const powers = usePowersStore();
  return (
    <main className="w-full h-full flex flex-col bg-background">
      <OrgBanner title="Actions" subtitle="View the actions of the organization." />
      <div className="px-4 pt-4">
        <ActionsList powers={powers} />
      </div>
    </main>
  )
}
