'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { fetchSystemSettings, updateSystemSettings } from '@/lib/analytics';
import { Loader2, Save, MessageSquare, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isWhatsAppEnabled, setIsWhatsAppEnabled] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSystemSettings()
      .then(s => setIsWhatsAppEnabled(s.isWhatsAppEnabled))
      .catch(err => toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSystemSettings({ isWhatsAppEnabled });
      toast({ title: 'Success', description: 'Settings updated successfully' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">Manage global platform configurations and internal flags.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <CardTitle>Communication Settings</CardTitle>
            </div>
            <CardDescription>Configure how Kloqo communicates with patients and clinics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Global WhatsApp Messaging</Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, all WhatsApp notifications across all clinics are paused.
                </p>
              </div>
              <Switch 
                checked={isWhatsAppEnabled} 
                onCheckedChange={setIsWhatsAppEnabled}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              <CardTitle>Platform Security</CardTitle>
            </div>
            <CardDescription>Security policies and developer overrides.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
                Advanced security configurations are currently managed via the backend policy engine.
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
