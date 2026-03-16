'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useStatusStore } from '@/context/store';

export function BlockCounter({ onRefresh, blockNumber }: { onRefresh: () => void, blockNumber: bigint | null }) {
  const statusPowers = useStatusStore();
  const publicClient = usePublicClient();

  return (  
    <div className="border border-border bg-background font-mono">
      <button
        onClick={onRefresh} 
        disabled={statusPowers.status == "pending" || !publicClient}
        className="w-full flex gap-2 items-center justify-between px-4 py-2 bg-muted/50 hover:bg-muted/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Refresh block number"
      >
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          BLOCK {blockNumber ? blockNumber.toString() : '...'}
        </span>
        <ArrowPathIcon 
          className={`w-4 h-4 text-muted-foreground ${statusPowers.status == "pending" ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  );
}
