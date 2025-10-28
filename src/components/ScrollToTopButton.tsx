"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const ScrollToTopButton: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    if (window.scrollY > 300) { // Show button after scrolling 300px
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
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, [toggleVisibility]);

  return (
    <Button
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-20 right-4 p-2 rounded-full shadow-lg transition-opacity duration-300 z-50",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      size="icon"
      aria-label={t('scrollToTopButton.label')}
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
};

export default ScrollToTopButton;