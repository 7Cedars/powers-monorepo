import { Powers } from '@/context/types';
import { usePathname, useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { truncateAddress } from '@/utils/addressUtils'; 

interface DaoSummaryBoxProps {
  powers: Powers;
  alignment: "column" | "row"; 
  onArchive?: (contractAddress: string) => void;
}

export const DaoSummaryBox = ({ powers, onArchive, alignment }: DaoSummaryBoxProps) => {
    const router = useRouter(); 
    const pathname = usePathname();

    return ( 
        <div
        key={powers.contractAddress}
        className={`border border-border transition-colors relative cursor-pointer hover:bg-muted/50`} // ${pathname == "/" ? "cursor-pointer hover:bg-muted/50" : ""} 
        onClick={() => router.push(`/forum/${powers.chainId}/${powers.contractAddress}`)}>
        
            <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
            <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">{powers.name}</span>
            {onArchive && (
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    onArchive(powers.contractAddress);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors">
                    <XMarkIcon className="h-3 w-3" />
                </button>
            )}
            </div>
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
                    <p className="font-mono text-sm text-foreground">dd-mm-yyyy</p>
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
                    <p className="font-mono text-sm text-foreground">{truncateAddress(powers.contractAddress)} </p>
                </div>
                <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Treasury</span>
                    <p className="font-mono text-sm text-foreground">{powers.treasury === `0x0000000000000000000000000000000000000000` ? truncateAddress(powers.treasury) : "Not set"}</p>
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
