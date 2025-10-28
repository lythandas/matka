"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize, ChevronLeft, ChevronRight, Share2 } from 'lucide-react'; // Added Share2 icon
import { format } from 'date-fns';
import MapComponent from './MapComponent';
import { showError, showSuccess } from '@/utils/toast'; // Import showSuccess
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { Post, MediaInfo, Journey } from '@/types'; // Import Journey type
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { getDateFnsLocale } from '@/utils/date-locales'; // Import the locale utility

interface PostDetailDialogProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  currentIndex: number;
  totalPosts: number;
  onNext: () => void;
  onPrevious: () => void;
  journey: Journey | null; // Added journey prop
}

const PostDetailDialog: React.FC<PostDetailDialogProps> = ({
  post,
  isOpen,
  onClose,
  currentIndex,
  totalPosts,
  onNext,
  onPrevious,
  journey, // Destructure journey prop
}) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const mediaRefs = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([]);
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0); // For cycling through multiple media items
  const currentLocale = getDateFnsLocale(); // Get the current date-fns locale

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalPosts - 1;

  const handleToggleFullscreen = (mediaElement: HTMLImageElement | HTMLVideoElement | null) => {
    if (!document.fullscreenEnabled) {
      showError(t('postDetailDialog.fullscreenNotSupported')); // Translated error
      return;
    }

    if (document.fullscreenElement === mediaElement) {
      document.exitFullscreen();
    } else {
      mediaElement?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        showError(t('postDetailDialog.failedToEnterFullscreen')); // Translated error
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
    setCurrentMediaIndex(0); // Reset media index when post changes
  }, [post]);

  const displayName = post.author_name || post.author_username;
  const mediaItems = post.media_items || [];
  const currentMedia = mediaItems[currentMediaIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[950px] max-h-[98vh] flex flex-col">
        <>
          <DialogHeader className="p-6 pb-0 relative">
            <div className="flex items-center mb-2">
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
                <DialogTitle>{post.title || t('postDetailDialog.postDetails')}</DialogTitle>
                <DialogDescription>
                  {t('postDetailDialog.by', { author: displayName, date: format(new Date(post.created_at), 'PPP p', { locale: currentLocale }) })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="relative flex-grow overflow-hidden flex">
            <div className="flex-grow p-6 pt-4 flex flex-col overflow-y-auto h-full">
              {mediaItems.length > 0 && (
                <div className="relative mb-4 flex-shrink-0">
                  {currentMedia?.type === 'image' && (
                    <img
                      ref={(el) => (mediaRefs.current[currentMediaIndex] = el)}
                      src={currentMedia.urls.large || '/placeholder.svg'}
                      alt={post.title || t('common.postImage')}
                      className="w-full h-auto object-contain rounded-md mx-auto"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                        e.currentTarget.onerror = null;
                        console.error(t('postDetailDialog.failedToLoadImage'), currentMedia.urls.large); // Translated error
                      }}
                    />
                  )}
                  {currentMedia?.type === 'video' && (
                    <video
                      ref={(el) => (mediaRefs.current[currentMediaIndex] = el)}
                      src={currentMedia.url}
                      controls
                      className="w-full h-auto object-contain rounded-md mx-auto"
                    />
                  )}

                  {document.fullscreenEnabled && currentMedia && (
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "bottom-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit",
                        isMediaFullscreen ? "fixed z-[1000]" : "absolute"
                      )}
                      onClick={() => handleToggleFullscreen(mediaRefs.current[currentMediaIndex])}
                    >
                      {isMediaFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
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
              )}
              <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4 flex-shrink-0">
                {post.message}
              </p>
              {post.coordinates && (
                <div className="w-full h-64 rounded-md overflow-hidden flex-shrink-0">
                  <MapComponent coordinates={post.coordinates} zoom={12} className="h-full" />
                </div>
              )}
            </div>

            {canGoPrevious && (
              <Button
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-20 h-12 w-12 bg-white/80 text-gray-800 shadow-md hover:bg-white hover:text-gray-900 transition-colors"
                onClick={onPrevious}
              >
                <ChevronLeft className="h-7 w-7" />
              </Button>
            )}
            {canGoNext && (
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-20 h-12 w-12 bg-white/80 text-gray-800 shadow-md hover:bg-white hover:text-gray-900 transition-colors"
                onClick={onNext}
              >
                <ChevronRight className="h-7 w-7" />
              </Button>
            )}
          </div>
          <DialogFooter className="p-6 pt-0 flex justify-end">
          </DialogFooter>
        </>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;