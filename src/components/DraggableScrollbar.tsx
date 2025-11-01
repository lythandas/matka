"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from 'lucide-react';
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
  
  // Refs to store initial drag state
  const initialMouseYRef = useRef(0);
  const initialButtonTopRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const SCROLL_THRESHOLD = 200; // Pixels from top to show the scrollbar

  const calculateButtonPosition = useCallback(() => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

    if (scrollHeight <= clientHeight || scrollTop < SCROLL_THRESHOLD) {
      setIsVisible(false);
      setButtonTop(0); // Reset button position when not visible
      return;
    }
    setIsVisible(true);

    const buttonHeight = buttonRef.current?.clientHeight || 40;
    const viewportHeight = clientHeight;
    const scrollableHeight = scrollHeight - viewportHeight;
    const scrollableViewportHeight = viewportHeight - buttonHeight;

    const scrollPercentage = scrollTop / scrollableHeight;
    const newButtonTop = scrollableViewportHeight * scrollPercentage;

    setButtonTop(newButtonTop);
  }, []);

  const handleScroll = useCallback(() => {
    if (!isDragging) { // Only update button position from scroll if not currently dragging
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(calculateButtonPosition);
    }
  }, [isDragging, calculateButtonPosition]);

  useEffect(() => {
    if (isMobile) return;

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
    initialMouseYRef.current = e.clientY;
    initialButtonTopRef.current = buttonTop; // Store current visual position
  }, [buttonTop]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = e.clientY - initialMouseYRef.current;
    const { scrollHeight, clientHeight } = document.documentElement;
    const buttonHeight = buttonRef.current?.clientHeight || 40;

    const viewportHeight = clientHeight;
    const scrollableHeight = scrollHeight - viewportHeight;
    const scrollableViewportHeight = viewportHeight - buttonHeight;

    // Calculate new visual button position
    let newVisualButtonTop = initialButtonTopRef.current + deltaY;
    newVisualButtonTop = Math.max(0, Math.min(scrollableViewportHeight, newVisualButtonTop));
    setButtonTop(newVisualButtonTop); // Update button's visual position directly

    // Calculate corresponding scroll position
    const scrollPercentage = newVisualButtonTop / scrollableViewportHeight;
    const newScrollTop = scrollableHeight * scrollPercentage;

    window.scrollTo({ top: newScrollTop, behavior: 'auto' });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // After drag ends, ensure button snaps to correct position based on actual scroll
    calculateButtonPosition(); 
  }, [calculateButtonPosition]);

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
          onClick={(e) => e.stopPropagation()}
          onMouseDown={handleMouseDown}
          className={cn(
            "fixed right-[max(2rem,calc(50vw-384px-2rem))] h-10 w-10 rounded-full shadow-lg transition-colors duration-200 z-50 cursor-grab",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            isDragging && "cursor-grabbing bg-blue-600 dark:bg-blue-500"
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