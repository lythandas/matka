"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RectangleVertical, Columns2, Columns3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ColumnToggleProps {
  columnCount: 1 | 2 | 3;
  onColumnCountChange: (count: 1 | 2 | 3) => void;
  className?: string;
}

const ColumnToggle: React.FC<ColumnToggleProps> = ({ columnCount, onColumnCountChange, className }) => {
  const { t } = useTranslation();

  const options: { count: 1 | 2 | 3; Icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { count: 1, Icon: RectangleVertical, label: t('columnToggle.oneColumn') },
    { count: 2, Icon: Columns2, label: t('columnToggle.twoColumns') },
    { count: 3, Icon: Columns3, label: t('columnToggle.threeColumns') },
  ];

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {options.map(({ count, Icon, label }) => (
        <Tooltip key={count}>
          <TooltipTrigger asChild>
            <Button
              variant={columnCount === count ? "default" : "outline"}
              size="icon"
              onClick={() => onColumnCountChange(count)}
              className={cn(
                "h-9 w-9",
                columnCount !== count && "hover:ring-2 hover:ring-ring hover:bg-transparent hover:text-inherit"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="sr-only">{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

export default ColumnToggle;
