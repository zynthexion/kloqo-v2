'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
import { fetchDepartments, saveDepartment, deleteDepartment } from '@/lib/analytics';
import { Department } from '@kloqo/shared';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formVals, setFormVals] = useState<Omit<Department, 'id' | 'doctors' | 'isDeleted'> & { id?: string }>({
    name: '', name_ml: '', description: '', description_ml: '', icon: '', id: ''
  });
  const [saving, setSaving] = useState(false);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetchDepartments(page, limit);
      if (Array.isArray(res)) {
        setDepartments(res);
        setTotalCount(res.length);
      } else {
        setDepartments(res.data);
        setTotalCount(res.total);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, [page]);

  const totalPages = Math.ceil(totalCount / limit);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  const openAddDialog = () => {
    setSelectedDepartment(null);
    setFormVals({ name: '', name_ml: '', description: '', description_ml: '', icon: '', id: '' });
    setOpenEditModal(true);
  };

  const openEditDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setFormVals({ ...dept });
    setOpenEditModal(true);
  };

  const handleSoftDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
    try {
      await deleteDepartment(id);
      loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Failed to delete department.');
    }
  };

  const handleSave = async () => {
    const { name, name_ml, description, description_ml, icon } = formVals;
    if (!name || !name_ml || !description || !description_ml || !icon) {
      alert('All fields (both languages + icon) are required.');
      return;
    }
    setSaving(true);
    try {
      const departmentToSave: Department = {
        id: selectedDepartment?.id || '',
        name,
        name_ml,
        description,
        description_ml,
        icon,
        doctors: selectedDepartment?.doctors || []
      };
      await saveDepartment(departmentToSave);
      loadDepartments();
      setOpenEditModal(false);
      setSelectedDepartment(null);
    } catch (error) {
      console.error('Error saving department:', error);
      alert('Failed to save department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-muted-foreground mt-1">Manage medical departments and specialties</p>
        </div>
        <Button onClick={openAddDialog} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Specialties & Units</CardTitle>
            <CardDescription>Page {page} of {totalPages || 1} ({totalCount} total)</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 w-16">Icon</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Malayalam</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" /></td></tr>
                ) : departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No departments found</p>
                    </td>
                  </tr>
                ) : (
                  departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-2xl">{dept.icon}</td>
                      <td className="px-4 py-3 font-medium">{dept.name}</td>
                      <td className="px-4 py-3">{dept.name_ml}</td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-1 max-w-xs text-muted-foreground">{dept.description}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(dept)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleSoftDelete(dept.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-xs text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} departments
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

      <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>{selectedDepartment ? 'Edit Department' : 'Add Department'}</DialogTitle>
            <DialogDescription>
              Enter the department details in both English and Malayalam.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Name (English)</label>
                <Input placeholder="e.g. Cardiology" value={formVals.name} onChange={e => setFormVals(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Name (Malayalam)</label>
                <Input placeholder="ഹൃദ്രോഗവിഭാഗം" value={formVals.name_ml} onChange={e => setFormVals(f => ({ ...f, name_ml: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Description (English)</label>
              <Textarea placeholder="Department details..." value={formVals.description} onChange={e => setFormVals(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Description (Malayalam)</label>
              <Textarea placeholder="വിശദാംശങ്ങൾ..." value={formVals.description_ml} onChange={e => setFormVals(f => ({ ...f, description_ml: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Icon (Emoji or Lucas Icon Name)</label>
              <Input placeholder="e.g. ❤️ or Heart" value={formVals.icon} onChange={e => setFormVals(f => ({ ...f, icon: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Department'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
