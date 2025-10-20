"use client";

import React, { useState } from 'react';
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

interface CreateJourneyDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateJourneyDialog: React.FC<CreateJourneyDialogProps> = ({ isOpen, onClose }) => {
  const [journeyName, setJourneyName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const { createJourney } = useJourneys();

  const handleCreate = async () => {
    if (journeyName.trim()) {
      setIsCreating(true);
      const newJourney = await createJourney(journeyName.trim());
      setIsCreating(false);
      if (newJourney) {
        setJourneyName('');
        onClose();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Journey</DialogTitle>
          <DialogDescription>
            Give your new journey a name. This will be a collection of your posts.
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
              disabled={isCreating}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!journeyName.trim() || isCreating} className="hover:ring-2 hover:ring-blue-500">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Journey'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateJourneyDialog;