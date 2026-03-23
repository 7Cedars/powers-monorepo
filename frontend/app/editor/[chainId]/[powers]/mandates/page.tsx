"use client";

import React from "react";
import { MandateList } from "./MandateList";
import { TitleText } from "@/components/StandardFonts";
import { usePowersStore } from "@/context/store";
 
export default function Page() {    
  const powers = usePowersStore(); 

  console.log("@mandates page rendered:", {powers})
  
  return (
    <main className="w-full h-full flex flex-col justify-start bg-background items-center pt-20 ps-4">
      <TitleText
        title="Mandates"
        subtitle="View the mandates of the organization."
        size={2}
      />
      {powers && <MandateList powers={powers} status={status} />}
    </main>
  )
}
