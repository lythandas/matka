"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from '@/lib/utils'; // For combining class names

interface Post {
  id: string;
  title?: string;
  message: string;
  image_urls?: { small?: string; medium?: string; large?: string };
  spotify_embed_url?: string;
  coordinates?: { lat: number; lng: number };
  created_at: string;
}

interface GridPostCardProps {
  post: Post;
  onClick: () => void;
  className?: string;
}

const GridPostCard: React.FC<GridPostCardProps> = ({ post, onClick, className }) => {
  const imageUrl = post.image_urls?.medium || post.image_urls?.small || '/placeholder.svg';

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-lg shadow-md cursor-pointer group hover:ring-2 hover:ring-blue-500 transition-all duration-200",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <AspectRatio ratio={1 / 1}>
          <img
            src={imageUrl}
            alt={post.title || "Post image"}
            className="object-cover w-full h-full"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.svg';
              e.currentTarget.onerror = null;
            }}
          />
        </AspectRatio>
        {post.title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white text-sm font-semibold truncate">
            {post.title}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GridPostCard;