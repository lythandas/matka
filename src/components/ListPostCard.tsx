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
import PostMediaFrame, { MEDIA_FRAME_CLASS, MEDIA_FRAME_STYLE } from './PostMediaFrame';

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

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-lg shadow-md cursor-pointer group hover:ring-2 hover:ring-ring hover:shadow-neon transition-all duration-200",
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
        {mediaItems.length > 0 ? (
          <div className="mb-4">
            <PostMediaFrame media={mediaItems} alt={post.title || t('common.postImage')} />
          </div>
        ) : post.coordinates ? (
          <div className="mb-4">
            <div className={MEDIA_FRAME_CLASS} style={MEDIA_FRAME_STYLE}>
              <MapComponent coordinates={post.coordinates} className="h-full w-full" />
            </div>
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