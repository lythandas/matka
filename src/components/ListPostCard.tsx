"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { Post } from '@/types';
import { format } from 'date-fns'; // Ensure format is imported
import { Compass } from 'lucide-react';
import MapComponent from './MapComponent';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';

interface ListPostCardProps {
  post: Post;
  onClick: () => void;
}

const ListPostCard: React.FC<ListPostCardProps> = ({ post, onClick }) => {
  const { t } = useTranslation();
  const currentLocale = getDateFnsLocale();
  const displayName = post.author_name && post.author_surname ? `${post.author_name} ${post.author_surname}` : post.author_name || post.author_username;
  const firstMedia = post.media_items?.[0];

  return (
    <Card
      className="relative overflow-hidden rounded-lg shadow-md cursor-pointer group hover:ring-2 hover:ring-blue-500 transition-all duration-200"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          {post.author_profile_image_url ? (
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src={post.author_profile_image_url} alt={displayName} />
            </Avatar>
          ) : (
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback className="bg-blue-500 text-white text-lg">
                {getAvatarInitials(post.author_name, post.author_username)}
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {displayName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {format(new Date(post.created_at), 'PPP p', { locale: currentLocale })}
            </p>
          </div>
        </div>
        {post.title && (
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">{post.title}</h3>
        )}
        {firstMedia && (
          <div className="mb-4">
            {firstMedia.type === 'image' ? (
              <img
                src={firstMedia.urls.medium || '/placeholder.svg'}
                alt={post.title || t('common.postImage')}
                className="w-full h-auto max-h-96 object-cover rounded-md"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                  e.currentTarget.onerror = null;
                }}
              />
            ) : (
              <video
                src={firstMedia.url}
                controls
                className="w-full h-auto max-h-96 object-cover rounded-md"
              />
            )}
          </div>
        )}
        <p className="text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4 text-justify">
          {post.message}
        </p>
        {post.coordinates && (
          <div className="mt-4">
            <MapComponent coordinates={post.coordinates} className="h-48" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ListPostCard;