"use client";

import React from 'react';
import { Card } from "@/components/ui/card"; // Import Card from shadcn/ui
import { cn } from '@/lib/utils'; // For combining class names

interface ShineCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  children: React.ReactNode;
}

const ShineCard: React.FC<ShineCardProps> = ({ children, className, ...props }) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden group",
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
};

export default ShineCard;