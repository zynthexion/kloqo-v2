'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  fetchAllClinics, 
  updateClinicStatus, 
  deleteClinic,
  firestoreTimestampToDate 
} from '@/lib/analytics';
import { Building2, Search, CheckCircle, Clock, XCircle, Check, X, ArrowRight, Edit, Trash2, ChevronLeft, ChevronRight, Plus, VenetianMask } from 'lucide-react';
import type { Clinic } from '@kloqo/shared';
import { impersonateClinic } from '@/lib/api/superadmin';

// Simple toast implementation
const showToast = (title: string, description?: string, variant: 'default' | 'destructive' = 'default') => {
  alert(`${title}\n${description || ''}`);
};

export default function ClinicsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending' | 'rejected' | 'approved'>('all');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAllClinics(page, limit);
      
      if (Array.isArray(res)) {
        setClinics(res);
        setTotalCount(res.length);
      } else {
        setClinics(res.data);
        setTotalCount(res.total);
      }
    } catch (error) {
      console.error('Error loading clinics data:', error);
      showToast('Error', 'Failed to load clinics.', 'destructive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  // Handle pagination
  const totalPages = Math.ceil(totalCount / limit);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  // Filter clinics (client-side for the current page)
  const filteredClinics = clinics.filter((clinic) => {
    const matchesSearch =
      !searchTerm ||
      clinic.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.clinicRegNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && clinic.onboardingStatus === 'Completed' && clinic.registrationStatus === 'Approved') ||
      (filterStatus === 'pending' && clinic.registrationStatus === 'Pending') ||
      (filterStatus === 'approved' && clinic.registrationStatus === 'Approved') ||
      (filterStatus === 'rejected' && clinic.registrationStatus === 'Rejected');

    return matchesSearch && matchesFilter;
  });

  const getRegistrationStatusBadge = (status?: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'Pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const handleApprove = async (e: React.MouseEvent, clinic: Clinic) => {
    e.stopPropagation();
    setProcessingAction(clinic.id);
    try {
      await updateClinicStatus(clinic.id, 'Approved');
      loadData();
      showToast('Clinic Approved', `${clinic.name} has been approved.`);
    } catch (error) {
      showToast('Approval Failed', 'Failed to approve clinic.', 'destructive');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async (e: React.MouseEvent, clinic: Clinic) => {
    e.stopPropagation();
    setProcessingAction(clinic.id);
    try {
      await updateClinicStatus(clinic.id, 'Rejected');
      loadData();
      showToast('Clinic Rejected', `${clinic.name} has been rejected.`);
    } catch (error) {
      showToast('Rejection Failed', 'Failed to reject clinic.', 'destructive');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, clinic: Clinic) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${clinic.name}?`)) return;
    
    setProcessingAction(clinic.id);
    try {
      await deleteClinic(clinic.id);
      loadData();
      showToast('Clinic Deleted', `${clinic.name} has been soft deleted.`);
    } catch (error) {
      showToast('Delete Failed', 'Failed to delete clinic.', 'destructive');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleImpersonate = async (e: React.MouseEvent, clinic: Clinic) => {
    e.stopPropagation();
    if (!confirm(`Switch to God Mode for ${clinic.name}?`)) return;

    setProcessingAction(clinic.id);
    try {
      const token = await impersonateClinic(clinic.id);
      
      // Redirect with token in URL since Clinic Admin is on a different port (origin)
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3006';
      window.location.href = `${adminUrl}/dashboard?token=${token}`;
    } catch (error: any) {
      showToast('Error', error.message || 'Failed to switch context', 'destructive');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRowClick = (clinicId: string) => {
    router.push(`/dashboard/clinics/${clinicId}`);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Clinic Management</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage all clinics</p>
        </div>
        <Button onClick={() => router.push('/dashboard/clinics/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Clinic
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>All Clinics</CardTitle>
            <CardDescription>Page {page} of {totalPages || 1} ({totalCount} clinics total)</CardDescription>
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-md border border-input bg-background px-3 py-1 text-xs"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search currently loaded clinics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Clinic Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredClinics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No clinics found on this page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Clinic</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Onboarding</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredClinics.map((clinic) => (
                    <tr
                      key={clinic.id}
                      onClick={() => handleRowClick(clinic.id)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                            {clinic.logoUrl ? (
                              <img src={clinic.logoUrl} className="h-full w-full object-cover rounded" alt="" />
                            ) : (
                              <Building2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{clinic.name}</div>
                            <div className="text-[10px] text-muted-foreground">{clinic.ownerEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">{clinic.city || '-'}</div>
                        <div className="text-[10px] text-muted-foreground">{clinic.district || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {clinic.shortCode || '-'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {getRegistrationStatusBadge(clinic.registrationStatus)}
                      </td>
                      <td className="px-4 py-3">
                        {clinic.onboardingStatus === 'Completed' ? (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] uppercase font-bold">LIVE</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold">SETUP</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {clinic.registrationStatus === 'Pending' && (
                            <>
                              <Button
                                onClick={(e) => handleApprove(e, clinic)}
                                disabled={processingAction === clinic.id}
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                onClick={(e) => handleReject(e, clinic)}
                                disabled={processingAction === clinic.id}
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {clinic.registrationStatus === 'Approved' && (
                             <Button
                               onClick={(e) => handleImpersonate(e, clinic)}
                               disabled={processingAction === clinic.id}
                               size="icon"
                               variant="outline"
                               title="Impersonate (God Mode)"
                               className="h-7 w-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                             >
                                <VenetianMask className="h-3.5 w-3.5" />
                             </Button>
                          )}
                          <Button
                            onClick={() => router.push(`/dashboard/clinics/${clinic.id}/edit`)}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={(e) => handleDelete(e, clinic)}
                            disabled={processingAction === clinic.id}
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

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-xs text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} clinics
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
