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
import { Loader2, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils'; // For combining class names

interface PassphraseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  journeyName: string;
  journeyOwner: string;
  onPassphraseSubmit: (passphrase: string) => void;
  isVerifying: boolean;
}

const PassphraseDialog: React.FC<PassphraseDialogProps> = ({
  isOpen,
  onClose,
  journeyName,
  journeyOwner,
  onPassphraseSubmit,
  isVerifying,
}) => {
  const { t } = useTranslation();
  const [passphraseInput, setPassphraseInput] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPassphraseSubmit(passphraseInput);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "sm:max-w-[425px] p-8 bg-card rounded-lg shadow-2xl w-full text-card-foreground shadow-neon-blue bg-gradient-blue-light",
          "flex flex-col items-center justify-center" // Center content vertically and horizontally
        )}
      >
        <DialogHeader className="text-center mb-6">
          <Compass className="h-12 w-12 mx-auto text-blue-600 dark:text-foreground mb-2" />
          <DialogTitle className="text-2xl font-bold">{t('passphraseDialog.accessJourneyTitle', { journeyName })}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {t('passphraseDialog.accessJourneyDescription', { journeyOwner })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4 w-full">
          <div className="grid gap-2">
            <Label htmlFor="passphrase">{t('common.password')}</Label>
            <Input
              id="passphrase"
              type="password"
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              placeholder={t('manageJourneyDialog.passphrasePlaceholder')}
              disabled={isVerifying}
              required
            />
          </div>
          <DialogFooter className="mt-2 w-full">
            <Button type="submit" disabled={!passphraseInput.trim() || isVerifying} className="w-full hover:ring-2 hover:ring-blue-500">
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('publicJourneyPage.verifying')}
                </>
              ) : (
                t('publicJourneyPage.accessJourney')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PassphraseDialog;