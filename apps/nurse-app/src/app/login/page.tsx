'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Logo } from '@/components/icons';
import { Label } from '@/components/ui/label';
import { ForcePasswordResetModal } from '@/components/auth/ForcePasswordResetModal';

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading, login, syncSession } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetData, setResetData] = useState<{ isOpen: boolean; email: string; resetToken: string }>({ 
    isOpen: false, 
    email: '', 
    resetToken: '' 
  });

  // Session Recovery
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password);
      
      // If server requires password update
      if (result?.status === 'requires_reset') {
        setResetData({ 
            isOpen: true, 
            email: result.email, 
            resetToken: result.resetToken 
        });
        setIsSubmitting(false);
        return;
      }

      toast({ title: 'Login Successful', description: 'Welcome to Kloqo Care' });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
      });
      setIsSubmitting(false);
    }
  }

  const handleResetSuccess = (authData: { token: string; user: any }) => {
    setResetData(prev => ({ ...prev, isOpen: false }));
    // Instant hydration - no second login needed!
    syncSession(authData.token, authData.user);
    toast({ title: 'Login Successful', description: 'Your credentials have been updated.' });
    router.push('/dashboard');
  };

  return (
    <AppFrameLayout showBottomNav={false} isFullScreen={true}>
      <div className="relative w-full h-screen flex items-center justify-center overflow-hidden font-sans select-none bg-[#020617]">
        
        {/* --- CLINICAL AURORA BACKGROUND (PURE CSS) --- */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Subtle Precision Grid */}
          <div className="absolute inset-0 opacity-[0.1]" 
               style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.1) 0.5px, transparent 0.5px)`, backgroundSize: '32px 32px' }} />
          
          {/* Noise/Grain Overlay */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

          {/* Glowing Clinical Blobs */}
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-theme-blue/30 blur-[140px] animate-pulse duration-[8s]" />
          <div className="absolute bottom-[-15%] right-[-5%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[130px] animate-pulse duration-[12s] delay-1000" />
          <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-cyan-400/10 blur-[100px] animate-pulse duration-[10s] delay-2000" />
          
          {/* Accent Lines */}
          <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-white/5 to-transparent" />
          <div className="absolute top-0 left-3/4 w-[1px] h-full bg-gradient-to-b from-transparent via-white/5 to-transparent" />
        </div>

        {/* --- MAIN LOGIN CONTAINER --- */}
        <div className="relative z-10 w-full h-full flex flex-col md:flex-row items-center justify-center p-6 md:p-16 lg:p-24 gap-12 lg:gap-24">
          
          {/* BRANDING PANEL (Tablet+) */}
          <div className="hidden md:flex flex-col flex-1 space-y-8 animate-in fade-in slide-in-from-left-10 duration-1000">
             <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tighter text-white">
                  Kloqo <span className="text-theme-blue">Care</span>
                </h1>
             </div>
             
             <div className="space-y-4">
                <h2 className="text-5xl lg:text-7xl font-black text-white leading-[0.9] tracking-tighter">
                  INTELLIGENT <br />
                  <span className="text-white/20">CLINICAL</span> <br />
                  CONTROL.
                </h2>
                <div className="h-1.5 w-24 bg-theme-blue rounded-full shadow-[0_0_20px_rgba(0,70,255,0.5)]" />
             </div>

             <p className="max-w-sm text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Precision identity management for the modern practitioner. One suite. Endless Care.
             </p>

             <div className="flex items-center gap-8 pt-8">
                <div className="w-[1px] h-10 bg-white/10" />
                <div className="flex flex-col">
                   <span className="text-2xl font-black text-white/90 tracking-tight">256-bit</span>
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1">Enterprise Grade Encryption</span>
                </div>
             </div>
          </div>

          {/* LOGIN CARD */}
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-10 md:p-14 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] ring-1 ring-slate-100">
              
              {/* Header */}
              <div className="text-center mb-10 md:text-left">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase mb-2">Practitioner Sign-In</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Authorized access only</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-5">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity Endpoint</Label>
                          <FormControl>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-theme-blue text-slate-300">
                                <Mail className="h-5 w-5" strokeWidth={2.5} />
                              </div>
                              <Input
                                placeholder="name@kloqo.care"
                                {...field}
                                className="h-16 rounded-2xl pl-14 bg-slate-50/50 border-2 border-slate-100/50 focus:bg-white focus:border-theme-blue focus:ring-0 transition-all font-bold text-slate-800 text-[15px] placeholder:text-slate-300 shadow-sm"
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-[10px] font-black uppercase tracking-widest ml-1 text-rose-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <div className="flex items-center justify-between ml-1">
                             <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Security Key</Label>
                             <button type="button" className="text-[10px] font-black text-theme-blue uppercase tracking-widest hover:opacity-70 transition-opacity">Reset</button>
                          </div>
                          <FormControl>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-theme-blue text-slate-300">
                                <Lock className="h-5 w-5" strokeWidth={2.5} />
                              </div>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                                className="h-16 rounded-2xl pl-14 bg-slate-50/50 border-2 border-slate-100/50 focus:bg-white focus:border-theme-blue focus:ring-0 transition-all font-bold text-slate-800 text-[15px] placeholder:text-slate-300 shadow-sm"
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-[10px] font-black uppercase tracking-widest ml-1 text-rose-500" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="group relative w-full h-16 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl transition-all active:scale-[0.98] overflow-hidden" 
                      disabled={isSubmitting}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-theme-blue/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="relative flex items-center justify-center font-black uppercase tracking-[0.2em] text-[13px]">
                        {isSubmitting ? (
                          <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Verifying</>
                        ) : (
                          'Initialize Session'
                        )}
                      </span>
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Status Footer */}
              <div className="mt-12 flex flex-col items-center gap-4 text-center">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Network Online</span>
                 </div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed opacity-80">
                    © 2026 Kloqo Technology Systems. <br />
                    v2.4.0 High-Availability Node
                 </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <ForcePasswordResetModal 
        isOpen={resetData.isOpen}
        email={resetData.email}
        resetToken={resetData.resetToken}
        onSuccess={handleResetSuccess}
      />
    </AppFrameLayout>
  );
}
