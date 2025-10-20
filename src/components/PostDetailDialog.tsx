"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import MapComponent from './MapComponent';
import { showError } from '@/utils/toast';

interface Post {
  id: string;
  title?: string;
  message: string;
  image_urls?: { small?: string; medium?: string; large?: string };
  spotify_embed_url?: string;
  coordinates?: { lat: number; lng: number };
  created_at: string;
}

interface PostDetailDialogProps {
  post: Post | null;
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
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);

  if (!post) return null;

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalPosts - 1;

  const handleToggleFullscreen = () => {
    if (!document.fullscreenEnabled) {
      showError("Fullscreen mode is not supported by your browser.");
      return;
    }

    if (document.fullscreenElement === imageRef.current) {
      document.exitFullscreen();
    } else {
      imageRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        showError("Failed to enter full-screen mode.");
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsImageFullscreen(document.fullscreenElement === imageRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[950px] max-h-[98vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-0 relative">
          <DialogTitle>{post.title || "Post Details"}</DialogTitle>
          <DialogDescription>
            {format(new Date(post.created_at), 'PPP p')}
          </DialogDescription>
        </DialogHeader>
        <div className="relative p-6 pt-4">
          {post.image_urls?.large && (
            <div className="relative mb-4">
              <img
                ref={imageRef}
                src={post.image_urls.large}
                alt={post.title || "Post image"}
                className="w-full h-auto object-cover rounded-md"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg'; // Corrected path
                  e.currentTarget.onerror = null;
                  console.error(`Failed to load image: ${post.image_urls?.large}`);
                }}
              />
              {document.fullscreenEnabled && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute bottom-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                  onClick={handleToggleFullscreen}
                >
                  {isImageFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
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
          {post.coordinates && (
            <div className="w-full h-64 rounded-md overflow-hidden mb-4">
              <MapComponent coordinates={post.coordinates} zoom={12} className="h-full" />
            </div>
          )}
          <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {post.message}
          </p>
        </div>

        {/* Navigation Buttons */}
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