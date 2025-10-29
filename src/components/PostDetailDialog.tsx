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

  const [isFullScreen, setIsFullScreen] = useState(false);
  const mediaRef = useRef<HTMLDivElement>(null); // This ref will now be on the media column
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  useEffect(() => {
    // Reset full screen and media index when dialog opens/closes
    if (isOpen) {
      setIsFullScreen(false);
      setCurrentMediaIndex(0);
    }
  }, [isOpen]);

  const toggleFullScreen = () => {
    if (!mediaRef.current) {
      showError(t('postDetailDialog.failedToEnterFullscreen'));
      return;
    }

    if (!document.fullscreenElement) {
      if (mediaRef.current.requestFullscreen) {
        mediaRef.current.requestFullscreen().catch(() => {
          showError(t('postDetailDialog.failedToEnterFullscreen'));
        });
      } else {
        showError(t('postDetailDialog.fullscreenNotSupported'));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const handleNextMedia = () => {
    if (post.media_items && currentMediaIndex < post.media_items.length - 1) {
      setCurrentMediaIndex(prev => prev + 1);
    }
  };

  const handlePreviousMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(prev => prev - 1);
    }
  };

  const authorDisplayName = post.author_name && post.author_surname
    ? `${post.author_name} ${post.author_surname}`
    : post.author_name || post.author_username;

  const currentMedia = post.media_items?.[currentMediaIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "flex flex-col p-0", // Base is column, no padding on content itself
        isFullScreen ? "w-screen h-screen max-w-none max-h-none" : "sm:max-w-[90vw] max-w-[98vw] h-[90vh]",
        "lg:flex-row" // On large screens, make it a row
      )}>
        {/* Media Column (Left on large screens, top on small screens) */}
        <div
          ref={mediaRef}
          className={cn(
            "relative flex items-center justify-center bg-black rounded-t-md lg:rounded-l-md lg:rounded-tr-none overflow-hidden",
            "flex-grow lg:w-3/4", // Take 3/4 width on large screens, grow to fill height
            "min-h-[50vh] lg:min-h-full" // Ensure it has height on mobile, fills parent height on large screens
          )}
        >
          {post.media_items && post.media_items.length > 0 ? (
            <>
              {currentMedia?.type === 'image' && currentMedia.urls.large && (
                <img
                  src={currentMedia.urls.large}
                  alt={post.title || t('common.postImage')}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                    e.currentTarget.onerror = null;
                    showError(t('postDetailDialog.failedToLoadImage'));
                  }}
                />
              )}
              {currentMedia?.type === 'video' && currentMedia.url && (
                <video
                  src={currentMedia.url}
                  controls
                  className="max-w-full max-h-full object-contain"
                />
              )}

              {post.media_items.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePreviousMedia}
                    disabled={currentMediaIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMedia}
                    disabled={currentMediaIndex === (post.media_items.length - 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1 z-10">
                    {post.media_items.map((_, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "h-2 w-2 rounded-full bg-white/50",
                          idx === currentMediaIndex && "bg-white"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullScreen}
                className="absolute top-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
              >
                {isFullScreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Compass className="h-12 w-12 mx-auto mb-2" />
              <p>{t('postDetailDialog.noMedia')}</p>
            </div>
          )}

          {/* Post Navigation Buttons (Overlay) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit z-20"
            aria-label={t('postDetailDialog.previousPost')}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={currentIndex === totalPosts - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit z-20"
            aria-label={t('postDetailDialog.nextPost')}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Details Column (Right on large screens, bottom on small screens) */}
        <div className={cn(
          "flex flex-col lg:w-1/4 p-4 overflow-y-auto",
          "border-t lg:border-t-0 lg:border-l dark:border-gray-700" // Border between sections
        )}>
          <DialogHeader className="pb-4"> {/* Moved header here, removed border-b */}
            {/* Removed DialogTitle and DialogDescription */}
          </DialogHeader>

          <div className="flex items-center mb-4">
            {post.author_profile_image_url ? (
              <Avatar className="h-10 w-10 mr-3">
                <AvatarImage src={post.author_profile_image_url} alt={authorDisplayName} />
              </Avatar>
            ) : (
              <Avatar className="h-10 w-10 mr-3">
                <AvatarFallback className="bg-blue-500 text-white text-lg">
                  {getAvatarInitials(post.author_name, post.author_username)}
                </AvatarFallback>
              </Avatar>
            )}
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {authorDisplayName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(post.created_at), 'PPP p', { locale: currentLocale })}
              </p>
            </div>
          </div>

          {post.title && (
            <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">{post.title}</h3>
          )}
          <p className="text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4 text-justify">
            {post.message}
          </p>

          {post.coordinates && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold mb-2">{t('editPostDialog.location')}</h4>
              <MapComponent coordinates={post.coordinates} className="h-64" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;