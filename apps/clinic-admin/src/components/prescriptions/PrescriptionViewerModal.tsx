"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2, ExternalLink, FileText } from "lucide-react";

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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|Android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (prescriptionUrl) setLoading(true);
  }, [prescriptionUrl]);

  const handleDownload = () => {
    if (!prescriptionUrl) return;
    const link = document.createElement("a");
    link.href = prescriptionUrl;
    link.download = `prescription-${Date.now()}.pdf`;
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
            <div className="h-10 w-10 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">Prescription</DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Clinical Document • PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!prescriptionUrl}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl h-10 px-4 text-xs font-black uppercase"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(prescriptionUrl ?? '', '_blank')}
              disabled={!prescriptionUrl}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl h-10 px-4 text-xs font-black uppercase"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
            <DialogClose asChild>
              <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 relative bg-black/40 flex items-center justify-center overflow-hidden">
          {!prescriptionUrl ? (
            <div className="flex flex-col items-center gap-4 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest opacity-40">Awaiting URL...</p>
            </div>
          ) : isMobile ? (
            /* Mobile: Safari blocks PDF iframes — offer tap-to-open */
            <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="h-24 w-24 rounded-full bg-teal-500/10 flex items-center justify-center">
                <FileText className="h-12 w-12 text-teal-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Prescription Ready</h3>
                <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest">
                  Tap below to view the full prescription with letterhead
                </p>
              </div>
              <a
                href={prescriptionUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 h-14 px-8 bg-teal-500 hover:bg-teal-400 text-white font-black rounded-2xl shadow-xl shadow-teal-500/30 transition-all active:scale-95"
              >
                <ExternalLink className="h-5 w-5" />
                Open PDF
              </a>
            </div>
          ) : (
            /* Desktop: inline PDF iframe */
            <div className="relative w-full h-full">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black/40">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-700/50" />
                    <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Loading Prescription...</p>
                </div>
              )}
              <iframe
                src={`${prescriptionUrl}#toolbar=0&view=FitH&scrollbar=0`}
                className="w-full h-full border-none"
                title="Prescription PDF"
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
              />
            </div>
          )}
        </div>

        <div className="p-4 bg-black/20 border-t border-white/5 shrink-0 flex items-center justify-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Kloqo Secure Document Delivery System • End-to-End Encrypted</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
