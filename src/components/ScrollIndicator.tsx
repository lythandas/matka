"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from 'react-i18next';

const ScrollIndicator: React.FC = () => {
  const { t } = useTranslation();
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [isScrollingPossible, setIsScrollingPossible] = useState(false);

  const handleScroll = useCallback(() => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const scrollPx = scrollHeight - clientHeight;
    if (scrollPx > 0) {
      setScrollPercentage((scrollTop / scrollPx) * 100);
      setIsScrollingPossible(true);
    } else {
      setScrollPercentage(0);
      setIsScrollingPossible(false);
    }
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    // Also run once on mount to set initial state
    handleScroll();
    // Recalculate on window resize as scrollHeight/clientHeight might change
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [handleScroll]);

  if (!isScrollingPossible) {
    return null; // Don't render if there's no scrollable content
  }

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-2 z-50">
      {/* Scroll to Top Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={scrollToTop}
            className={cn(
              "p-2 rounded-full shadow-lg transition-opacity duration-300",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              scrollPercentage > 0 ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            size="icon"
            aria-label={t('scrollIndicator.scrollToTop')}
            disabled={scrollPercentage === 0}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('scrollIndicator.scrollToTop')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Scroll Indicator Bar */}
      <div className="w-2 h-48 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-100 ease-out"
          style={{ height: `${scrollPercentage}%` }}
        />
      </div>

      {/* Scroll to Bottom Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={scrollToBottom}
            className={cn(
              "p-2 rounded-full shadow-lg transition-opacity duration-300",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              scrollPercentage < 100 ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            size="icon"
            aria-label={t('scrollIndicator.scrollToBottom')}
            disabled={scrollPercentage === 100}
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('scrollIndicator.scrollToBottom')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default ScrollIndicator;