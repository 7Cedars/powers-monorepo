'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useStatusStore } from '@/context/store';

export function BlockCounter({ onRefresh, blockNumber }: { onRefresh: () => void, blockNumber: bigint | null }) {
  const statusPowers = useStatusStore();
  const publicClient = usePublicClient();

  return (  
    <button
      onClick={onRefresh} 
      disabled={statusPowers.status == "pending" || !publicClient}
      className="h-full flex items-center gap-3 px-2 md:px-3 py-1 rounded-md border border-border hover:border-foreground/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Refresh block number"
    >
      <div className="hidden md:flex items-center gap-1">
        <span className="text-sm text-muted-foreground font-mono leading-none">Block {blockNumber ? blockNumber.toString() : '...'}</span>
      </div>
      <div className="flex items-center justify-center rounded-md transition-colors">
          <ArrowPathIcon 
            className={`w-5 h-5 text-muted-foreground ${statusPowers.status == "pending" ? 'animate-spin' : ''}`}
          />
      </div>
    </button>
  );
}
