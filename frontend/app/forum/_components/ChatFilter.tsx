 import { useState } from 'react';
 import { Filter, ArrowUp, ArrowDown, Hash, Shield, Search, X } from 'lucide-react';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
   DropdownMenuSeparator,
   DropdownMenuLabel,
 } from '@/components/ui/dropdown-menu';
 
 export type FilterType = 
   | 'none' 
   | 'most-upvotes' 
   | 'most-downvotes' 
   | 'hashtag' 
   | 'dao-role' 
   | 'wallet-address';
 
 export interface ChatFilterState {
   type: FilterType;
   hashtag?: string;
   role?: string;
   walletAddress?: string;
 }
 
 interface ChatFilterProps {
   filter: ChatFilterState;
   onFilterChange: (filter: ChatFilterState) => void;
   availableHashtags: string[];
   availableRoles: string[];
 }
 
export function ChatFilter({ filter, onFilterChange, availableHashtags, availableRoles }: ChatFilterProps) {
  const [walletSearch, setWalletSearch] = useState('');
  const [hashtagSearch, setHashtagSearch] = useState('');
  const [showWalletInput, setShowWalletInput] = useState(false);
  const [showHashtagInput, setShowHashtagInput] = useState(false);

  const clearFilter = () => {
    onFilterChange({ type: 'none' });
    setWalletSearch('');
    setHashtagSearch('');
    setShowWalletInput(false);
    setShowHashtagInput(false);
  };

  const handleHashtagSearch = () => {
    const tag = hashtagSearch.trim().replace(/^#/, '');
    if (tag) {
      onFilterChange({ type: 'hashtag', hashtag: tag });
      setShowHashtagInput(false);
    }
  };
 
   const handleWalletSearch = () => {
     if (walletSearch.trim()) {
       onFilterChange({ type: 'wallet-address', walletAddress: walletSearch.trim() });
       setShowWalletInput(false);
     }
   };
 
   const getFilterLabel = () => {
     switch (filter.type) {
       case 'most-upvotes':
         return 'Most Upvotes';
       case 'most-downvotes':
         return 'Most Downvotes';
       case 'hashtag':
         return `#${filter.hashtag}`;
       case 'dao-role':
         return filter.role;
       case 'wallet-address':
         return `Wallet: ${filter.walletAddress?.slice(0, 8)}...`;
       default:
         return 'Filter';
     }
   };
 
   return (
     <div className="flex items-center gap-2">
        {showWalletInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={walletSearch}
              onChange={(e) => setWalletSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleWalletSearch()}
              placeholder="0x... or ENS"
              className="bg-transparent border border-border px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground w-32 focus:outline-none focus:border-foreground"
              autoFocus
            />
            <button onClick={handleWalletSearch} className="text-muted-foreground hover:text-foreground transition-colors">
              <Search className="h-3 w-3" />
            </button>
            <button onClick={() => setShowWalletInput(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : showHashtagInput ? (
          <div className="flex items-center gap-2">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={hashtagSearch}
              onChange={(e) => setHashtagSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHashtagSearch()}
              placeholder="search hashtag..."
              className="bg-transparent border border-border px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground w-32 focus:outline-none focus:border-foreground"
              autoFocus
            />
            <button onClick={handleHashtagSearch} className="text-muted-foreground hover:text-foreground transition-colors">
              <Search className="h-3 w-3" />
            </button>
            <button onClick={() => setShowHashtagInput(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
       ) : (
         <DropdownMenu>
           <DropdownMenuTrigger className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors focus:outline-none">
             <Filter className="h-3 w-3" />
             <span>{getFilterLabel()}</span>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="start" className="bg-background border-border min-w-[180px]">
             <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
               SORT BY VOTES
             </DropdownMenuLabel>
             <DropdownMenuItem
               onClick={() => onFilterChange({ type: 'most-upvotes' })}
               className="font-mono text-xs cursor-pointer"
             >
               <ArrowUp className="h-3 w-3 mr-2 text-primary" />
               Most Upvotes
             </DropdownMenuItem>
             <DropdownMenuItem
               onClick={() => onFilterChange({ type: 'most-downvotes' })}
               className="font-mono text-xs cursor-pointer"
             >
               <ArrowDown className="h-3 w-3 mr-2 text-destructive" />
               Most Downvotes
             </DropdownMenuItem>
 
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowHashtagInput(true)}
                className="font-mono text-xs cursor-pointer"
              >
                <Hash className="h-3 w-3 mr-2" />
                Search Hashtag
              </DropdownMenuItem>
 
             <DropdownMenuSeparator />
             <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
               PIN BY DAO ROLE
             </DropdownMenuLabel>
             {availableRoles.map((role) => (
               <DropdownMenuItem
                 key={role}
                 onClick={() => onFilterChange({ type: 'dao-role', role })}
                 className="font-mono text-xs cursor-pointer"
               >
                 <Shield className="h-3 w-3 mr-2" />
                 {role}
               </DropdownMenuItem>
             ))}
 
             <DropdownMenuSeparator />
             <DropdownMenuItem
               onClick={() => setShowWalletInput(true)}
               className="font-mono text-xs cursor-pointer"
             >
               <Search className="h-3 w-3 mr-2" />
               Search Wallet Address
             </DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
       )}
 
       {filter.type !== 'none' && (
         <button
           onClick={clearFilter}
           className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
         >
           <X className="h-3 w-3" />
           Clear
         </button>
       )}
     </div>
   );
 }