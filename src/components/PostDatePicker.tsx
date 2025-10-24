"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { getDateFnsLocale } from '@/utils/date-locales'; // Import the locale utility

interface PostDatePickerProps {
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
}

const PostDatePicker: React.FC<PostDatePickerProps> = ({
  selectedDate,
  onDateSelect,
  disabled = false,
  className,
}) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const currentLocale = getDateFnsLocale(); // Get the current date-fns locale

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP", { locale: currentLocale }) : <span>{t('common.pickADate')}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
          initialFocus
          disabled={disabled}
          locale={currentLocale} // Pass locale to Calendar component
        />
      </PopoverContent>
    </Popover>
  );
};

export default PostDatePicker;