"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EditPostDialog from './EditPostDialog';
import { Post, JourneyCollaborator } from '@/types';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';

interface PostActionsProps {
  post: Post;
  canEdit: boolean;
  canDelete: boolean;
  onPostUpdated: (updatedPost: Post) => void;
  onPostDeleted: (id: string, journeyId: string, postAuthorId: string, isDraft: boolean) => Promise<void>;
  journeyOwnerId: string;
  journeyCollaborators: JourneyCollaborator[];
  className?: string; // For positioning
}

const PostActions: React.FC<PostActionsProps> = ({
  post,
  canEdit,
  canDelete,
  onPostUpdated,
  onPostDeleted,
  journeyOwnerId,
  journeyCollaborators,
  className,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [isEditPostDialogOpen, setIsEditPostDialogOpen] = useState<boolean>(false);

  const handleDeleteClick = async () => {
    await onPostDeleted(post.id, post.journey_id, post.user_id, post.is_draft || false);
  };

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className={className}>
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); setIsEditPostDialogOpen(true); }}
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">{t('editPostDialog.editPost')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('editPostDialog.editPost')}</p>
          </TooltipContent>
        </Tooltip>
      )}
      {canDelete && (
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('common.delete')}</p>
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('adminPage.areYouSure')}</AlertDialogTitle>
              <AlertDialogDescription dangerouslySetInnerHTML={{
                __html: post.is_draft
                  ? t('indexPage.deleteDraftDescription', { draftTitle: post.title || post.message.substring(0, 50) + '...' })
                  : t('common.deletePostDescription')
              }} />
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}>
                {t('adminPage.continue')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canEdit && (
        <EditPostDialog
          isOpen={isEditPostDialogOpen}
          onClose={() => setIsEditPostDialogOpen(false)}
          post={post}
          onUpdate={onPostUpdated}
          journeyOwnerId={journeyOwnerId}
          journeyCollaborators={journeyCollaborators}
        />
      )}
    </div>
  );
};

export default PostActions;