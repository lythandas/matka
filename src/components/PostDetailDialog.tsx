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
  const mediaRefs = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const currentLocale = getDateFnsLocale();
  const isMobile = useIsMobile();

  console.log(`[PostDetailDialog] Rendering. isOpen: ${isOpen}, post:`, post);

  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [post, isOpen]);

  const displayName = post.author_name && post.author_surname ? `${post.author_name} ${post.author_surname}` : post.author_name || post.author_username;
  const mediaItems = post.media_items || [];
  const currentMedia = mediaItems[currentMediaIndex];
  const hasMedia = mediaItems.length > 0;
  const hasCoordinates = !!post.coordinates;

  const dialogMaxWidthClass = "sm:max-w-[90vw] max-w-[98vw]";

  console.log(`[PostDetailDialog] Inside return statement. isOpen: ${isOpen}`);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-h-[90vh] flex flex-col p-4 relative shadow-lg min-h-[300px] z-50",
        "bg-purple-500 text-white w-full h-full", // AGGRESSIVE DEBUGGING STYLES: Bright purple background, full width/height
        dialogMaxWidthClass
      )}>
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

        <div className="flex-grow overflow-y-auto flex flex-col gap-4 p-0">
          {hasMedia && (
            <div className="relative w-full flex-shrink-0" style={{ height: isMobile ? '200px' : '300px' }}>
              {currentMedia?.type === 'image' && (
                <img
                  ref={(el) => (mediaRefs.current[currentMediaIndex] = el)}
                  src={currentMedia.urls.large || '/placeholder.svg'}
                  alt={post.title || t('common.postImage')}
                  className="w-full h-full object-contain rounded-md"
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
                  className="w-full h-full object-contain rounded-md"
                />
              )}

              {mediaItems.length > 1 && (
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
          )}

          <div className="p-4">
            <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-justify">
              {post.message}
            </p>
          </div>

          {hasCoordinates && (
            <div className="relative w-full h-48 rounded-md overflow-hidden p-4">
              <MapComponent coordinates={post.coordinates} zoom={12} className="h-full" />
            </div>
          )}
        </div>

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