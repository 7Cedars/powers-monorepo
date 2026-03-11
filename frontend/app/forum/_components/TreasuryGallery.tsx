import { useState } from 'react';
import { ChevronLeft, ChevronRight, Image, Coins, Landmark, ExternalLink } from 'lucide-react';

const TREASURY_ITEMS = [
{ name: '[Item 1]', type: 'NFT', itemId: 'A7k3mX9pQ2' },
{ name: '[Item 2]', type: 'CURRENCY', itemId: 'R1bN5vL8wZ' },
{ name: '[Item 3]', type: 'RWA', itemId: 'T4hJ6cF0yS' },
{ name: '[Item 4]', type: 'NFT', itemId: 'W8qD2nK5xM' },
{ name: '[Item 5]', type: 'CURRENCY', itemId: 'P3gV7eB1uH' },
{ name: '[Item 6]', type: 'RWA', itemId: 'Y6tR9aI4oC' },
{ name: '[Item 7]', type: 'CURRENCY', itemId: 'L0sX3fG8dE' },
{ name: '[Item 8]', type: 'NFT', itemId: 'N5wQ1jM7kU' },
{ name: '[Item 9]', type: 'RWA', itemId: 'Z2pH6cT9vB' },
{ name: '[Item 10]', type: 'CURRENCY', itemId: 'F8rY4nA0lJ' }];


const typeConfig: Record<string, {icon: typeof Image;label: string;gradient: string;}> = {
  NFT: { icon: Image, label: 'NFT', gradient: 'from-purple-500/20 to-pink-500/20' },
  CURRENCY: { icon: Coins, label: 'CURRENCY', gradient: 'from-amber-500/20 to-yellow-500/20' },
  RWA: { icon: Landmark, label: 'RWA', gradient: 'from-emerald-500/20 to-teal-500/20' }
};

export function TreasuryGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const item = TREASURY_ITEMS[currentIndex];
  const config = typeConfig[item.type];
  const Icon = config.icon;

  const prev = () => setCurrentIndex((i) => (i - 1 + TREASURY_ITEMS.length) % TREASURY_ITEMS.length);
  const next = () => setCurrentIndex((i) => (i + 1) % TREASURY_ITEMS.length);

  return (
    <div className="border border-border">
      <div className="px-4 py-2 border-b border-border bg-muted/50">
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">VIEW TREASURY</span>
      </div>

      <div className="flex items-center gap-0">
        {/* Left arrow */}
        <button
          onClick={prev}
          className="flex-shrink-0 p-4 text-muted-foreground hover:text-foreground transition-colors hover:bg-muted/20">
          
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Gallery content */}
        <div className="flex-1 flex flex-col items-center py-6 px-4 min-h-[260px] justify-center">
          {/* Placeholder image */}
          <div className={`w-32 h-32 rounded border border-border bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-4`}>
            <Icon className="h-12 w-12 text-muted-foreground/60" strokeWidth={1.5} />
          </div>

          {/* Item details */}
          <h4 className="font-mono text-sm text-foreground mb-1">{item.name}</h4>
          <p className="font-mono text-muted-foreground mb-1 text-sm">ITEM ID: {item.itemId}</p>
          <span className="font-mono text-muted-foreground border border-border rounded px-2 py-0.5 uppercase text-base">
            {config.label}
          </span>

          {/* Dots indicator */}
          <div className="flex items-center gap-1.5 mt-4">
            {TREASURY_ITEMS.map((_, i) =>
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
              i === currentIndex ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'}`
              } />

            )}
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={next}
          className="flex-shrink-0 p-4 text-muted-foreground hover:text-foreground transition-colors hover:bg-muted/20">
          
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* List view */}
      <div className="border-t border-border">
        <div className="px-4 py-2 border-b border-border bg-muted/50">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">ALL ITEMS</span>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {TREASURY_ITEMS.map((listItem, i) => {
            const listConfig = typeConfig[listItem.type];
            const ListIcon = listConfig.icon;
            const isActive = i === currentIndex;
            return (
              <div
                key={listItem.itemId}
                onClick={() => setCurrentIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 font-mono text-[11px] transition-colors border-b border-border/50 last:border-b-0 cursor-pointer ${
                isActive ?
                'bg-accent text-accent-foreground' :
                'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}`
                }>
                
                <ListIcon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span className="flex-1 text-left">{listItem.name}</span>
                
                
                <button
                  onClick={(e) => {e.stopPropagation();}}
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 uppercase tracking-wider border border-border rounded hover:bg-muted/50 hover:text-foreground transition-colors text-xs">
                  
                  <ExternalLink className="h-2.5 w-2.5" />
                  View item history on blockchain explorer
                </button>
              </div>);

          })}
        </div>
      </div>
    </div>);

}