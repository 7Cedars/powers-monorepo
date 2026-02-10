import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Powers } from '@/context/types';

/**
 * Props for DynamicThumbnail component.
 */
interface DynamicThumbnailProps {
  roleId: bigint | number | string;
  powers: Powers;
  /**
   * Optionally override the image size (default 64)
   */
  size?: number;
  /**
   * Optionally override the className for the image
   */
  className?: string;
}

/**
 * DynamicThumbnail component: shows a role thumbnail based on role metadata.
 * Fetches the role URI, parses metadata for an icon, and displays it if valid.
 * Falls back to displaying the roleId number if any check fails.
 */
const DynamicThumbnail: React.FC<DynamicThumbnailProps> = ({ roleId, powers, size = 64, className = '' }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchIcon = async () => {
      // 1. Find role and check URI
      // Normalize roleId to BigInt for comparison
      let id: bigint;
      try {
        id = BigInt(roleId);
      } catch {
        // If roleId cannot be converted to bigint, it's invalid for our lookup
        if (isMounted) setShowFallback(true);
        return;
      }

      const role = powers.roles?.find(r => r.roleId === id);
      
      if (!role?.uri) {
        if (isMounted) setShowFallback(true);
        return;
      }

      try {
        // 2. Fetch metadata
        const response = await fetch(role.uri);
        if (!response.ok) throw new Error("Fetch failed");
        const metadata = await response.json();

        // 3. Check icon field
        if (!metadata.icon || typeof metadata.icon !== 'string') {
           throw new Error("No icon");
        }
        
        // 4. Check if png (basic check)
        if (!metadata.icon.toLowerCase().endsWith('.png')) {
           throw new Error("Not a PNG");
        }

        if (isMounted) {
            setImageSrc(metadata.icon);
            setShowFallback(false);
        }
      } catch (e) {
        if (isMounted) setShowFallback(true);
      }
    };

    // Reset state when roleId or powers changes
    setShowFallback(false);
    setImageSrc(null);
    fetchIcon();

    return () => { isMounted = false; };
  }, [roleId, powers]);

  if (showFallback) {
    return (
      <div 
        className={`${className || 'rounded-md bg-slate-50'} flex items-center justify-center text-gray-500 font-bold border border-gray-200`} 
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {String(roleId)}
      </div>
    );
  }

  if (imageSrc) {
     return (
        <Image 
           src={imageSrc} 
           width={size} 
           height={size} 
           className={className || 'object-cover rounded-md bg-slate-50 bg-opacity-0'} 
           alt={`#${roleId}`}
           unoptimized
           onError={() => setShowFallback(true)}
        />
     );
  }

  // Loading state (render empty placeholder)
  return <div style={{ width: size, height: size }} className={className || 'rounded-md bg-slate-50'} />;
};

export default DynamicThumbnail; 
