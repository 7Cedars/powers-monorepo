"use client";

import React from "react";
import { MemberList } from "./MemberList";
import { useParams } from "next/navigation";
import { TitleText } from "@/components/StandardFonts";
import { bigintToRole } from "@/utils/bigintTo";
import { usePowersStore } from "@/context/store";
import DynamicThumbnail from "@/components/DynamicThumbnail";

export default function Page() {
  const { roleId } = useParams<{ roleId: string }>()  
  const powers = usePowersStore();  
  const roleName = powers ? bigintToRole(BigInt(roleId), powers) : "Loading..."
  
  const role = powers?.roles?.find(r => r.roleId === BigInt(roleId));
  const description = role?.description;

  return (
    <main className="w-full h-fit flex flex-col justify-start items-center pb-20 pt-16 ps-4 pe-12">
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-8 items-center md:items-start mb-8">
        {powers && (
            <div className="flex-shrink-0 mt-4">
                <DynamicThumbnail 
                    roleId={BigInt(roleId)} 
                    powers={powers} 
                    size={120} 
                    className=" shadow-sm object-cover bg-white border border-slate-200"
                />
            </div>
        )}
        
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
