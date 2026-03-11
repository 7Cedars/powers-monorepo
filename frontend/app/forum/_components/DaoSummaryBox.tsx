import { Powers } from '@/context/types';
import { useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DaoSummaryBoxProps {
  powers: Powers;
  onArchive: (contractAddress: string) => void;
}

export const DaoSummaryBox = ({ powers, onArchive }: DaoSummaryBoxProps) => {
    const router = useRouter();

    return ( 
        <div
        key={powers.contractAddress}
        className="border border-border cursor-pointer hover:bg-muted/10 transition-colors relative"
        onClick={() => router.push(`/view/${powers.contractAddress}`)}>
        
            <div className="px-4 py-2 border-b border-border bg-muted/10 flex items-center justify-between">
            <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">{powers.name}</span>
            <button
            onClick={(e) => {
                e.stopPropagation();
                onArchive(powers.contractAddress);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors">
                <XMarkIcon className="h-3 w-3" />
            </button>
            </div>
            <div className="px-4 py-3 space-y-3">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {powers?.metadatas?.description ? powers.metadatas.description : "No description available."}
            </p>
            <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Members</span>
                <p className="font-mono text-sm text-foreground">0</p>
                </div>
                <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Founded</span>
                <p className="font-mono text-sm text-foreground">dd-mm-yyyy</p>
                </div>
                <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Mandates</span>
                <p className="font-mono text-sm text-foreground">0</p>
                </div>
                <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Active</span>
                <p className="font-mono text-sm text-foreground">0</p>
                </div>
                <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Treasury</span>
                <p className="font-mono text-sm text-foreground">0</p>
                </div>
            </div>
            </div>
        </div>
    )
}
