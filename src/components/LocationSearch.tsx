"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Search, MapPin, XCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import MapComponent from './MapComponent';
import { cn } from '@/lib/utils';

interface LocationSearchProps {
  onSelectLocation: (coords: { lat: number; lng: number } | null) => void;
  currentCoordinates: { lat: number; lng: number } | null;
  disabled?: boolean;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

const LocationSearch: React.FC<LocationSearchProps> = ({
  onSelectLocation,
  currentCoordinates,
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState<NominatimResult | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (searchTerm.length < 3) {
      setSearchResults([]);
      setSelectedSearchResult(null);
      return;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const response = await fetch(
          `${NOMINATIM_API_URL}?q=${encodeURIComponent(searchTerm)}&format=json&limit=5`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch search results from OpenStreetMap.');
        }
        const data: NominatimResult[] = await response.json();
        setSearchResults(data);
        if (data.length === 0) {
          showError('No results found for your search.');
        }
      } catch (error: any) {
        console.error('Location search error:', error);
        showError(error.message || 'Failed to search for locations.');
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 500); // Debounce for 500ms

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const handleSelectResult = (result: NominatimResult) => {
    setSelectedSearchResult(result);
    onSelectLocation({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setSearchResults([]); // Clear search results after selection
    setSearchTerm(result.display_name); // Set search term to display name
    showSuccess(`Location selected: ${result.display_name}`);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedSearchResult(null);
    onSelectLocation(null);
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="location-search">Search for a Location</Label>
      <div className="flex items-center space-x-2">
        <Input
          id="location-search"
          placeholder="Search for an address or place..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
          className="flex-grow"
        />
        {searchTerm && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClearSearch}
            disabled={disabled}
            className="hover:ring-2 hover:ring-blue-500 ring-inset"
          >
            <XCircle className="h-4 w-4 text-red-500" />
          </Button>
        )}
      </div>

      {loadingSearch && (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="border rounded-md max-h-48 overflow-y-auto">
          {searchResults.map((result) => (
            <div
              key={result.lat + result.lon + result.display_name}
              className={cn(
                "p-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                selectedSearchResult?.lat === result.lat && selectedSearchResult?.lon === result.lon && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleSelectResult(result)}
            >
              {result.display_name}
            </div>
          ))}
        </div>
      )}

      {currentCoordinates && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
            Selected: Lat: {currentCoordinates.lat.toFixed(4)}, Lng: {currentCoordinates.lng.toFixed(4)}
          </p>
          <MapComponent coordinates={currentCoordinates} className="h-48" />
        </div>
      )}
    </div>
  );
};

export default LocationSearch;