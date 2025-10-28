"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize, ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { format } from 'date-fns';
import MapComponent from './MapComponent';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { Post, MediaInfo, Journey } from '@/types';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';

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
  const mediaRefs = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([]);
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const currentLocale = getDateFnsLocale();

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalPosts - 1;

  const handleToggleFullscreen = (mediaElement: HTMLImageElement | HTMLVideoElement | null) => {
    if (!document.fullscreenEnabled) {
      showError(t('postDetailDialog.fullscreenNotSupported'));
      return;
    }

    if (document.fullscreenElement === mediaElement) {
      document.exitFullscreen();
    } else {
      mediaElement?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        showError(t('postDetailDialog.failedToEnterFullscreen'));
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMediaFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [post]);

  const displayName = post.author_name || post.author_username;
  const mediaItems = post.media_items || [];
  const currentMedia = mediaItems[currentMediaIndex];
  const hasMedia = mediaItems.length > 0;
  const hasCoordinates = !!post.coordinates;

  // Determine the overall dialog width based on content
  let dialogMaxWidthClass = "sm:max-w-[90vw] max-w-[98vw]"; // Default wide
  if (!hasMedia && !hasCoordinates) {
    dialogMaxWidthClass = "sm:max-w-[500px] max-w-[90vw]"; // Narrower for text-only
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("max-h-[90vh] flex flex-col p-0", dialogMaxWidthClass)}>
        {/* Main content area, handles layout based on media presence */}
        <div className={cn(
          "flex flex-grow overflow-hidden",
          (hasMedia || hasCoordinates) ? "gap-6" : "flex-col" // gap-6 for two columns, flex-col for one
        )}>
          {/* Left Column: Media OR Map */}
          {(hasMedia || hasCoordinates) && (
            <div className="w-4/5 flex flex-col items-center justify-center relative p-6 pt-4">
              {hasMedia ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {currentMedia?.type === 'image' && (
                    <img
                      ref={(el) => (mediaRefs.current[currentMediaIndex] = el)}
                      src={currentMedia.urls.large || '/placeholder.svg'}
                      alt={post.title || t('common.postImage')}
                      className="max-w-full max-h-full object-contain rounded-md"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                        e.currentTarget.onerror = null;
                        console.error(t('postDetailDialog.failedToLoadImage'), currentMedia.urls.large);
                      }}
                    />
                  )}
                  {currentMedia?.type === 'video' && (
                    <video
                      ref={(el) => (mediaRefs.current[currentMediaIndex] = el)}
                      src={currentMedia.url}
                      controls
                      className="max-w-full max-h-full object-contain rounded-md"
                    />
                  )}

                  {/* Button to ENTER fullscreen (only visible when NOT in fullscreen) */}
                  {document.fullscreenEnabled && currentMedia && !isMediaFullscreen && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                      onClick={() => handleToggleFullscreen(mediaRefs.current[currentMediaIndex])}
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  )}

                  {mediaItems.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                        onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1))}
                        disabled={isMediaFullscreen}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                        onClick={() => setCurrentMediaIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1))}
                        disabled={isMediaFullscreen}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1 z-10">
                        {mediaItems.map((_, idx) => (
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
                </div>
              ) : ( // No media, but has coordinates
                <div className="w-full h-full rounded-md overflow-hidden">
                  <MapComponent coordinates={post.coordinates} zoom={12} className="h-full" />
                </div>
              )}
            </div>
          )}

          {/* Right Column: Details (Title, Author, Message) */}
          <div className={cn(
            "flex flex-col overflow-y-auto p-6 pt-4", // Consistent padding for details column
            (hasMedia || hasCoordinates) ? "w-1/5" : "w-full" // Dynamic width based on left column presence
          )}>
            <div className="flex items-center mb-4">
              <Avatar className="h-10 w-10 mr-3">
                {post.author_profile_image_url ? (
                  <AvatarImage src={post.author_profile_image_url} alt={displayName} />
                ) : (
                  <AvatarFallback className="bg-blue-500 text-white text-lg">
                    {getAvatarInitials(post.author_name, post.author_username)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{post.title || t('postDetailDialog.postDetails')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('postDetailDialog.by', { author: displayName, date: format(new Date(post.created_at), 'PPP p', { locale: currentLocale }) })}
                </p>
              </div>
            </div>
            <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4">
              {post.message}
            </p>
            {/* Map is now only in the left column if coordinates exist */}
          </div>
        </div>

        {/* Post navigation buttons (outside main content, relative to DialogContent) */}
        {canGoPrevious && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-[-2rem] top-1/2 -translate-y-1/2 rounded-full z-20 h-12 w-12 bg-background text-foreground border-2 border-border hover:border-blue-500 hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={onPrevious}
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
        )}
        {canGoNext && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-[-2rem] top-1/2 -translate-y-1/2 rounded-full z-20 h-12 w-12 bg-background text-foreground border-2 border-border hover:border-blue-500 hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={onNext}
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        )}
      </DialogContent>

      {/* Button to EXIT fullscreen (only visible when IN fullscreen, fixed to viewport) */}
      {document.fullscreenEnabled && currentMedia && isMediaFullscreen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed z-[1000] bottom-2 left-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
          onClick={() => handleToggleFullscreen(mediaRefs.current[currentMediaIndex])}
        >
          <Minimize className="h-4 w-4" />
        </Button>
      )}
    </Dialog>
  );
};

export default PostDetailDialog;