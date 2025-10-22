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
import { Post } from '@/types'; // Centralized Post interface

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
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // New ref for video
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false); // Changed to isMediaFullscreen

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalPosts - 1;

  const handleToggleFullscreen = () => {
    if (!document.fullscreenEnabled) {
      showError("Fullscreen mode is not supported by your browser.");
      return;
    }

    const targetElement = post.image_urls?.type === 'image' ? imageRef.current : videoRef.current;

    if (document.fullscreenElement === targetElement) {
      document.exitFullscreen();
    } else {
      targetElement?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        showError("Failed to enter full-screen mode.");
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const targetElement = post.image_urls?.type === 'image' ? imageRef.current : videoRef.current;
      setIsMediaFullscreen(document.fullscreenElement === targetElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [post.image_urls]);

  const displayName = post.author_name || post.author_username;

  let mediaElement: React.ReactNode = null;
  let mediaFullscreenUrl: string | undefined;

  if (post.image_urls?.type === 'image') {
    const dialogImageUrl = post.image_urls.urls.large || '/placeholder.svg';
    mediaFullscreenUrl = post.image_urls.urls.original || post.image_urls.urls.large || '/placeholder.svg';
    mediaElement = (
      <img
        ref={imageRef}
        src={isMediaFullscreen ? mediaFullscreenUrl : dialogImageUrl}
        alt={post.title || "Post image"}
        className="w-full h-auto object-cover rounded-md"
        onError={(e) => {
          e.currentTarget.src = '/placeholder.svg';
          e.currentTarget.onerror = null;
          console.error(`Failed to load image: ${isMediaFullscreen ? mediaFullscreenUrl : dialogImageUrl}`);
        }}
      />
    );
  } else if (post.image_urls?.type === 'video') {
    const videoUrl = post.image_urls.url;
    mediaFullscreenUrl = videoUrl; // For videos, the original URL is used for fullscreen
    mediaElement = (
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full h-auto object-cover rounded-md"
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[950px] max-h-[98vh] overflow-y-auto">
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
        <div className="relative p-6 pt-4">
          {post.image_urls && (
            <div className="relative mb-4">
              {mediaElement}
              {document.fullscreenEnabled && (post.image_urls.type === 'image' || post.image_urls.type === 'video') && (
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "bottom-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit",
                    isMediaFullscreen ? "fixed z-[1000]" : "absolute"
                  )}
                  onClick={handleToggleFullscreen}
                >
                  {isMediaFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              )}
            </div>
          )}
          {post.spotify_embed_url && (
            <div className="w-full aspect-video mb-4">
              <iframe
                src={post.spotify_embed_url}
                width="100%"
                height="100%"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-md"
              ></iframe>
            </div>
          )}
          <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4"> {/* Added mb-4 for spacing */}
            {post.message}
          </p>
          {post.coordinates && ( // Moved coordinates to the bottom
            <div className="w-full h-64 rounded-md overflow-hidden"> {/* Removed mb-4 */}
              <MapComponent coordinates={post.coordinates} zoom={12} className="h-full" />
            </div>
          )}
        </div>

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