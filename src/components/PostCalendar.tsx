"use client";

import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Post } from '@/types';
import { isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'; // Ensure Button is imported

interface PostCalendarProps {
  posts: Post[];
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
}

const PostCalendar: React.FC<PostCalendarProps> = ({ posts, selectedDate, onDateSelect }) => {
  const datesWithPosts = posts
    .filter(post => post.created_at)
    .map(post => parseISO(post.created_at));

  const modifiers = {
    hasPosts: datesWithPosts,
  };

  const modifiersClassNames = {
    hasPosts: "bg-blue-500 text-white rounded-full", // Highlight dates with posts
  };

  return (
    <div className="p-4">
      {/* Removed the h2 title "Browse by date" */}
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        className="rounded-md border shadow"
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
      />
      {selectedDate && (
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Selected: {selectedDate.toDateString()}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateSelect(undefined)}
            className="mt-2 hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
          >
            Clear date filter
          </Button>
        </div>
      )}
    </div>
  );
};

export default PostCalendar;