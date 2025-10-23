"use client";

import React from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortToggleProps {
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  className?: string;
}

const SortToggle: React.FC<SortToggleProps> = ({ sortOrder, onSortOrderChange, className }) => {
  return (
    <ToggleGroup
      type="single"
      value={sortOrder}
      onValueChange={(value: 'asc' | 'desc') => {
        if (value) onSortOrderChange(value);
      }}
      className={cn("w-fit mx-auto", className)}
    >
      <ToggleGroupItem value="desc" aria-label="Sort by newest first">
        <ArrowDownWideNarrow className="h-4 w-4 mr-2" /> Newest First
      </ToggleGroupItem>
      <ToggleGroupItem value="asc" aria-label="Sort by oldest first">
        <ArrowUpWideNarrow className="h-4 w-4 mr-2" /> Oldest First
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export default SortToggle;