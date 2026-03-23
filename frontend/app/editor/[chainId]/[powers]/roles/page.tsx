"use client";

import React from "react";
import { RoleList } from "./RoleList";
import { TitleText } from "@/components/StandardFonts";
import { Powers } from "@/context/types";
import { usePowersStore } from "@/context/store";

export default function Page() {
  const powers = usePowersStore(); 

  console.log("@roles page rendered:", {powers})
  
  return (
    <div className="min-h-full min-w-full flex flex-col bg-background scanlines">
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <h1 className="font-mono text-foreground tracking-wider mb-2 text-center uppercase text-lg">ROLES</h1>
        <p className="font-mono text-xs text-muted-foreground text-center mb-6">
          View roles and their holders in the organization.
        </p>
        {powers && <RoleList powers={powers} />}
      </main>
    </div>
  )
}

