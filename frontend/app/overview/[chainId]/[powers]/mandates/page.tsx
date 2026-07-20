"use client";

import React from "react";
import { MandateList } from "./MandateList";
import { usePowersStore } from "@/context/store";
import { OrgBanner } from "@/components/OrgBanner";

export default function Page() {
  const powers = usePowersStore();

  console.log("@mandates page rendered:", {powers})

  return (
    <main className="w-full h-full flex flex-col justify-start bg-background">
      <OrgBanner title="Mandates" subtitle="View the mandates of the organization." />
      <div className="px-4 pt-4 w-full">
        {powers && <MandateList powers={powers} status={status} />}
      </div>
    </main>
  )
}
