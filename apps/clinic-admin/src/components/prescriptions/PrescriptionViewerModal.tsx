"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Download, 
  Loader2, 
  FileWarning, 
  ExternalLink,
  Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PrescriptionViewerModalProps {
  isOpen: boolean;
  prescriptionUrl: string | null;
  onClose: () => void;
}

export function PrescriptionViewerModal({
  isOpen,
  prescriptionUrl,
  onClose,
}: PrescriptionViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleDownload = () => {
    if (!prescriptionUrl) return;
    const link = document.createElement("a");
    link.href = prescriptionUrl;
    link.download = `prescription-${Date.now()}.jpg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden border-none bg-slate-900/95 backdrop-blur-xl shadow-2xl transition-all duration-300">
        <DialogHeader className="p-6 border-b border-white/10 flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Maximize2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">Prescription Viewer</DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Secure Document Access</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
              disabled={loading || error}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl h-10 px-4 text-xs font-black uppercase"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <DialogClose asChild>
              <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 relative bg-black/40 flex items-center justify-center p-4 md:p-8 overflow-hidden group">
          {prescriptionUrl ? (
            <div className="relative w-full h-full flex items-center justify-center animate-in fade-in zoom-in duration-300">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 transition-all">
                  <div className="relative h-16 w-16">
                     <div className="absolute inset-0 rounded-full border-4 border-slate-700/50" />
                     <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Decrypting Image...</p>
                </div>
              )}

              {error ? (
                <div className="flex flex-col items-center gap-4 text-slate-400 text-center max-w-sm px-6">
                  <div className="p-4 bg-red-500/10 rounded-full text-red-400 mb-2">
                    <FileWarning className="h-10 w-10" />
                  </div>
                  <h3 className="text-lg font-black text-slate-200 uppercase">Image Unavailable</h3>
                  <p className="text-xs font-medium leading-relaxed opacity-60">
                    The requested prescription image could not be loaded. This might be due to a network error or the file might have been moved.
                  </p>
                  <Button 
                    variant="link" 
                    className="text-blue-400 font-bold mt-2"
                    onClick={() => window.open(prescriptionUrl, '_blank')}
                  >
                    Open in Browser <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              ) : (
                <img 
                  src={prescriptionUrl} 
                  alt="Prescription" 
                  className={cn(
                    "max-w-full max-h-full object-contain shadow-2xl rounded-sm transition-all duration-700 select-none",
                    loading ? "opacity-0 scale-95 blur-sm" : "opacity-100 scale-100 blur-0"
                  )}
                  onLoad={() => setLoading(false)}
                  onError={() => { setLoading(false); setError(true); }}
                />
              )}
            </div>
          ) : (
            <div className="text-slate-500 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest opacity-40">Awaiting URL...</p>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-black/20 border-t border-white/5 shrink-0 flex items-center justify-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Kloqo Secure Document Delivery System • 256-bit Encryption</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
