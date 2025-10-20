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
        "relative overflow-hidden group",
        // Pseudo-element for the shine effect
        "before:absolute before:inset-[-1px] before:pointer-events-none before:transition-opacity before:duration-300",
        "before:bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),_rgba(255,255,255,0.1)_0%,_transparent_70%)]",
        "before:z-0", // Ensure shine is behind content
        "before:rounded-[var(--radius)]", // Match card's border-radius
        // Mask to make the shine appear only on the border
        "before:mask-image-[linear-gradient(black,black),linear-gradient(black,black)]",
        "before:mask-size-[calc(100%_-_2px)_calc(100%_-_2px),_100%_100%]", // Inner mask 2px smaller
        "before:mask-position-[center_center,_center_center]",
        "before:mask-composite:exclude", // Exclude the inner part
        "before:-webkit-mask-composite:exclude", // For Webkit browsers
        isHovering ? "before:opacity-100" : "before:opacity-0",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Card>
  );
};

export default ShineCard;