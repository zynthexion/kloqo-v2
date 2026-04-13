'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, CheckCircle2, UserPlus, Search, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

import { apiRequest } from '@/lib/api-client';

export default function WalkInPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    patientName: '',
    age: '',
    place: '',
    sex: 'Male'
  });

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!user?.clinicId) return;
      try {
        const dashData = await apiRequest<any>(
          `/appointments/dashboard?clinicId=${user.clinicId}&date=${new Date().toISOString()}`
        );
        setDoctors(dashData.doctors);
        if (dashData.doctors.length > 0) setSelectedDoctorId(dashData.doctors[0].id);
      } catch (error) {
        console.error('Error fetching doctors:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [user]);

  const handleSearch = async () => {
    if (phone.length < 10) return;
    setSearching(true);
    try {
      const data = await apiRequest<any[]>(`/superadmin/patients?phone=+91${phone}`);
      if (data.length > 0) {
        const p = data[0];
        setPatientData(p);
        setFormData({
          patientName: p.name,
          age: p.age?.toString() || '',
          place: p.place || '',
          sex: p.sex || 'Male'
        });
      } else {
        setPatientData(null);
        setFormData({ patientName: '', age: '', place: '', sex: 'Male' });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !formData.patientName) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all required fields.' });
      return;
    }

    setSubmitting(true);
    try {
      const apt = await apiRequest<any>('/appointments/walk-in', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age),
          phone: phone,
          doctorId: selectedDoctorId,
          clinicId: user?.clinicId,
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        })
      });

      toast({ title: 'Success', description: `Walk-in registered! Token: ${apt.tokenNumber}` });
      router.push('/dashboard');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border border-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-black text-gray-900">Walk-in Registration</h1>
        </header>

        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-blue-600 text-white p-6">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-6 w-6" /> New Token Generation
            </CardTitle>
            <CardDescription className="text-blue-100">Enter patient details to allot a token immediately.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Step 1: Doctor Selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Select Doctor</label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="h-12 text-lg font-semibold bg-gray-50 border-gray-100">
                  <SelectValue placeholder="Select Doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id} className="text-lg">
                      Dr. {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Patient Search */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Phone Number (Optional)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input 
                    placeholder="10 digit number" 
                    className="h-12 pl-10 text-lg bg-gray-50 border-gray-100" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={phone.length < 10 || searching}
                  className="h-12 px-6 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
                  variant="outline"
                >
                  {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>
              {patientData && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 px-3 py-1">
                  Existing Patient Found: {patientData.name}
                </Badge>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* Step 3: Form */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Patient Name *</label>
                <Input 
                  required
                  placeholder="Full Name" 
                  className="h-12 text-lg bg-gray-50 border-gray-100"
                  value={formData.patientName}
                  onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Age *</label>
                <Input 
                  required
                  type="number"
                  placeholder="Years" 
                  className="h-12 text-lg bg-gray-50 border-gray-100"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Sex *</label>
                <Select value={formData.sex} onValueChange={(val) => setFormData({...formData, sex: val as any})}>
                  <SelectTrigger className="h-12 text-lg font-semibold bg-gray-50 border-gray-100">
                    <SelectValue placeholder="Select Sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male" className="text-lg">Male</SelectItem>
                    <SelectItem value="Female" className="text-lg">Female</SelectItem>
                    <SelectItem value="Other" className="text-lg">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Place</label>
                <Input 
                  placeholder="City/Area" 
                  className="h-12 text-lg bg-gray-50 border-gray-100"
                  value={formData.place}
                  onChange={(e) => setFormData({...formData, place: e.target.value})}
                />
              </div>

              <Button 
                type="submit" 
                disabled={submitting}
                className="md:col-span-2 h-14 text-xl font-black bg-blue-600 hover:bg-blue-700 mt-4 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" /> GENERATING...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-6 w-6" /> GENERATE TOKEN
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
