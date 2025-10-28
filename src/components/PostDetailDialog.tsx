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
  const [isWideViewActive, setIsWideViewActive] = useState(false); // New state for custom wide view
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const currentLocale = getDateFnsLocale();

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalPosts - 1;

  const handleToggleWideView = () => {
    setIsWideViewActive(prev => !prev);
  };

  useEffect(() => {
    setCurrentMediaIndex(0);
    setIsWideViewActive(false); // Reset wide view when post changes or dialog opens
  }, [post, isOpen]);

  const displayName = post.author_name || post.author_username;
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
      <DialogContent className={cn("max-h-[90vh] flex flex-col p-0", dialogMaxWidthClass)}>
        {/* Main content area, handles layout based on media presence and wide view */}
        <div className={cn(
          "flex flex-grow overflow-hidden",
          isWideViewActive ? "p-0 gap-0" : "p-6 pt-4 gap-6", // Adjust padding and gap for the main content area
          (hasMedia || hasCoordinates) ? "" : "flex-col" // Only flex-col if no media/coords, otherwise default flex row
        )}>
          {/* Left Column: Media OR Map */}
          {(hasMedia || hasCoordinates) && (
            <div className={cn(
              "flex flex-col items-center justify-center relative",
              isWideViewActive ? "w-full" : "w-4/5" // Adjust width based on wide view
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

                  {mediaItems.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                        onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1))}
                        disabled={isWideViewActive} // Disable navigation in wide view if it causes issues
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                        onClick={() => setCurrentMediaIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1))}
                        disabled={isWideViewActive} // Disable navigation in wide view if it causes issues
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
          )}

          {/* Right Column: Details (Title, Author, Message) */}
          <div className={cn(
            "flex flex-col overflow-y-auto",
            isWideViewActive ? "hidden" : (hasMedia || hasCoordinates) ? "w-1/5" : "w-full" // Hide if wide view, else adjust width
          )}>
            <div className="p-4"> {/* Added padding here for the actual text content */}
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
            </div>
          </div>
        </div>

        {/* Post navigation buttons (outside main content, relative to DialogContent) */}
        {canGoPrevious && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-[-2rem] top-1/2 -translate-y-1/2 rounded-full z-20 h-12 w-12 bg-background text-foreground border-2 border-border hover:border-blue-500 hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={onPrevious}
            disabled={isWideViewActive} // Disable navigation in wide view
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
            disabled={isWideViewActive} // Disable navigation in wide view
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;