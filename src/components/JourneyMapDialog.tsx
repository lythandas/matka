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
import { Map as MapIcon, Loader2 } from 'lucide-react';
import L from 'leaflet'; // Import Leaflet
import { showError } from '@/utils/toast';
import { Post } from '@/types'; // Centralized Post interface

// Fix for default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface JourneyMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  onSelectPost: (post: Post, index: number) => void;
}

const JourneyMapDialog: React.FC<JourneyMapDialogProps> = ({ isOpen, onClose, posts, onSelectPost }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapLoading, setMapLoading] = useState<boolean>(true);

  const postsWithCoordinates = posts.filter(post => post.coordinates);

  useEffect(() => {
    console.log('JourneyMapDialog useEffect triggered. isOpen:', isOpen, 'mapContainerRef.current:', mapContainerRef.current, 'postsWithCoordinates.length:', postsWithCoordinates.length);

    const cleanupMap = () => {
      console.log('Cleaning up map...');
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      // Do not reset mapLoading here, it will be handled by the main effect logic
    };

    if (!isOpen) {
      cleanupMap();
      setMapLoading(true); // Reset loading state for next open
      return;
    }

    if (!mapContainerRef.current) {
      // If dialog is open but ref not yet attached, wait for next render
      setMapLoading(true); // Keep loading true while waiting for ref
      return;
    }

    if (!postsWithCoordinates.length) {
      cleanupMap();
      setMapLoading(false); // No posts to show, so not loading a map
      return;
    }

    // If we reach here, dialog is open, ref is attached, and there are posts.
    if (!mapRef.current) {
      console.log('Initializing new map...');
      setMapLoading(true); // Indicate loading has started
      mapRef.current = L.map(mapContainerRef.current, {
        center: [0, 0], // Will be adjusted by fitBounds
        zoom: 1, // Will be adjusted by fitBounds
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

      mapRef.current.on('error', (e: any) => {
        console.error('Leaflet Map Error:', e.error);
        showError('Failed to load map tiles.');
        setMapLoading(false);
      });

      addMarkersAndFitBounds(mapRef.current);
      mapRef.current.invalidateSize(); // Ensure map renders correctly after initialization
      setMapLoading(false); // Map setup complete
      console.log('Map initialized and loading set to false.');
    } else {
      console.log('Updating existing map...');
      // Map already exists, just update markers and bounds
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          layer.remove();
        }
      });
      addMarkersAndFitBounds(mapRef.current);
      mapRef.current.invalidateSize(); // Ensure map renders correctly after update
      setMapLoading(false); // Update complete
      console.log('Map updated and loading set to false.');
    }

    return cleanupMap;
  }, [isOpen, postsWithCoordinates]);

  const addMarkersAndFitBounds = (map: L.Map) => {
    if (!postsWithCoordinates.length) return;

    const markers: L.Marker[] = [];
    const latLngs: L.LatLngExpression[] = [];

    postsWithCoordinates.forEach((post, index) => {
      if (post.coordinates) {
        const latLng: L.LatLngExpression = [post.coordinates.lat, post.coordinates.lng];
        const marker = L.marker(latLng).addTo(map);

        marker.on('click', () => {
          onSelectPost(post, posts.indexOf(post));
        });

        markers.push(marker);
        latLngs.push(latLng);
      }
    });

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
    } else if (latLngs.length > 1) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
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
            <div ref={mapContainerRef} className="w-full h-full z-0" />
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