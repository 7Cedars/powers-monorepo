import { Powers } from '@/context/types';
import { usePathname, useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { parseAddress } from '@/utils/addressUtils';
import { toDDMMYYYY } from '@/utils/toDates';
import { useBlocks } from '@/hooks/useBlocks';
import { useEffect } from 'react';

interface DaoSummaryBoxProps {
  powers: Powers;
  alignment: "column" | "row"; 
  onArchive?: (contractAddress: string) => void;
  showHeader?: boolean; // Controls whether to show title and banner overlay
}

export const DaoSummaryBox = ({ powers, onArchive, alignment, showHeader = false }: DaoSummaryBoxProps) => {
    const router = useRouter(); 
    const pathname = usePathname();
    const { timestamps, fetchTimestamps } = useBlocks();

    // Fetch timestamp for the foundedAt block number
    useEffect(() => {
        if (powers.foundedAt && powers.foundedAt !== 0n) {
            fetchTimestamps([powers.foundedAt], String(powers.chainId));
        }
    }, [powers.foundedAt, powers.chainId, fetchTimestamps]);

    // Format the founded date
    const getFoundedDate = () => {
        if (!powers.foundedAt) return "N/A";
        
        const cacheKey = `${powers.chainId}:${powers.foundedAt}`;
        const cachedTimestamp = timestamps.get(cacheKey);
        
        if (cachedTimestamp && cachedTimestamp.timestamp) {
            return toDDMMYYYY(Number(cachedTimestamp.timestamp));
        }
        
        return "Loading...";
    };

    return ( 
        <div
        key={powers.contractAddress}
        className={`border border-border transition-colors relative cursor-pointer hover:bg-muted/50`}
        onClick={() => router.push(`/forum/${powers.chainId}/${powers.contractAddress}`)}>
        
            {/* Banner - always the same layout */}
            <div 
                className="h-36 px-4 py-2 border-b border-border relative overflow-hidden"
                style={{
                    backgroundImage: powers?.metadatas?.banner ? `url(${powers.metadatas.banner})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}>
                <div className="absolute inset-0 bg-background/20" />
            </div>

            {/* Top row - only visible when showHeader is true */}
            {showHeader && (
                <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
                    <h3 className="text-foreground uppercase tracking-wider text-sm">{powers.name}</h3>
                    {onArchive && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onArchive(powers.contractAddress);
                            }}
                            className="text-foreground hover:text-foreground/80 transition-colors">
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )}
            <div className={`px-4 py-3 flex gap-4 ${alignment === "column" ? "flex-col" : "flex-row"}`}>
            {/* Description section - on top in narrow spaces, left side in wide spaces */}
            <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {powers?.metadatas?.description ? powers.metadatas.description : "No description available."}
                </p>
            </div>
            
            {/* Info grid section - below description in narrow spaces, right side in wide spaces */}
            <div className="xl:flex-shrink-0">
                <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Founded</span>
                    <p className="font-mono text-sm text-foreground">
                      {getFoundedDate()}
                    </p>
                </div>
                <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Mandates</span>
                    <p className="font-mono text-sm text-foreground">{powers.mandateCount}</p>
                </div>
                <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Roles</span>
                    <p className="font-mono text-sm text-foreground">{powers?.roles?.length} </p>
                </div>
                <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Powers</span>
                    <p className="font-mono text-sm text-foreground">{parseAddress(powers.contractAddress)} </p>
                </div>
                <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Treasury</span>
                    <p className="font-mono text-sm text-foreground">{powers.treasury === `0x0000000000000000000000000000000000000000` ? "N/A" : parseAddress(powers.treasury)}</p>
                </div>
                <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Network</span>
                    <p className="font-mono text-sm text-foreground">{powers.chainId}</p>
                </div>
                </div>
            </div>
            </div>
        </div>
    )
}
