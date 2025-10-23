"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import MapComponent from './MapComponent';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils'; // Import getAvatarInitials
import { Post, MediaInfo } from '@/types'; // Centralized Post and MediaInfo interface
import { CSSTransition, TransitionGroup } from 'react-transition-group'; // Import TransitionGroup and CSSTransition

interface PostDetailDialogProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  currentIndex: number;
  totalPosts: number;
  onNext: () => void;
  onPrevious: () => void;
}

const PostDetailDialog: React.FC<PostDetailDialogProps> = ({
  post,
  isOpen,
  onClose,
  currentIndex,
  totalPosts,
  onNext,
  onPrevious,
}) => {
  const mediaRefs = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([]);
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0); // For cycling through multiple media items

  // State to manage transition direction
  const prevPostIndexRef = useRef(currentIndex);
  const [transitionClassPrefix, setTransitionClassPrefix] = useState<string | null>(null);

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalPosts - 1;

  const handleToggleFullscreen = (mediaElement: HTMLImageElement | HTMLVideoElement | null) => {
    if (!document.fullscreenEnabled) {
      showError("Fullscreen mode is not supported by your browser.");
      return;
    }

    if (document.fullscreenElement === mediaElement) {
      document.exitFullscreen();
    } else {
      mediaElement?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        showError("Failed to enter full-screen mode.");
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

  // Effect to determine transition direction
  useEffect(() => {
    if (currentIndex > prevPostIndexRef.current) {
      setTransitionClassPrefix('slide-next');
    } else if (currentIndex < prevPostIndexRef.current) {
      setTransitionClassPrefix('slide-prev');
    } else {
      setTransitionClassPrefix(null); // No transition if same post or initial render
    }
    prevPostIndexRef.current = currentIndex;
  }, [currentIndex]);


  const displayName = post.author_name || post.author_username;
  const mediaItems = post.media_items || [];
  const currentMedia = mediaItems[currentMediaIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[950px] max-h-[98vh] flex flex-col">
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
              <DialogTitle>{post.title || "Post details"}</DialogTitle>
              <DialogDescription>
                By {displayName} &bull; {format(new Date(post.created_at), 'PPP p')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <TransitionGroup className="relative flex-grow overflow-hidden">
          <CSSTransition
            key={post.id} // Key is essential here for TransitionGroup to detect changes
            timeout={300} // Match animation duration
            classNames={transitionClassPrefix || ''} // Use the determined prefix for classNames
          >
            {/* The content div needs to be the direct child of CSSTransition and handle its own scrolling */}
            <div className="absolute inset-0 p-6 pt-4 flex flex-col overflow-y-auto">
              {mediaItems.length > 0 && (
                <div className="relative mb-4 flex-shrink-0"> {/* Added flex-shrink-0 */}
                  {console.log('Current media for display:', currentMedia)}
                  {currentMedia?.type === 'image' && (
                    <img
                      ref={(el) => (mediaRefs.current[currentMediaIndex] = el)}
                      src={currentMedia.urls.large || '/placeholder.svg'}
                      alt={post.title || "Post image"}
                      className="w-full h-auto object-contain max-h-[60vh] rounded-md mx-auto" // Changed object-cover to object-contain, added max-h and mx-auto
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                        e.currentTarget.onerror = null;
                        console.error(`Failed to load image: ${currentMedia.urls.large}`);
                        console.log('Image src that failed:', e.currentTarget.src);
                      }}
                    />
                  )}
                  {currentMedia?.type === 'video' && (
                    <video
                      ref={(el) => (mediaRefs.current[currentMediaIndex] = el)}
                      src={currentMedia.url}
                      controls
                      className="w-full h-auto object-contain max-h-[60vh] rounded-md mx-auto" // Changed object-cover to object-contain, added max-h and mx-auto
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
          </CSSTransition>
        </TransitionGroup>

        {canGoPrevious && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-20 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
            onClick={onPrevious}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {canGoNext && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-20 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
            onClick={onNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;