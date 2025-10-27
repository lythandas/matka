"use client";

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Area, Point } from 'react-easy-crop/src/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from 'lucide-react';
import { getCroppedImg } from '@/utils/image-crop';
import { showError } from '@/utils/toast';
import { useTranslation } from 'react-i18next';

interface ImageCropperProps {
  isOpen: boolean;
  imageSrc: string; // The image URL to be cropped
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ isOpen, imageSrc, onClose, onCropComplete }) => {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((crop: Point) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number[]) => {
    setZoom(zoom[0]);
  }, []);

  const onCropCompleteCallback = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!croppedAreaPixels) {
      showError(t('imageCropper.noCropSelected'));
      return;
    }
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedBlob) {
        onCropComplete(croppedBlob);
        onClose();
      } else {
        showError(t('imageCropper.failedToCropImage'));
      }
    } catch (e) {
      console.error(e);
      showError(t('imageCropper.errorCroppingImage'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] flex flex-col h-[550px]">
        <DialogHeader>
          <DialogTitle>{t('imageCropper.cropProfilePicture')}</DialogTitle>
          <DialogDescription>
            {t('imageCropper.adjustImageInstructions')}
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full flex-grow bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1 / 1} // Square aspect ratio for profile pictures
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="round" // Make it round for avatar-like preview
            showGrid={true}
            classes={{
              containerClassName: 'w-full h-full',
              mediaClassName: 'object-contain',
            }}
          />
        </div>
        <div className="flex items-center space-x-4 py-2">
          <span className="text-sm text-muted-foreground">{t('imageCropper.zoom')}</span>
          <Slider
            value={[zoom]}
            onValueChange={onZoomChange}
            min={1}
            max={3}
            step={0.1}
            className="flex-grow"
            disabled={isProcessing}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleApplyCrop} disabled={isProcessing} className="hover:ring-2 hover:ring-blue-500">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('imageCropper.applying')}
              </>
            ) : (
              t('imageCropper.apply')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;