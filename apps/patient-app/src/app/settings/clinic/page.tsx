'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Edit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import AppFrameLayout from '@/components/layout/AppFrameLayout';

import { apiRequest } from '@/lib/api-client';

export default function ClinicSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walkInTokenAllotment, setWalkInTokenAllotment] = useState(5);

  useEffect(() => {
    const fetchClinicSettings = async () => {
      if (!user?.clinicId) return;

      try {
      try {
        const data = await apiRequest<any>(
          `/appointments/dashboard?clinicId=${user.clinicId}&date=today`
        );
        setWalkInTokenAllotment(data.clinic?.walkInTokenAllotment || 5);
      } catch (error) {
        console.error('Error fetching clinic settings:', error);
      } finally {
        setLoading(false);
      }
      } catch (error) {
        console.error('Error fetching clinic settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClinicSettings();
  }, [user?.clinicId]);

  const handleSave = async () => {
    if (!user?.clinicId) return;

    setIsSubmitting(true);
    try {
      await apiRequest('/clinic/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clinicId: user.clinicId,
          walkInTokenAllotment
        })
      });

      toast({
        title: 'Settings Updated',
        description: 'Clinic settings have been saved successfully.',
      });
      setIsEditing(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
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
            <h1 className="text-xl font-bold">Clinic Settings</h1>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Token Allotment</CardTitle>
                  <CardDescription>Configure how walk-in tokens are distributed.</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="icon" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="allotment">Walk-in Token Allotment</Label>
                <Input
                  id="allotment"
                  type="number"
                  min="2"
                  value={walkInTokenAllotment}
                  onChange={(e) => setWalkInTokenAllotment(parseInt(e.target.value) || 2)}
                  disabled={!isEditing || isSubmitting}
                />
                <p className="text-sm text-slate-500">
                  Allot one walk-in token after every X online slots. For example, if set to 5, every 6th slot will be for a walk-in patient.
                </p>
              </div>
            </CardContent>
            {isEditing && (
              <CardFooter className="flex justify-end gap-2 border-t pt-4">
                <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Settings
                </Button>
              </CardFooter>
            )}
          </Card>
        </main>
      </div>
    </AppFrameLayout>
  );
}
