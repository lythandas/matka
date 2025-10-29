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
  const mediaRefs = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([]);
  const [isWideViewActive, setIsWideViewActive] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const currentLocale = getDateFnsLocale();
  const isMobile = useIsMobile();

  const handleToggleWideView = () => {
    setIsWideViewActive(prev => !prev);
  };

  useEffect(() => {
    setCurrentMediaIndex(0);
    setIsWideViewActive(false);
  }, [post, isOpen]);

  const displayName = post.author_name && post.author_surname ? `${post.author_name} ${post.author_surname}` : post.author_name || post.author_username;
  const mediaItems = post.media_items || [];
  const currentMedia = mediaItems[currentMediaIndex];
  const hasMedia = mediaItems.length > 0;
  const hasCoordinates = !!post.coordinates;

  // Determine the overall dialog width based on content or wide view state
  let dialogMaxWidthClass = "sm:max-w-[90vw] max-w-[98vw]"; // Default wide
  if (!hasMedia && !hasCoordinates && !isWideViewActive) {
    dialogMaxWidthClass = "sm:max-w-[500px] max-w-[90vw]"; // Narrower for text-only when not in wide view
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("max-h-[90vh] flex flex-col p-4 relative", dialogMaxWidthClass)}>
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

        {/* Main content area */}
        <div className="flex flex-grow overflow-hidden">
          {(hasMedia || hasCoordinates) ? (
            // Layout for when there is media or coordinates
            <div className={cn(
              "flex flex-grow overflow-hidden",
              isMobile ? "flex-col" : (isWideViewActive ? "flex-row" : "flex-row gap-6")
            )}>
              {/* Media OR Map Section */}
              <div className={cn(
                "relative flex flex-col items-center justify-center p-0 overflow-hidden",
                isMobile ? "w-full h-1/2 min-h-[200px]" : (isWideViewActive ? "w-full h-full" : "w-4/5 h-full")
              )}>
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

                    {/* Button to toggle wide view */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                      onClick={handleToggleWideView}
                    >
                      {isWideViewActive ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>

                    {mediaItems.length > 1 && !isWideViewActive && ( // Only show navigation if multiple media and not in wide view
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1))}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          onClick={() => setCurrentMediaIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1))}
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
                  <div className="relative w-full h-full rounded-md overflow-hidden">
                    <MapComponent coordinates={post.coordinates} zoom={12} className="h-full" />
                    {/* Button to toggle wide view for map */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                      onClick={handleToggleWideView}
                    >
                      {isWideViewActive ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>

              {/* Details Column: Message */}
              <div className={cn(
                "flex flex-col overflow-y-auto p-4",
                isMobile ? "w-full h-1/2" : (isWideViewActive ? "hidden" : "w-1/5 h-full")
              )}>
                <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-justify">
                  {post.message}
                </p>
              </div>
            </div>
          ) : (
            // Layout for when there is ONLY a message (no media/coordinates)
            <div className="flex flex-col flex-grow overflow-y-auto p-4">
              <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-justify">
                {post.message}
              </p>
            </div>
          )}
        </div>

        {/* Post navigation buttons (overlaid on content) */}
        {totalPosts > 1 && (
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;