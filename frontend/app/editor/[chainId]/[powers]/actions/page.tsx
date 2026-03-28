"use client";

import React, { useEffect } from "react";
import { ActionsList } from "./ActionsList";
import { TitleText } from "@/components/StandardFonts";
import { usePowersStore } from "@/context/store";

export default function Page() { 
  const powers = usePowersStore(); 

  console.log("@actions page rendered:", {powers})

  return (
    <main className="w-full min-h-screen flex flex-col bg-background scanlines pt-12">
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <TitleText
            title="Actions"
            subtitle="View the actions executed by the organization."
            size={2}
          />
        {powers && <ActionsList powers={powers} />}
      </div>
    </main>
  )
}
