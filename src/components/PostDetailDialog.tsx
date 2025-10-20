"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Maximize, ChevronLeft, ChevronRight } from 'lucide-react'; // Added Maximize, ChevronLeft, ChevronRight icons
import { format } from 'date-fns';
import MapComponent from './MapComponent';

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
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);

  if (!post) return null;

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalPosts - 1;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[950px] max-h-[98vh] overflow-y-auto p-0"> {/* Increased max-width and max-height, removed default padding */}
          <DialogHeader className="p-6 pb-0 relative"> {/* Added padding back to header */}
            <DialogTitle>{post.title || "Post Details"}</DialogTitle>
            <DialogDescription>
              {format(new Date(post.created_at), 'PPP p')}
            </DialogDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 rounded-full hover:ring-2 hover:ring-blue-500"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="relative p-6 pt-4"> {/* Added padding back to content */}
            {post.image_urls?.large && (
              <div className="relative mb-4">
                <img
                  src={post.image_urls.large}
                  alt={post.title || "Post image"}
                  className="w-full h-auto object-cover rounded-md"
                  onError={(e) => {
                    e.currentTarget.src = '/public/placeholder.svg';
                    e.currentTarget.onerror = null;
                    console.error(`Failed to load image: ${post.image_urls?.large}`);
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute bottom-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500"
                  onClick={() => setShowFullscreenImage(true)}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
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
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-20 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {canGoNext && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-20 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500"
              onClick={onNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Dialog */}
      <Dialog open={showFullscreenImage} onOpenChange={setShowFullscreenImage}>
        <DialogContent className="max-w-screen-xl max-h-[98vh] w-full h-full p-0 flex items-center justify-center bg-black/90">
          <img
            src={post.image_urls?.large}
            alt={post.title || "Full screen image"}
            className="max-w-full max-h-full object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:text-gray-300 rounded-full hover:ring-2 hover:ring-blue-500"
            onClick={() => setShowFullscreenImage(false)}
          >
            <X className="h-6 w-6" />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostDetailDialog;