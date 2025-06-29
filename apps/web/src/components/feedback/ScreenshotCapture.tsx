'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ScreenshotCaptureProps {
  onCapture: (screenshot: any) => void;
  onClose: () => void;
}

export default function ScreenshotCapture({ onCapture, onClose }: ScreenshotCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const captureScreenshot = async () => {
    setIsCapturing(true);
    try {
      // Check if screen capture API is available
      if ('mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' } as any,
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        // Wait for video to load
        await new Promise((resolve) => {
          video.onloadedmetadata = resolve;
        });

        // Create canvas and capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        // Stop the stream
        stream.getTracks().forEach((track) => track.stop());

        // Convert to base64
        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);
      } else {
        // Fallback for browsers that don't support screen capture
        alert('Screen capture is not supported in your browser. Please upload a screenshot instead.');
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      alert('Failed to capture screenshot. Please try uploading an image instead.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Add annotation
    const annotation = {
      x,
      y,
      width: 100,
      height: 50,
      text: 'Click to edit',
      color: '#ff0000',
    };

    setAnnotations([...annotations, annotation]);
  };

  const drawAnnotations = () => {
    if (!canvasRef.current || !capturedImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Draw annotations
      annotations.forEach((annotation) => {
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);

        if (annotation.text) {
          ctx.fillStyle = annotation.color;
          ctx.font = '14px Arial';
          ctx.fillText(annotation.text, annotation.x + 5, annotation.y - 5);
        }
      });
    };
    img.src = capturedImage;
  };

  useEffect(() => {
    drawAnnotations();
  }, [annotations, capturedImage]);

  const handleSave = () => {
    if (!canvasRef.current) return;

    const screenshot = {
      data: canvasRef.current.toDataURL('image/png'),
      annotations,
    };

    onCapture(screenshot);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Capture Screenshot</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!capturedImage ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                Capture your screen or upload an image
              </p>
              <div className="flex gap-4">
                <Button onClick={captureScreenshot} disabled={isCapturing}>
                  {isCapturing ? 'Capturing...' : 'Capture Screen'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="relative border rounded-lg overflow-auto max-h-[60vh]">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="cursor-crosshair"
                />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCapturedImage(null)}>
                  Retake
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Save Screenshot</Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Click on the image to add annotations
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}