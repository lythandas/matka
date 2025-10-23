"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from 'lucide-react';
import PostCalendar from './PostCalendar';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FloatingCalendarProps {
  posts: Post[];
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
}

const FloatingCalendar: React.FC<FloatingCalendarProps> = ({ posts, selectedDate, onDateSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            "hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <PostCalendar
          posts={posts}
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            onDateSelect(date);
            setIsOpen(false); // Close popover on date selection
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

export default FloatingCalendar;