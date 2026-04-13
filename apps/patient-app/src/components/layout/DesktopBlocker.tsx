'use client';

import React from 'react';
import { MonitorOff, Smartphone, Tablet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function DesktopBlocker() {
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in duration-500">
      <div className="max-w-md space-y-8">
        <div className="flex justify-center space-x-4 text-muted-foreground">
          <MonitorOff className="h-12 w-12 text-destructive animate-pulse" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Desktop Access Restricted</h1>
          <p className="text-muted-foreground text-lg">
            The Kloqo Nurse App is optimized exclusively for <strong>Mobile</strong> and <strong>Tablet</strong> devices to ensure the best clinic experience.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-xl space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <QRCodeSVG value={currentUrl} size={180} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Scan this QR code to continue on your mobile or tablet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex flex-col items-center space-y-2">
              <Smartphone className="h-6 w-6 text-primary" />
              <span className="text-xs font-semibold">Nurse Quick-Snap</span>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <Tablet className="h-6 w-6 text-primary" />
              <span className="text-xs font-semibold">Doctor Focus-Mode</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Please resize your browser or switch devices to proceed.
        </p>
      </div>
    </div>
  );
}
