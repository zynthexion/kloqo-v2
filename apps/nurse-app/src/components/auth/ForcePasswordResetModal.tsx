'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { Role, User as KloqoUser } from '@kloqo/shared';

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface ForcePasswordResetModalProps {
  isOpen: boolean;
  email: string;
  resetToken: string;
  onSuccess: (authData: { token: string; user: KloqoUser }) => void;
}

export function ForcePasswordResetModal({ isOpen, email, resetToken, onSuccess }: ForcePasswordResetModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: z.infer<typeof passwordSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/force-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          newPassword: values.password,
          resetToken
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update password');
      }

      toast({
        title: 'Success!',
        description: 'Your permanent password has been set.',
      });

      onSuccess(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Something went wrong while setting your password.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md bg-white border-0 rounded-[2.5rem] shadow-2xl p-0 overflow-hidden outline-none">
        {/* Progress Bar Overlay */}
        <div className="h-1 bg-slate-100 w-full overflow-hidden">
            <div className="h-full bg-theme-blue animate-[progress_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
        </div>

        <div className="p-8 md:p-12 space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-theme-blue/5 rounded-full flex items-center justify-center">
                    <ShieldCheck className="h-8 w-8 text-theme-blue" />
                </div>
                <div className="space-y-1">
                    <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">Security Upgrade Required</DialogTitle>
                    <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                        Identity: {email}<br />
                        Please set your permanent clinician credentials
                    </DialogDescription>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-5">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                    <FormLabel className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">New Secure Password</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-theme-blue text-slate-300">
                                                <Lock className="h-5 w-5" />
                                            </div>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                {...field}
                                                className="h-14 rounded-2xl pl-14 bg-slate-50 border-transparent focus:bg-white focus:border-theme-blue focus:ring-0 transition-all font-bold text-slate-800"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-black uppercase tracking-widest ml-1" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                    <FormLabel className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm Identity Key</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-theme-blue text-slate-300">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                {...field}
                                                className="h-14 rounded-2xl pl-14 bg-slate-50 border-transparent focus:bg-white focus:border-theme-blue focus:ring-0 transition-all font-bold text-slate-800"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-black uppercase tracking-widest ml-1" />
                                </FormItem>
                            )}
                        />
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full h-16 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-xl transition-all active:scale-[0.98]" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                             <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Upgrading Credentials...</>
                        ) : (
                            'Authorize & Enter'
                        )}
                    </Button>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
