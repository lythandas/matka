"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  journey, // Not used in minimal version, but keep prop
}) => {
  const { t } = useTranslation();
  const currentLocale = getDateFnsLocale();

  const displayName = post.author_name && post.author_surname ? `${post.author_name} ${post.author_surname}` : post.author_name || post.author_username;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col p-4">
        <DialogHeader className="pb-4">
          <DialogTitle>{post.title || t('postDetailDialog.postDetails')}</DialogTitle>
          <DialogDescription>
            <div className="flex items-center mt-2">
              <Avatar className="h-8 w-8 mr-2">
                {post.author_profile_image_url ? (
                  <AvatarImage src={post.author_profile_image_url} alt={displayName} />
                ) : (
                  <AvatarFallback className="bg-blue-500 text-white text-sm">
                    {getAvatarInitials(post.author_name, post.author_username)}
                  </AvatarFallback>
                )}
              </Avatar>
              <p className="text-sm text-muted-foreground">
                {t('postDetailDialog.by', { author: displayName, date: format(new Date(post.created_at), 'PPP p', { locale: currentLocale }) })}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Simplified content area */}
        <div className="flex-grow overflow-y-auto p-4">
          <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-justify">
            {post.message}
          </p>
        </div>

        {/* Temporarily remove navigation buttons */}
        {/* {totalPosts > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full z-20 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
              onClick={onPrevious}
              disabled={currentIndex === 0}
              aria-label={t('postDetailDialog.previousPost')}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full z-20 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
              onClick={onNext}
              disabled={currentIndex === totalPosts - 1}
              aria-label={t('postDetailDialog.nextPost')}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )} */}
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;