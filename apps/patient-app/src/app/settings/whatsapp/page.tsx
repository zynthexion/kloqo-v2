'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppFrameLayout from '@/components/layout/AppFrameLayout';

import { apiRequest } from '@/lib/api-client';

export default function WhatsappSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchClinicData = async () => {
      if (!user?.clinicId) return;

      try {
      try {
        const data = await apiRequest<any>(
          `/appointments/dashboard?clinicId=${user.clinicId}&date=today`
        );
        setShortCode(data.clinic?.shortCode || null);
      } catch (error) {
        console.error('Error fetching clinic data:', error);
      } finally {
        setLoading(false);
      }
      } catch (error) {
        console.error('Error fetching clinic data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClinicData();
  }, [user?.clinicId]);

  const handleGenerate = async () => {
    if (!user?.clinicId) return;

    setGenerating(true);
    try {
      const data = await apiRequest<any>('/clinic/whatsapp/generate-code', {
        method: 'POST',
        body: JSON.stringify({ clinicId: user.clinicId })
      });

      setShortCode(data.shortCode);
      toast({
        title: 'Code Generated',
        description: 'Clinic short code generated successfully!',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (shortCode) {
      navigator.clipboard.writeText(shortCode);
      setCopied(true);
      toast({
        title: 'Copied',
        description: 'Short code copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <AppFrameLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full bg-slate-50">
        <header className="flex items-center gap-4 p-4 border-b bg-white">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
            <ArrowLeft />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">WhatsApp Integration</h1>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Clinic Short Code
              </CardTitle>
              <CardDescription>
                This code allows patients to interact with your clinic via WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {shortCode ? (
                <div className="flex flex-col gap-4">
                  <div className="p-6 bg-slate-100 rounded-lg border flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Your Unique Code</span>
                    <div className="text-4xl font-black tracking-widest text-primary font-mono">
                      {shortCode}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copied ? 'Copied' : 'Copy Code'}
                    </Button>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 border border-blue-100">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Share this code with your patients.</li>
                      <li>Ask them to send <strong>{shortCode}</strong> to our WhatsApp number.</li>
                      <li>The chatbot will provide clinic details and booking options.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                  <div className="bg-amber-50 p-4 rounded-full">
                    <RefreshCw className="h-8 w-8 text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">No Short Code Assigned</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      Your clinic doesn't have a short code yet. Generate one now to enable WhatsApp features.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="min-w-[200px]"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Short Code'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </AppFrameLayout>
  );
}
