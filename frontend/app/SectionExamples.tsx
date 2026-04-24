"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeployedExamples } from "@/public/organisations/DeployedExamples";
import Image from "next/image";

export function SectionExamples() {
  const router = useRouter();
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);

  // Get all organizations that have example deployments  
  const exampleOrganizations = DeployedExamples;

  // If no examples, don't render the section
  if (exampleOrganizations.length === 0) {
    return null;
  }

  const currentExample = exampleOrganizations[currentExampleIndex];
  const isComingSoon = currentExample.address === '0x0000000000000000000000000000000000000000';

  const handleViewForum = () => {
    if (currentExample.address && !isComingSoon) {
      router.push(`/forum/${currentExample.chainId}/${currentExample.address}`);
    }
  };

  const handleViewEditor = () => {
    if (currentExample.address && !isComingSoon) {
      router.push(`/editor/${currentExample.chainId}/${currentExample.address}/home`);
    }
  };

  const nextExample = () => {
    setCurrentExampleIndex((prev) => (prev + 1) % exampleOrganizations.length);
  };

  const prevExample = () => {
    setCurrentExampleIndex((prev) => (prev - 1 + exampleOrganizations.length) % exampleOrganizations.length);
  };

  return (
    <section id="examples" className="min-h-screen flex flex-col justify-start items-center px-4 snap-start snap-always bg-gradient-to-b from-slate-400 via-slate-300 to-slate-200 sm:pt-16 pt-4">
      <div className="w-full flex flex-col gap-4 justify-between items-center min-h-[calc(100vh-4rem)]">
        <div className="w-full h-full flex flex-col justify-start items-center">
          {/* Title and subtitle */}
          <section className="flex flex-col justify-start items-center">
            <div className="w-full flex flex-row justify-center items-center md:text-4xl text-2xl text-slate-900 text-center max-w-4xl text-pretty font-mono font-bold px-4 uppercase tracking-wider">
              Examples
            </div>
            <div className="w-full flex flex-row justify-center items-center md:text-xl text-lg text-slate-700 max-w-3xl text-center text-pretty py-2 px-4 pb-12 font-mono">
              Explore live implementations of the Powers protocol
            </div>
          </section>


          {/* Example Display */}
          <section className="w-full sm:max-h-[80vh] flex flex-col justify-start items-center bg-background border border-border overflow-hidden max-w-4xl shadow-sm">
            {/* Carousel Header */}
            <div className="w-full flex flex-row justify-between items-center py-4 px-6 border-b border-border flex-shrink-0 bg-muted/50">
              <button
                onClick={prevExample}
                className="p-2 hover:bg-muted transition-colors"
                disabled={exampleOrganizations.length <= 1}
              >
                <ChevronLeftIcon className="w-6 h-6 text-foreground" />
              </button>
              
              <div className="flex flex-col items-center">
                <h3 className="text-xl font-mono font-semibold text-foreground text-center uppercase tracking-wider">{currentExample.title}</h3>
                <div className="flex gap-1 mt-2">
                  {exampleOrganizations.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 ${
                        index === currentExampleIndex ? 'bg-foreground' : 'bg-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={nextExample}
                className="p-2 hover:bg-muted transition-colors"
                disabled={exampleOrganizations.length <= 1}
              >
                <ChevronRightIcon className="w-6 h-6 text-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="w-full py-6 px-6 flex flex-col overflow-y-auto flex-1">
              {/* Image Display */}
              {currentExample.banner && (
                <div className="mb-4 flex justify-center">
                  <div className="relative w-full h-48 sm:h-64">
                    <Image
                      src={currentExample.banner} 
                      alt={`${currentExample.title} example`}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              
              <div className="mb-4">
                <p className="text-muted-foreground text-sm leading-relaxed font-mono">
                  {currentExample.description}
                </p>
              </div>

              {/* View Forum and Editor Buttons */}
              <div className="w-full grow mt-4 flex justify-center items-center gap-4">
                <button
                  className={`flex-1 sm:min-w-[180px] sm:flex-none h-12 px-8 font-mono font-medium uppercase tracking-wider text-sm transition-colors duration-200 flex items-center justify-center ${
                    isComingSoon
                      ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                  onClick={handleViewForum}
                  disabled={isComingSoon}
                >
                  {isComingSoon ? 'Coming Soon' : 'View Forum'}
                </button>
                <button
                  className={`flex-1 sm:min-w-[180px] sm:flex-none h-12 px-8 font-mono font-medium uppercase tracking-wider text-sm transition-colors duration-200 flex items-center justify-center ${
                    isComingSoon
                      ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                  onClick={handleViewEditor}
                  disabled={isComingSoon}
                >
                  {isComingSoon ? 'Coming Soon' : 'View Editor'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Arrow down */}
        <div className="flex flex-col align-center justify-center pb-8">
          <ChevronDownIcon className="w-16 h-16 text-muted-foreground" />
        </div>
      </div>
    </section>
  );
}
