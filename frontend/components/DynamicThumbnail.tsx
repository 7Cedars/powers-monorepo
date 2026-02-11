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

const DynamicThumbnail: React.FC<DynamicThumbnailProps> = ({ roleId, powers, size = 64, className = '' }) => {
  const role = powers.roles?.find(r => r.roleId === BigInt(roleId));
  const imageSrc = role?.icon;

  if (roleId === "") {
    return (
      <div 
        className={`${className || 'rounded-md bg-slate-50'} flex items-center justify-center text-gray-500 font-bold border border-gray-200`} 
        style={{ width: size, height: size, fontSize: size * 0.25 }}
      >
        {"Unknown"}
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
        />
     );
  } 

  return (
      <div 
        className={`${className || 'rounded-md bg-slate-50'} flex items-center justify-center text-gray-500 font-bold border border-gray-200`} 
        style={{ width: size, height: size, fontSize: size * 0.25 }}
      >
        {String(roleId)}
      </div>
  );
};

export default DynamicThumbnail; 
