"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const DraggableScrollbar: React.FC = () => {
  const { t } = useTranslation();
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startThumbTop, setStartThumbTop] = useState(0);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const calculateThumbPositionAndHeight = useCallback(() => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const scrollbarHeight = scrollbarRef.current?.clientHeight || 0;

    if (scrollHeight <= clientHeight) {
      // No scrollbar needed if content fits
      setThumbHeight(0);
      setThumbTop(0);
      return;
    }

    const visibleRatio = clientHeight / scrollHeight;
    const newThumbHeight = Math.max(20, scrollbarHeight * visibleRatio); // Min height of 20px
    const scrollableTrackHeight = scrollbarHeight - newThumbHeight;
    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
    const newThumbTop = scrollableTrackHeight * scrollPercentage;

    setThumbHeight(newThumbHeight);
    setThumbTop(newThumbTop);
  }, []);

  const handleScroll = useCallback(() => {
    if (!isDragging) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(calculateThumbPositionAndHeight);
    }
  }, [isDragging, calculateThumbPositionAndHeight]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', calculateThumbPositionAndHeight);
    calculateThumbPositionAndHeight(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', calculateThumbPositionAndHeight);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleScroll, calculateThumbPositionAndHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartY(e.clientY);
    setStartThumbTop(thumbTop);
  }, [thumbTop]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = e.clientY - startY;
    const newThumbTop = startThumbTop + deltaY;

    const { scrollHeight, clientHeight } = document.documentElement;
    const scrollbarHeight = scrollbarRef.current?.clientHeight || 0;
    const scrollableTrackHeight = scrollbarHeight - thumbHeight;

    // Clamp newThumbTop within bounds
    const clampedThumbTop = Math.max(0, Math.min(scrollableTrackHeight, newThumbTop));
    setThumbTop(clampedThumbTop);

    const scrollPercentage = clampedThumbTop / scrollableTrackHeight;
    const newScrollTop = scrollPercentage * (scrollHeight - clientHeight);

    window.scrollTo({ top: newScrollTop, behavior: 'auto' });
  }, [isDragging, startY, startThumbTop, thumbHeight]);

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

  if (thumbHeight === 0) {
    return null; // Don't render if no scroll is possible
  }

  return (
    <div
      ref={scrollbarRef}
      className="fixed right-2 top-1/2 -translate-y-1/2 w-2 h-[80vh] bg-gray-200 dark:bg-gray-700 rounded-full z-50 cursor-pointer"
      aria-label={t('draggableScrollbar.label')}
    >
      <div
        ref={thumbRef}
        className={cn(
          "absolute w-full bg-blue-500 dark:bg-blue-400 rounded-full transition-colors duration-200",
          isDragging && "bg-blue-600 dark:bg-blue-500"
        )}
        style={{ height: thumbHeight, top: thumbTop }}
        onMouseDown={handleMouseDown}
        role="slider"
        aria-valuenow={thumbTop}
        aria-valuemin={0}
        aria-valuemax={scrollbarRef.current?.clientHeight || 0}
        aria-orientation="vertical"
        aria-label={t('draggableScrollbar.thumbLabel')}
      />
    </div>
  );
};

export default DraggableScrollbar;