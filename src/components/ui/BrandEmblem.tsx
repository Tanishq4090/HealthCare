import React from 'react';

interface BrandEmblemProps {
  className?: string;
  size?: number;
}

export const BrandEmblem: React.FC<BrandEmblemProps> = ({ 
  className = "w-6 h-6 inline-block align-middle",
}) => {
  return (
    <img 
      src="/99care-favicon.png" 
      alt="99 Care emblem" 
      className={`object-contain transition-transform hover:scale-105 ${className}`} 
    />
  );
};

export default BrandEmblem;
