"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { Post } from '@/types';
import { Compass } from 'lucide-react'; // Import the Compass icon
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface GridPostCardProps {
  post: Post;
  onClick: () => void;
  className?: string;
}

const GridPostCard: React.FC<GridPostCardProps> = ({ post, onClick, className }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const firstMedia = post.media_items?.[0]; // Get the first media item
  const displayName = post.author_name || post.author_username;

  let mediaElement: React.ReactNode = null;

  if (firstMedia?.type === 'image') {
    mediaElement = (
      <img
        src={firstMedia.urls.medium || '/placeholder.svg'}
        alt={post.title || t('common.postImage')}
        className="object-cover w-full h-full"
        onError={(e) => {
          e.currentTarget.src = '/placeholder.svg';
          e.currentTarget.onerror = null;
        }}
      />
    );
  } else if (firstMedia?.type === 'video') {
    mediaElement = (
      <video
        src={firstMedia.url}
        controls={false} // No controls for grid card, maybe show play icon overlay
        muted
        loop
        className="object-cover w-full h-full"
      />
    );
  } else {
    // If no image/video, display the Matka compass logo and title
    mediaElement = (
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-100 dark:bg-gray-800 p-4 text-center">
        <Compass className="h-16 w-16 text-blue-600 dark:text-blue-400 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 line-clamp-3">
          {post.title || post.message.substring(0, 50) + (post.message.length > 50 ? '...' : '') || t('gridPostCard.untitledPost')}
        </h3>
      </div>
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