"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortToggleProps {
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  className?: string;
}

const SortToggle: React.FC<SortToggleProps> = ({ sortOrder, onSortOrderChange, className }) => {
  const handleToggleSort = () => {
    onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const tooltipText = sortOrder === 'desc' ? 'Newest First' : 'Oldest First';
  const Icon = sortOrder === 'desc' ? ArrowDownWideNarrow : ArrowUpWideNarrow;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={handleToggleSort}
          className={cn("hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit", className)}
        >
          <Icon className="h-4 w-4" />
          <span className="sr-only">{tooltipText}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default SortToggle;