"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Map as MapIcon } from 'lucide-react';
import { Post } from '@/types';
import MapComponent from './MapComponent';
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface JourneyMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  onSelectPost: (post: Post, index: number) => void;
}

const JourneyMapDialog: React.FC<JourneyMapDialogProps> = ({ isOpen, onClose, posts, onSelectPost }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const postsWithCoordinates = posts.filter(post => post.coordinates);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] max-w-[98vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('journeyMapDialog.journeyMap')}</DialogTitle>
          <DialogDescription>
            {t('journeyMapDialog.explorePostLocations')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow relative rounded-md overflow-hidden">
          {postsWithCoordinates.length > 0 ? (
            <MapComponent
              posts={postsWithCoordinates}
              onMarkerClick={onSelectPost}
              className="w-full h-full"
              zoom={12}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-muted-foreground">
              <MapIcon className="h-12 w-12 mr-2" />
              <p className="text-lg">{t('journeyMapDialog.noPostsWithLocation')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JourneyMapDialog;