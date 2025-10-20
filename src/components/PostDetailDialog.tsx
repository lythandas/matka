"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';
import { format } from 'date-fns';
import MapComponent from './MapComponent';

interface Post {
  id: string;
  title?: string;
  message: string;
  image_url?: string;
  spotify_embed_url?: string;
  coordinates?: { lat: number; lng: number };
  created_at: string;
}

interface PostDetailDialogProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
}

const PostDetailDialog: React.FC<PostDetailDialogProps> = ({ post, isOpen, onClose }) => {
  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <DialogTitle className="pr-8">{post.title || "Post Details"}</DialogTitle>
          <DialogDescription>
            {format(new Date(post.created_at), 'PPP p')}
          </DialogDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {post.image_url && (
            <img
              src={post.image_url}
              alt={post.title || "Post image"}
              className="w-full h-auto object-cover rounded-md"
              onError={(e) => {
                e.currentTarget.src = '/public/placeholder.svg';
                e.currentTarget.onerror = null;
                console.error(`Failed to load image: ${post.image_url}`);
              }}
            />
          )}
          {post.spotify_embed_url && (
            <div className="w-full aspect-video">
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
            <div className="w-full h-64 rounded-md overflow-hidden">
              <MapComponent coordinates={post.coordinates} zoom={12} className="h-full" />
            </div>
          )}
          <p className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {post.message}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;