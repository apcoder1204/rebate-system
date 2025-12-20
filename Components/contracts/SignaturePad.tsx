import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/Components/ui/button";
import { RotateCcw, Check, X } from "lucide-react";
import { useToast } from "@/Context/ToastContext";

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
}

export default function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const { showWarning } = useToast();
  const sigPadRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 200 });

  // Set canvas dimensions to match container on mount and resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Use actual pixel dimensions to ensure alignment
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        
        if (width > 0 && height > 0) {
          setCanvasSize({
            width: width,
            height: height,
          });
        }
      }
    };

    // Initial size after a short delay to ensure container is rendered
    const timer = setTimeout(updateCanvasSize, 10);

    // Use ResizeObserver for more accurate container size tracking
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateCanvasSize);
      resizeObserver.observe(containerRef.current);
    }

    // Fallback to window resize
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCanvasSize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  const handleClear = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      setIsEmpty(true);
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  const handleEnd = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      setIsEmpty(false);
    }
  };

  const handleSave = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataUrl = sigPadRef.current.toDataURL("image/png");
      onSave(dataUrl);
    } else {
      showWarning("Please provide your signature first");
    }
  };

  return (
    <div className="space-y-4">
      <div 
        ref={containerRef}
        className="border-2 border-slate-300 rounded-lg overflow-hidden bg-white"
        style={{ width: '100%', height: '200px', position: 'relative' }}
      >
        <SignatureCanvas
          ref={sigPadRef}
          canvasProps={{
            width: canvasSize.width,
            height: canvasSize.height,
            className: "signature-canvas cursor-crosshair",
            style: { 
              display: 'block',
              touchAction: 'none'
            }
          }}
          backgroundColor="#ffffff"
          onBegin={handleBegin}
          onEnd={handleEnd}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {isEmpty ? "Draw your signature above" : "Signature captured"}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            size="sm"
            disabled={isEmpty}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            size="sm"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isEmpty}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-blue-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Save Signature
          </Button>
        </div>
      </div>
      
      <style>{`
        .signature-canvas {
          touch-action: none;
        }
      `}</style>
    </div>
  );
}


