"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // Import DialogDescription
} from "@/components/ui/dialog";
import CreatePostFormContent from './CreatePostFormContent';
import { Journey, User, Post, JourneyCollaborator } from '@/types';
import { useTranslation } from 'react-i18next';

interface CreatePostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJourney: Journey | null;
  user: User | null;
  token: string | null;
  journeyCollaborators: JourneyCollaborator[];
  onPostCreated: (newPost: Post) => void;
  onDraftSaved: () => void;
  fetchDrafts: (journeyId: string) => Promise<void>;
  fetchPosts: (journeyId: string) => Promise<void>;
}

const CreatePostDialog: React.FC<CreatePostDialogProps> = ({
  isOpen,
  onClose,
  selectedJourney,
  user,
  token,
  journeyCollaborators,
  onPostCreated,
  onDraftSaved,
  fetchDrafts,
  fetchPosts,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('indexPage.createNewPost')}</DialogTitle>
          <DialogDescription>
            {t('createPostDialog.description')} {/* Added DialogDescription */}
          </DialogDescription>
        </DialogHeader>
        <CreatePostFormContent
          selectedJourney={selectedJourney}
          user={user}
          token={token}
          journeyCollaborators={journeyCollaborators}
          onPostCreated={onPostCreated}
          onDraftSaved={onDraftSaved}
          fetchDrafts={fetchDrafts}
          fetchPosts={fetchPosts}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;