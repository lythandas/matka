"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';

interface TestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const TestDialog: React.FC<TestDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{t('testDialog.title')}</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            {t('testDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>{t('testDialog.message')}</p>
        </div>
        <Button onClick={onClose} className="mt-4 w-full">
          {t('common.close')}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default TestDialog;