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
import { Map as MapIcon, XCircle } from 'lucide-react';
import MapComponent from './MapComponent';
import { Post } from '@/types';
import maplibregl from 'maplibre-gl';
import { showError } from '@/utils/toast';

interface JourneyMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  onSelectPost: (post: Post, index: number) => void;
}

const JourneyMapDialog: React.FC<JourneyMapDialogProps> = ({ isOpen, onClose, posts, onSelectPost }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapId] = useState(() => `journey-map-${Math.random().toString(36).substring(2, 9)}`);

  const postsWithCoordinates = posts.filter(post => post.coordinates);

  useEffect(() => {
    if (!isOpen || !postsWithCoordinates.length) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    if (mapRef.current) {
      // If map already exists, just update markers and fit bounds
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof maplibregl.Marker) {
          layer.remove();
        }
      });
      addMarkersAndFitBounds(mapRef.current);
      return;
    }

    if (!mapContainerRef.current) {
      showError("Map container not found for journey map.");
      return;
    }

    // Initialize map
    mapRef.current = new maplibregl.Map({
      container: mapId,
      style: 'https://tiles.stadiamaps.com/styles/outdoors.json',
      center: [0, 0], // Will be adjusted by fitBounds
      zoom: 1, // Will be adjusted by fitBounds
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapRef.current.on('load', () => {
      if (mapRef.current) {
        addMarkersAndFitBounds(mapRef.current);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, postsWithCoordinates, mapId]);

  const addMarkersAndFitBounds = (map: maplibregl.Map) => {
    if (!postsWithCoordinates.length) return;

    const bounds = new maplibregl.LngLatBounds();

    postsWithCoordinates.forEach((post, index) => {
      if (post.coordinates) {
        const marker = new maplibregl.Marker()
          .setLngLat([post.coordinates.lng, post.coordinates.lat])
          .addTo(map);

        // Create a custom element for the marker to add click listener
        const markerElement = marker.getElement();
        markerElement.style.cursor = 'pointer';
        markerElement.addEventListener('click', () => {
          onSelectPost(post, posts.indexOf(post)); // Pass original index
        });

        bounds.extend([post.coordinates.lng, post.coordinates.lat]);
      }
    });

    if (postsWithCoordinates.length === 1 && postsWithCoordinates[0].coordinates) {
      map.setCenter([postsWithCoordinates[0].coordinates.lng, postsWithCoordinates[0].coordinates.lat]);
      map.setZoom(12); // Default zoom for single marker
    } else if (postsWithCoordinates.length > 1) {
      map.fitBounds(bounds, {
        padding: 50, // Padding around the bounds
        maxZoom: 14, // Don't zoom in too much
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
          {postsWithCoordinates.length > 0 ? (
            <div ref={mapContainerRef} id={mapId} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-muted-foreground">
              <MapIcon className="h-12 w-12 mr-2" />
              <p className="text-lg">No posts with location data found in this journey.</p>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
        >
          <XCircle className="h-5 w-5" />
          <span className="sr-only">Close map</span>
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default JourneyMapDialog;