"use client";

import React, { useRef, useState } from 'react';
import { Card } from "@/components/ui/card"; // Import Card from shadcn/ui
import { cn } from '@/lib/utils'; // For combining class names

interface ShineCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  children: React.ReactNode;
}

const ShineCard: React.FC<ShineCardProps> = ({ children, className, ...props }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const { left, top } = cardRef.current.getBoundingClientRect();
      const x = e.clientX - left; // x position within the element.
      const y = e.clientY - top;  // y position within the element.
      cardRef.current.style.setProperty('--mouse-x', `${x}px`);
      cardRef.current.style.setProperty('--mouse-y', `${y}px`);
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <Card
      ref={cardRef}
      className={cn(
        "relative overflow-hidden group", // Add relative and overflow-hidden for the shine effect
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Shine effect element */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity duration-300",
          "bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),_rgba(255,255,255,0.1)_0%,_transparent_50%)]",
          isHovering ? "opacity-100" : "opacity-0"
        )}
      />
      {children}
    </Card>
  );
};

export default ShineCard;