import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoinAnimation } from './CoinAnimation';

interface Page {
  title: string;
  content: React.ReactNode;
}

interface DocumentViewerProps {
  pages: Page[];
}

export function DocumentViewer({ pages }: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [coinTrigger, setCoinTrigger] = useState(0);
  const [coinOrigin, setCoinOrigin] = useState({ x: 0, y: 0 });
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const goToNext = () => {
    if (currentPage < pages.length - 1 && !isFlipping) {
      // Spawn coins from button position
      if (nextButtonRef.current) {
        const rect = nextButtonRef.current.getBoundingClientRect();
        setCoinOrigin({ x: rect.left + rect.width / 2, y: rect.top });
        setCoinTrigger(prev => prev + 1);
      }
      
      setFlipDirection('next');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsFlipping(false);
      }, 500);
    }
  };

  const goToPrev = () => {
    if (currentPage > 0 && !isFlipping) {
      setFlipDirection('prev');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => prev - 1);
        setIsFlipping(false);
      }, 500);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto perspective-1000">
      <CoinAnimation trigger={coinTrigger} originX={coinOrigin.x} originY={coinOrigin.y} />
      {/* Digital binder frame */}
      <div className="relative bg-background rounded border border-border shadow-[0_0_20px_rgba(255,255,255,0.05)]">
        {/* Binder rings - digital style */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-6 flex flex-col justify-around items-center z-20 pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative">
              <div className="w-4 h-6 border border-muted-foreground/50 rounded-full bg-muted/30" />
              <div className="absolute inset-0 w-4 h-6 border border-primary/20 rounded-full" />
            </div>
          ))}
        </div>

        {/* Book pages container */}
        <div className="flex min-h-[500px] md:min-h-[600px]">
          {/* Left page */}
          <div className="flex-1 relative overflow-hidden">
            <div 
              className={cn(
                "absolute inset-0 bg-muted/10 rounded-l p-6 md:p-8 transform-gpu origin-right",
                "border-r border-border/50",
                "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                isFlipping && flipDirection === 'prev' && "animate-flip-from-left"
              )}
              style={{
                boxShadow: 'inset -1px 0 10px rgba(0,0,0,0.3)'
              }}
            >
              {/* Digital grid pattern */}
              <div 
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
                    linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px'
                }}
              />

              {/* Scanline effect on page */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
                }}
              />

              {/* Page number */}
              <div className="absolute bottom-4 left-6 text-muted-foreground/40 text-xs font-mono">
                [{String(currentPage * 2 + 1).padStart(2, '0')}]
              </div>
              
              {/* Left page content */}
              <div className="h-full overflow-y-auto pr-4 relative z-10">
                <h2 className="text-foreground font-mono text-sm md:text-base font-bold mb-4 border-b border-border pb-2">
                  {pages[currentPage]?.title}
                </h2>
                <div className="text-muted-foreground font-mono text-xs md:text-sm leading-relaxed">
                  {pages[currentPage]?.content}
                </div>
              </div>

              {/* Digital noise overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'
                }}
              />
            </div>
          </div>

          {/* Center spine divider */}
          <div className="w-6 bg-muted/20 relative z-10 flex-shrink-0 border-x border-border/30">
            <div className="absolute inset-0 bg-gradient-to-r from-background via-muted/30 to-background" />
            {/* Digital spine pattern */}
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 8px, hsl(var(--primary) / 0.3) 8px, hsl(var(--primary) / 0.3) 10px)'
              }}
            />
          </div>

          {/* Right page */}
          <div className="flex-1 relative overflow-hidden">
            <div 
              className={cn(
                "absolute inset-0 bg-muted/10 rounded-r p-6 md:p-8 transform-gpu origin-left",
                "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                isFlipping && flipDirection === 'next' && "animate-flip-from-right"
              )}
              style={{
                boxShadow: 'inset 1px 0 10px rgba(0,0,0,0.3)'
              }}
            >
              {/* Digital grid pattern */}
              <div 
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
                    linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px'
                }}
              />

              {/* Scanline effect */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
                }}
              />

              {/* Page number */}
              <div className="absolute bottom-4 right-6 text-muted-foreground/40 text-xs font-mono">
                [{String(currentPage * 2 + 2).padStart(2, '0')}]
              </div>

              {/* Right page content */}
              <div className="h-full overflow-y-auto pl-4 flex flex-col justify-between relative z-10">
                <div>
                  <h3 className="text-muted-foreground/60 font-mono text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-primary/50" />
                    CONTINUE_READING
                  </h3>
                  {currentPage < pages.length - 1 && (
                    <p className="text-muted-foreground/50 font-mono text-xs">
                      &gt; next: {pages[currentPage + 1]?.title}
                    </p>
                  )}
                  {currentPage === pages.length - 1 && (
                    <p className="text-primary/50 font-mono text-xs">
                      &gt; END_OF_DOCUMENT
                    </p>
                  )}
                </div>
                
                {/* Page stack effect - digital style */}
                <div className="absolute right-0 top-4 bottom-4 w-px flex flex-col justify-around">
                  {Array.from({ length: Math.min(pages.length - currentPage - 1, 4) }).map((_, i) => (
                    <div 
                      key={i} 
                      className="h-8 border-r border-muted-foreground/20"
                      style={{ marginRight: `${i * 2}px` }}
                    />
                  ))}
                </div>
              </div>

              {/* Digital noise overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'
                }}
              />
            </div>
          </div>
        </div>

        {/* Corner brackets - digital style */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/30" />
        <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/30" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/30" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/30" />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 px-4">
        <button
          onClick={goToPrev}
          disabled={currentPage === 0 || isFlipping}
          className={cn(
            "flex items-center gap-2 px-4 py-2 font-mono text-xs transition-all",
            "border border-border rounded",
            currentPage === 0 
              ? "opacity-30 cursor-not-allowed" 
              : "hover:bg-muted hover:border-primary/50 hover:text-primary"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>[PREV]</span>
        </button>

        {/* Page indicators */}
        <div className="flex items-center gap-1">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (!isFlipping && i !== currentPage) {
                  setFlipDirection(i > currentPage ? 'next' : 'prev');
                  setIsFlipping(true);
                  setTimeout(() => {
                    setCurrentPage(i);
                    setIsFlipping(false);
                  }, 500);
                }
              }}
              className={cn(
                "w-3 h-3 transition-all font-mono text-[8px] flex items-center justify-center",
                "border",
                i === currentPage 
                  ? "border-primary bg-primary/20 text-primary" 
                  : "border-muted-foreground/30 hover:border-primary/50 text-muted-foreground/50"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          ref={nextButtonRef}
          onClick={goToNext}
          disabled={currentPage === pages.length - 1 || isFlipping}
          className={cn(
            "flex items-center gap-2 px-4 py-2 font-mono text-xs transition-all",
            "border border-border rounded",
            currentPage === pages.length - 1 
              ? "opacity-30 cursor-not-allowed" 
              : "hover:bg-muted hover:border-primary/50 hover:text-primary"
          )}
        >
          <span>[NEXT]</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
