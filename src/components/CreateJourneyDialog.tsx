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
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { Switch } from "@/components/ui/switch"; // Import Switch

interface CreateJourneyDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateJourneyDialog: React.FC<CreateJourneyDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const [journeyName, setJourneyName] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(false); // New state for public toggle
  const [passphrase, setPassphrase] = useState<string>(''); // New state for passphrase
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const { createJourney } = useJourneys();

  const handleCreate = async () => {
    if (journeyName.trim()) {
      setIsCreating(true);
      const newJourney = await createJourney(journeyName.trim(), isPublic, passphrase.trim() || undefined); // Pass isPublic and passphrase
      setIsCreating(false);
      if (newJourney) {
        setJourneyName('');
        setIsPublic(false);
        setPassphrase('');
        onClose();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('createJourneyDialog.createNewJourney')}</DialogTitle>
          <DialogDescription>
            {t('createJourneyDialog.giveJourneyName')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              {t('createJourneyDialog.journeyName')}
            </Label>
            <Input
              id="name"
              value={journeyName}
              onChange={(e) => setJourneyName(e.target.value)}
              className="col-span-3"
              placeholder={t('createJourneyDialog.mySummerTrip')}
              disabled={isCreating}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="is-public" className="text-right">
              {t('manageJourneyDialog.public')}
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Switch
                id="is-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={isCreating}
              />
              <Label htmlFor="is-public">{t('manageJourneyDialog.makeJourneyPublic')}</Label>
            </div>
          </div>
          {isPublic && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="passphrase" className="text-right">
                {t('manageJourneyDialog.passphraseOptional')}
              </Label>
              <Input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="col-span-3"
                placeholder={t('manageJourneyDialog.passphrasePlaceholder')}
                disabled={isCreating}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!journeyName.trim() || isCreating} className="hover:ring-2 hover:ring-blue-500">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('createJourneyDialog.creating')}
              </>
            ) : (
              t('createJourneyDialog.createJourney')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateJourneyDialog;