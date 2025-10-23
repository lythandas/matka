"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, XCircle, Loader2 } from 'lucide-react'; // Import Loader2
import maplibregl from 'maplibre-gl';
import { showError } from '@/utils/toast';
import { Post } from '@/types'; // Centralized Post interface

interface JourneyMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  onSelectPost: (post: Post, index: number) => void;
}

const JourneyMapDialog: React.FC<JourneyMapDialogProps> = ({ isOpen, onClose, posts, onSelectPost }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoading, setMapLoading] = useState<boolean>(true); // New state for map loading

  const postsWithCoordinates = posts.filter(post => post.coordinates);

  useEffect(() => {
    const cleanupMap = () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapLoading(true); // Reset loading state on cleanup
    };

    if (!isOpen || !mapContainerRef.current || !postsWithCoordinates.length) {
      cleanupMap();
      return;
    }

    // If map is not initialized, create a new one
    if (!mapRef.current) {
      setMapLoading(true);
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://demotiles.maplibre.org/style.json', // Changed to a non-Stadia style
        center: [0, 0], // Will be adjusted by fitBounds
        zoom: 1, // Will be adjusted by fitBounds
      });

      mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      mapRef.current.on('load', () => {
        if (mapRef.current) {
          addMarkersAndFitBounds(mapRef.current);
          setMapLoading(false); // Map is loaded and markers added
        }
      });

      mapRef.current.on('error', (e) => {
        console.error('MapLibre GL Error:', e.error);
        showError('Failed to load map tiles.');
        setMapLoading(false);
      });

    } else {
      // If map exists, just update markers and bounds
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof maplibregl.Marker) {
          layer.remove();
        }
      });
      addMarkersAndFitBounds(mapRef.current);
      setMapLoading(false); // Assume loaded if updating existing map
    }

    return cleanupMap;
  }, [isOpen, postsWithCoordinates, mapContainerRef.current]);

  const addMarkersAndFitBounds = (map: maplibregl.Map) => {
    if (!postsWithCoordinates.length) return;

    const bounds = new maplibregl.LngLatBounds();

    postsWithCoordinates.forEach((post, index) => {
      if (post.coordinates) {
        const marker = new maplibregl.Marker()
          .setLngLat([post.coordinates.lng, post.coordinates.lat])
          .addTo(map);

        const markerElement = marker.getElement();
        markerElement.style.cursor = 'pointer';
        markerElement.addEventListener('click', () => {
          onSelectPost(post, posts.indexOf(post));
        });

        bounds.extend([post.coordinates.lng, post.coordinates.lat]);
      }
    });

    if (postsWithCoordinates.length === 1 && postsWithCoordinates[0].coordinates) {
      map.setCenter([postsWithCoordinates[0].coordinates.lng, postsWithCoordinates[0].coordinates.lat]);
      map.setZoom(12);
    } else if (postsWithCoordinates.length > 1) {
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
      });
    }
  };

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
          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-2 text-lg text-muted-foreground">Loading map...</p>
            </div>
          )}
          {postsWithCoordinates.length > 0 ? (
            <div ref={mapContainerRef} className="w-full h-full" />
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