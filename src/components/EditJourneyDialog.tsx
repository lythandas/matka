"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJourneys } from '@/contexts/JourneyContext';
import { Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { Journey } from '@/types'; // Centralized Journey interface

interface EditJourneyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  journey: Journey;
}

const EditJourneyDialog: React.FC<EditJourneyDialogProps> = ({ isOpen, onClose, journey }) => {
  const { token } = useAuth();
  const { fetchJourneys, setSelectedJourney } = useJourneys();
  const [journeyName, setJourneyName] = useState<string>(journey.name);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    setJourneyName(journey.name);
  }, [journey]);

  const handleUpdate = async () => {
    if (!journeyName.trim()) {
      showError('Journey name cannot be empty.');
      return;
    }
    if (!token) {
      showError('Authentication required to update a journey.');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: journeyName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update journey');
      }

      const updatedJourney: Journey = await response.json();
      showSuccess(`Journey '${updatedJourney.name}' updated successfully!`);
      await fetchJourneys(); // Re-fetch all journeys to update the list
      setSelectedJourney(updatedJourney); // Ensure the updated journey is selected
      onClose();
    } catch (error: any) {
      console.error('Error updating journey:', error);
      showError(error.message || 'Failed to update journey.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Journey</DialogTitle>
          <DialogDescription>
            Update the name of your journey.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={journeyName}
              onChange={(e) => setJourneyName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., My Summer Trip"
              disabled={isUpdating}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={!journeyName.trim() || isUpdating} className="hover:ring-2 hover:ring-blue-500">
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditJourneyDialog;