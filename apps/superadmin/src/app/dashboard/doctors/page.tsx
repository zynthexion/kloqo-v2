'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  fetchAllDoctors, 
  fetchAllClinics, 
  deleteDoctor 
} from '@/lib/analytics';
import { Users, Search, Edit, Trash2, ChevronLeft, ChevronRight, Plus, Stethoscope } from 'lucide-react';
import type { Clinic } from '@kloqo/shared';

// Simple toast implementation
const showToast = (title: string, description?: string, variant: 'default' | 'destructive' = 'default') => {
  alert(`${title}\n${description || ''}`);
};

interface Doctor {
  id: string;
  name: string;
  department?: string;
  clinicId?: string;
  status?: string;
}

export default function DoctorsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [doctorsRes, clinicsData] = await Promise.all([
        fetchAllDoctors(page, limit),
        fetchAllClinics() // Still need all clinics for mapping IDs to names efficiently
      ]);

      if (Array.isArray(doctorsRes)) {
        setDoctors(doctorsRes);
        setTotalCount(doctorsRes.length);
      } else {
        setDoctors(doctorsRes.data);
        setTotalCount(doctorsRes.total);
      }
      
      setClinics(Array.isArray(clinicsData) ? clinicsData : clinicsData.data);
    } catch (error) {
      console.error('Error loading doctors data:', error);
      showToast('Error', 'Failed to load doctors.', 'destructive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const totalPages = Math.ceil(totalCount / limit);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  const handleDelete = async (e: React.MouseEvent, doctor: Doctor) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete Dr. ${doctor.name}?`)) return;
    
    setProcessingAction(doctor.id);
    try {
      await deleteDoctor(doctor.id);
      loadData();
      showToast('Doctor Deleted', `Dr. ${doctor.name} has been soft deleted.`);
    } catch (error) {
      showToast('Delete Failed', 'Failed to delete doctor.', 'destructive');
    } finally {
      setProcessingAction(null);
    }
  };

  const getClinicName = (clinicId?: string): string => {
    if (!clinicId) return '-';
    const clinic = clinics.find(cl => cl.id === clinicId);
    return clinic ? clinic.name : '-';
  };

  const filteredDoctors = doctors.filter(doc => 
    !searchTerm || doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Doctor Management</h1>
          <p className="text-muted-foreground mt-1">Manage platform doctors and their assignments</p>
        </div>
        <Button onClick={() => router.push('/dashboard/doctors/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Doctor
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>All Doctors</CardTitle>
            <CardDescription>Page {page} of {totalPages || 1} ({totalCount} doctors total)</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search currently loaded doctors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No doctors found on this page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Doctor</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Clinic</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDoctors.map((doctor) => (
                    <tr
                      key={doctor.id}
                      onClick={() => router.push(`/dashboard/doctors/${doctor.id}`)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{doctor.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{doctor.department || 'General'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{getClinicName(doctor.clinicId)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={doctor.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                          {doctor.status || 'Active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            onClick={() => router.push(`/dashboard/doctors/${doctor.id}/edit`)}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={(e) => handleDelete(e, doctor)}
                            disabled={processingAction === doctor.id}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-xs text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} doctors
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center px-2 text-xs font-medium">
                Page {page} of {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={page >= totalPages || loading}
                className="h-8 px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
