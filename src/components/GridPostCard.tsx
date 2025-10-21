"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { Post } from '@/types';

interface GridPostCardProps {
  post: Post;
  onClick: () => void;
  className?: string;
}

// Removed STADIA_API_KEY as it's no longer used for static maps

const GridPostCard: React.FC<GridPostCardProps> = ({ post, onClick, className }) => {
  const media = post.image_urls;
  const displayName = post.author_name || post.author_username;

  let mediaElement: React.ReactNode = null;
  let fallbackImage = '/placeholder.svg';

  if (media?.type === 'image') {
    fallbackImage = media.urls.medium || '/placeholder.svg';
    mediaElement = (
      <img
        src={media.urls.medium || '/placeholder.svg'}
        alt={post.title || "Post image"}
        className="object-cover w-full h-full"
        onError={(e) => {
          e.currentTarget.src = '/placeholder.svg';
          e.currentTarget.onerror = null;
        }}
      />
    );
  } else if (media?.type === 'video') {
    mediaElement = (
      <video
        src={media.url}
        controls={false} // No controls for grid card, maybe show play icon overlay
        muted
        loop
        className="object-cover w-full h-full"
      />
    );
  } else {
    // If no image/video, and no Stadia Maps, fallback to generic placeholder
    mediaElement = (
      <img
        src={fallbackImage}
        alt="Placeholder"
        className="object-cover w-full h-full"
      />
    );
  }

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
          {mediaElement}
        </AspectRatio>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white text-sm font-semibold">
          {post.title && (
            <p className="truncate mb-1">{post.title}</p>
          )}
          <div className="flex items-center text-xs text-gray-300">
            <Avatar className="h-5 w-5 mr-2">
              {post.author_profile_image_url ? (
                <AvatarImage src={post.author_profile_image_url} alt={displayName} />
              ) : (
                <AvatarFallback className="bg-blue-500 text-white text-xs">
                  {getAvatarInitials(post.author_name, post.author_username)}
                </AvatarFallback>
              )}
            </Avatar>
            <span>{displayName}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GridPostCard;