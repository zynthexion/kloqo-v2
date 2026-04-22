'use client';

import React from 'react';
import { MonitorOff, Smartphone, Tablet, ShieldAlert, RefreshCw } from 'lucide-react';
import { Role } from '@kloqo/shared';

interface DeviceRestrictionBlockerProps {
  activeRole: Role;
  currentWidth: number;
  availableRoles?: Role[];
  onSwitchRole?: (role: Role) => void;
}

export function DeviceRestrictionBlocker({ 
  activeRole, 
  currentWidth, 
  availableRoles = [], 
  onSwitchRole 
}: DeviceRestrictionBlockerProps) {
  const getRequiredDevice = (role: Role) => {
    switch (role) {
      case 'doctor': return 'Desktop or Tablet';
      case 'receptionist': return 'Mobile Phone';
      case 'nurse': return 'Desktop, Tablet, or Mobile';
      default: return 'Authorized Hardware';
    }
  };

  const getDeviceIcon = (role: Role) => {
    switch (role) {
      case 'doctor': return <Tablet className="h-10 w-10 text-primary" />;
      case 'receptionist': return <Smartphone className="h-10 w-10 text-primary" />;
      default: return <Smartphone className="h-10 w-10 text-primary" />;
    }
  };

  const hasMultipleRoles = availableRoles.length > 1;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in duration-500">
      <div className="max-w-md w-full space-y-8">
        <div className="relative flex justify-center">
          <div className="absolute -top-4 -right-4">
            <ShieldAlert className="h-8 w-8 text-destructive animate-bounce" />
          </div>
          <MonitorOff className="h-20 w-20 text-muted-foreground/40" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Hardware Restriction</h1>
          <div className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-sm font-medium">
            <span className="text-muted-foreground mr-2 text-xs uppercase tracking-wider font-semibold">Viewing as:</span>
            <span className="text-foreground capitalize">{activeRole}</span>
          </div>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Safety protocol active. This role is strictly bound to <strong>{getRequiredDevice(activeRole)}</strong> to enforce clinic workflow standards.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-destructive/50" />
          
          <div className="flex flex-col items-center space-y-6">
            <div className="rounded-2xl bg-muted/30 p-6 ring-1 ring-border">
              {getDeviceIcon(activeRole)}
            </div>
            
            <div className="space-y-2">
              <p className="font-semibold text-lg">Action Required</p>
              <p className="text-sm text-muted-foreground px-4">
                Please switch to the approved hardware or rotate your device to a supported orientation.
              </p>
            </div>
          </div>

          {/* 🚀 THE ESCAPE HATCH FOR HYBRID STAFF */}
          {hasMultipleRoles && onSwitchRole && (
            <div className="mt-6 pt-6 border-t space-y-3">
               <p className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
                  Hold multiple roles?
               </p>
               <div className="flex flex-wrap justify-center gap-2">
                  {availableRoles.filter(r => r !== activeRole).map(role => (
                    <button
                      key={role}
                      onClick={() => onSwitchRole(role)}
                      className="px-4 py-2 text-sm font-medium transition-all border rounded-lg hover:bg-primary hover:text-primary-foreground hover:border-primary capitalize shadow-sm flex items-center gap-2"
                    >
                      Switch to {role}
                    </button>
                  ))}
               </div>
            </div>
          )}

          <div className="pt-6 border-t font-mono text-[10px] text-muted-foreground/60 flex justify-between px-2">
            <span>BROWSER_WIDTH: {currentWidth}px</span>
            <span>SEC_POLICY: HARDWARE_BONDED_RBAC</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground animate-pulse">
          Your session is secure, but display is disabled until hardware matches role.
        </p>
      </div>
    </div>
  );
}
