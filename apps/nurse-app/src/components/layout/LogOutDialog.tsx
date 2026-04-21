'use client';

import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface LogOutDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
}

export function LogOutDialog({ isOpen, setIsOpen, onLogout }: LogOutDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] rounded-[2rem] p-8 border-none shadow-2xl">
        <DialogHeader className="flex flex-col items-center gap-4 text-center">
          <div className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center shadow-inner">
            <LogOut className="h-10 w-10 text-rose-500" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            End Clinical Session?
          </DialogTitle>
          <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            You will need to re-authenticate to access patient records and fulfillment queues.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            className="w-full sm:flex-1 h-16 rounded-[2rem] font-black uppercase text-xs tracking-widest border-2 border-slate-100 hover:bg-slate-50 transition-all"
          >
            Stay Signed In
          </Button>
          <Button 
            variant="destructive" 
            onClick={onLogout}
            className="w-full sm:flex-1 h-16 rounded-[2rem] bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all"
          >
            Logout Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
