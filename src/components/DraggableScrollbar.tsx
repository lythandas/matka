"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from 'lucide-react'; // Using ArrowUp/Down for consistency with ScrollToTopButton
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';

const DraggableScrollbar: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [buttonTop, setButtonTop] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startScrollTop, setStartScrollTop] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const calculateButtonPosition = useCallback(() => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

    if (scrollHeight <= clientHeight) {
      setIsVisible(false);
      return;
    }
    setIsVisible(true);

    const buttonHeight = buttonRef.current?.clientHeight || 40; // Default to 40px if ref not ready
    const viewportHeight = clientHeight;
    const scrollableHeight = scrollHeight - viewportHeight;
    const scrollableViewportHeight = viewportHeight - buttonHeight; // Area button can move within viewport

    const scrollPercentage = scrollTop / scrollableHeight;
    const newButtonTop = scrollableViewportHeight * scrollPercentage;

    setButtonTop(newButtonTop);
  }, []);

  const handleScroll = useCallback(() => {
    if (!isDragging) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(calculateButtonPosition);
    }
  }, [isDragging, calculateButtonPosition]);

  useEffect(() => {
    if (isMobile) return; // Don't run on mobile

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', calculateButtonPosition);
    calculateButtonPosition(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', calculateButtonPosition);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isMobile, handleScroll, calculateButtonPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartY(e.clientY);
    setStartScrollTop(document.documentElement.scrollTop);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = e.clientY - startY;
    const { scrollHeight, clientHeight } = document.documentElement;
    const buttonHeight = buttonRef.current?.clientHeight || 40;

    const scrollableHeight = scrollHeight - clientHeight;
    const scrollableViewportHeight = clientHeight - buttonHeight;

    // Calculate new scroll position based on mouse movement relative to draggable area
    const scrollDelta = (deltaY / scrollableViewportHeight) * scrollableHeight;
    const newScrollTop = startScrollTop + scrollDelta;

    window.scrollTo({ top: newScrollTop, behavior: 'auto' });
  }, [isDragging, startY, startScrollTop]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (isMobile || !isVisible) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          onClick={(e) => e.stopPropagation()} // Prevent accidental clicks from triggering other events
          onMouseDown={handleMouseDown}
          className={cn(
            "fixed right-4 h-10 w-10 rounded-full shadow-lg transition-colors duration-200 z-50 cursor-grab",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            isDragging && "cursor-grabbing bg-blue-600 dark:bg-blue-500" // Indicate dragging state
          )}
          style={{ top: buttonTop }}
          aria-label={t('draggableScrollbar.label')}
          role="slider"
          aria-valuenow={buttonTop}
          aria-valuemin={0}
          aria-valuemax={document.documentElement.clientHeight - (buttonRef.current?.clientHeight || 40)}
          aria-orientation="vertical"
        >
          <ArrowUp className="h-4 w-4 absolute top-1/4 left-1/2 -translate-x-1/2" />
          <ArrowDown className="h-4 w-4 absolute bottom-1/4 left-1/2 -translate-x-1/2" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t('draggableScrollbar.dragToScroll')}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default DraggableScrollbar;