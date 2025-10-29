"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize, ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { format } from 'date-fns';
import MapComponent from './MapComponent';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { Post, MediaInfo, Journey } from '@/types';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import { useIsMobile } from '@/hooks/use-mobile';

interface PostDetailDialogProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  currentIndex: number;
  totalPosts: number;
  onNext: () => void;
  onPrevious: () => void;
  journey: Journey | null;
}

const PostDetailDialog: React.FC<PostDetailDialogProps> = ({
  post,
  isOpen,
  onClose,
  currentIndex,
  totalPosts,
  onNext,
  onPrevious,
  journey,
}) => {
  const { t } = useTranslation();
  const currentLocale = getDateFnsLocale();
  const isMobile = useIsMobile();

  console.log(`[PostDetailDialog] Rendering. isOpen: ${isOpen}, post:`, post);

  // Only render a simple message to test if the DialogContent appears
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Post Detail Test</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            This is a simplified test of the PostDetailDialog content.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>If you see this, the PostDetailDialog component is rendering its content!</p>
          <p>Post Title: {post.title || 'N/A'}</p>
          <p>Post Message: {post.message.substring(0, 50)}...</p>
        </div>
        <Button onClick={onClose} className="mt-4 w-full">
          {t('common.close')}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;