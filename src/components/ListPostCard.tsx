"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { Post, JourneyCollaborator } from '@/types'; // Import JourneyCollaborator
import { format } from 'date-fns'; // Ensure format is imported
import { Compass } from 'lucide-react';
import MapComponent from './MapComponent';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import { cn } from '@/lib/utils'; // Import cn for class merging
import PostActions from './PostActions'; // Import PostActions

interface ListPostCardProps {
  post: Post;
  onClick: () => void;
  className?: string;
  id?: string; // Added id prop
  canEdit: boolean; // New prop
  canDelete: boolean; // New prop
  onPostUpdated: (updatedPost: Post) => void; // New prop
  onPostDeleted: (id: string, journeyId: string, postAuthorId: string, isDraft: boolean) => Promise<void>; // New prop
  journeyOwnerId: string; // New prop
  journeyCollaborators: JourneyCollaborator[]; // New prop
}

const ListPostCard: React.FC<ListPostCardProps> = ({
  post,
  onClick,
  className,
  id,
  canEdit,
  canDelete,
  onPostUpdated,
  onPostDeleted,
  journeyOwnerId,
  journeyCollaborators,
}) => {
  const { t } = useTranslation();
  const currentLocale = getDateFnsLocale();
  const displayName = post.author_name && post.author_surname ? `${post.author_name} ${post.author_surname}` : post.author_name || post.author_username;

  const mediaItems = post.media_items || [];
  const imageItems = mediaItems.filter(m => m.type === 'image');
  const videoItems = mediaItems.filter(m => m.type === 'video');
  const MAX_GALLERY = 7;
  const visibleImages = imageItems.slice(0, MAX_GALLERY);
  const remainingCount = imageItems.length - MAX_GALLERY;

  // Column count adapts to number of photos for a dynamic feel
  const galleryColumns = visibleImages.length <= 2 ? 2 : visibleImages.length <= 4 ? 2 : 3;

  const firstMedia = mediaItems[0];

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-lg shadow-md cursor-pointer group hover:ring-2 hover:ring-ring transition-all duration-200",
        className
      )}
      onClick={onClick}
      id={id} // Apply the id here
    >
      <CardContent className="p-6">
        <div className="absolute top-4 right-4 z-10 flex space-x-2">
          <PostActions
            post={post}
            canEdit={canEdit}
            canDelete={canDelete}
            onPostUpdated={onPostUpdated}
            onPostDeleted={onPostDeleted}
            journeyOwnerId={journeyOwnerId}
            journeyCollaborators={journeyCollaborators}
          />
        </div>
        <div className="flex items-center mb-4">
          {post.author_profile_image_url ? (
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src={post.author_profile_image_url} alt={displayName} />
            </Avatar>
          ) : (
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getAvatarInitials(post.author_name, post.author_username)}
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <p className="font-semibold text-foreground">
              {displayName}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(post.created_at), 'PPP p', { locale: currentLocale })}
            </p>
          </div>
        </div>
        {post.title && (
          <h3 className="text-xl font-bold mb-2 text-foreground">{post.title}</h3>
        )}
        {firstMedia ? (
          <div className="mb-4">
            {imageItems.length > 1 ? (
              <div
                className="rounded-md overflow-hidden gap-1"
                style={{ columnCount: galleryColumns, columnGap: '4px' }}
              >
                {visibleImages.map((media, idx) => {
                  const isLast = idx === visibleImages.length - 1;
                  return (
                    <div
                      key={idx}
                      className="relative break-inside-avoid mb-1 overflow-hidden rounded-sm"
                      style={{ marginBottom: idx < visibleImages.length - 1 ? '4px' : 0 }}
                    >
                      <img
                        src={media.urls.medium || '/placeholder.svg'}
                        alt={post.title || t('common.postImage')}
                        className="w-full h-auto block"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                          e.currentTarget.onerror = null;
                        }}
                      />
                      {isLast && remainingCount > 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white text-3xl font-bold">+{remainingCount}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : firstMedia.type === 'image' ? (
              <img
                src={firstMedia.urls.medium || '/placeholder.svg'}
                alt={post.title || t('common.postImage')}
                className="w-full h-auto rounded-md"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                  e.currentTarget.onerror = null;
                }}
              />
            ) : (
              <video
                src={firstMedia.url}
                controls
                className="w-full h-auto rounded-md"
              />
            )}
          </div>
        ) : post.coordinates ? (
          <div className="mb-4">
            <MapComponent coordinates={post.coordinates} className="h-48" />
          </div>
        ) : null}
        <p className="text-lg text-foreground whitespace-pre-wrap mb-4 text-justify">
          {post.message}
        </p>
      </CardContent>
    </Card>
  );
};

export default ListPostCard;