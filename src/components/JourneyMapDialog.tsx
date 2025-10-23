"use client";

import React from 'react'; // Removed useState, useEffect, useRef
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Map as MapIcon } from 'lucide-react'; // Removed Loader2
import { Post } from '@/types'; // Centralized Post interface
import MapComponent from './MapComponent'; // Import the enhanced MapComponent

interface JourneyMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  onSelectPost: (post: Post, index: number) => void;
}

const JourneyMapDialog: React.FC<JourneyMapDialogProps> = ({ isOpen, onClose, posts, onSelectPost }) => {
  const postsWithCoordinates = posts.filter(post => post.coordinates);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] max-w-[98vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Journey Map</DialogTitle>
          <DialogDescription>
            Explore the locations of posts in this journey. Click a pin to view the post details.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow relative rounded-md overflow-hidden">
          {postsWithCoordinates.length > 0 ? (
            <MapComponent
              posts={postsWithCoordinates}
              onMarkerClick={onSelectPost}
              className="w-full h-full"
              zoom={12} // Default zoom when fitting bounds, can be adjusted
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-muted-foreground">
              <MapIcon className="h-12 w-12 mr-2" />
              <p className="text-lg">No posts with location data found in this journey.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JourneyMapDialog;