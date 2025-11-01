"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';

const ScrollToTopButton: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, [toggleVisibility]);

  if (!isMobile || !isVisible) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={scrollToTop}
          className={cn(
            "fixed bottom-20 right-4 p-2 rounded-full shadow-lg transition-opacity duration-300 z-40",
            "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          size="icon"
          aria-label={t('scrollToTopButton.label')}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t('scrollToTopButton.label')}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ScrollToTopButton;