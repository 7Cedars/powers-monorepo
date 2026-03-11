import { useState, useEffect } from 'react';
import { useCoinSound } from '@/hooks/useCoinSound';

interface Coin {
  id: number;
  x: number;
  y: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
}

interface CoinAnimationProps {
  trigger: number; // increment to spawn a new coin
  originX?: number;
  originY?: number;
}

export function CoinAnimation({ trigger, originX = 0, originY = 0 }: CoinAnimationProps) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const { playSound } = useCoinSound();

  useEffect(() => {
    if (trigger === 0) return;
    
    // Play the 8-bit coin sound
    playSound();
    
    // Spawn 2-4 coins
    const numCoins = Math.floor(Math.random() * 3) + 2;
    const newCoins: Coin[] = [];
    
    for (let i = 0; i < numCoins; i++) {
      const angle = (Math.random() * 120 - 150) * (Math.PI / 180); // -150 to -30 degrees (upward arc)
      const speed = Math.random() * 150 + 100; // Slower speed so coins stay visible longer
      
      newCoins.push({
        id: Date.now() + i,
        x: originX,
        y: originY,
        rotation: Math.random() * 360,
        velocityX: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        velocityY: Math.sin(angle) * speed,
      });
    }
    
    setCoins(prev => [...prev, ...newCoins]);
    
    // Remove coins after animation
    setTimeout(() => {
      setCoins(prev => prev.filter(c => !newCoins.find(nc => nc.id === c.id)));
    }, 2000);
  }, [trigger, originX, originY]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]" style={{ overflow: 'visible' }}>
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute animate-coin-fly"
          style={{
            left: coin.x,
            top: coin.y,
            '--velocity-x': `${coin.velocityX}px`,
            '--velocity-y': `${coin.velocityY}px`,
            '--rotation': `${coin.rotation + 720}deg`,
          } as React.CSSProperties}
        >
          {/* Pixel art coin SVG */}
          <svg
            width="80"
            height="80"
            viewBox="0 0 16 16"
            className="drop-shadow-[0_0_30px_rgba(255,215,0,1)] drop-shadow-[0_0_60px_rgba(255,215,0,1)] drop-shadow-[0_0_100px_rgba(255,215,0,0.8)]"
            style={{ imageRendering: 'pixelated' }}
          >
            {/* Outer black border */}
            <rect x="4" y="0" width="8" height="1" fill="#000" />
            <rect x="2" y="1" width="2" height="1" fill="#000" />
            <rect x="12" y="1" width="2" height="1" fill="#000" />
            <rect x="1" y="2" width="1" height="2" fill="#000" />
            <rect x="14" y="2" width="1" height="2" fill="#000" />
            <rect x="0" y="4" width="1" height="8" fill="#000" />
            <rect x="15" y="4" width="1" height="8" fill="#000" />
            <rect x="1" y="12" width="1" height="2" fill="#000" />
            <rect x="14" y="12" width="1" height="2" fill="#000" />
            <rect x="2" y="14" width="2" height="1" fill="#000" />
            <rect x="12" y="14" width="2" height="1" fill="#000" />
            <rect x="4" y="15" width="8" height="1" fill="#000" />
            
            {/* Gold fill */}
            <rect x="4" y="1" width="8" height="1" fill="#FFD700" />
            <rect x="2" y="2" width="12" height="2" fill="#FFD700" />
            <rect x="1" y="4" width="14" height="8" fill="#FFD700" />
            <rect x="2" y="12" width="12" height="2" fill="#FFD700" />
            <rect x="4" y="14" width="8" height="1" fill="#FFD700" />
            
            {/* Highlight */}
            <rect x="4" y="2" width="4" height="1" fill="#FFF8B0" />
            <rect x="2" y="3" width="3" height="1" fill="#FFF8B0" />
            <rect x="2" y="4" width="2" height="3" fill="#FFF8B0" />
            
            {/* Dollar sign - darker gold */}
            <rect x="7" y="4" width="2" height="1" fill="#CC9900" />
            <rect x="6" y="5" width="1" height="1" fill="#CC9900" />
            <rect x="7" y="6" width="2" height="1" fill="#CC9900" />
            <rect x="9" y="7" width="1" height="1" fill="#CC9900" />
            <rect x="6" y="8" width="1" height="1" fill="#CC9900" />
            <rect x="7" y="9" width="2" height="1" fill="#CC9900" />
            <rect x="7" y="10" width="2" height="1" fill="#CC9900" />
            
            {/* Shadow */}
            <rect x="12" y="5" width="2" height="6" fill="#B8860B" />
            <rect x="10" y="11" width="4" height="2" fill="#B8860B" />
          </svg>
        </div>
      ))}
    </div>
  );
}
