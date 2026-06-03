"use client";

import React from "react";
import { ActionsList } from "./ActionsList";
import { usePowersStore } from "@/context/store";
import { TitleText } from "@/components/StandardFonts";

export default function Page() {
  const powers = usePowersStore();
  return (
    <main className="w-full h-full flex flex-col bg-background pt-20 px-4">
      <TitleText
        title="Actions"
        subtitle="View the actions of the organization."
        size={2}
      />
      <ActionsList powers={powers} />
    </main>
  )
}
