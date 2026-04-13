'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  ShieldCheck, 
  Mail, 
  UserPlus, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Key
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { User } from '@kloqo/shared';

const MENU_PERMISSIONS = [
  { id: 'Dashboard', label: 'Dashboard & Metrics' },
  { id: 'Analytics', label: 'Advanced Analytics & Logs' },
  { id: 'Notifications', label: 'Notification Settings' },
  { id: 'Clinics', label: 'Clinic & Dept Management' },
  { id: 'Doctors', label: 'Doctor Directory' },
  { id: 'Patients', label: 'Patient Records' },
  { id: 'Staff', label: 'Staff & RBAC' },
  { id: 'Settings', label: 'System Global Settings' },
];

export default function StaffManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  // Form State
  const [newStaff, setNewStaff] = useState({ name: '', email: '', permissions: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const loadStaff = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/superadmin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      // Filter only SuperAdmin roles for this view
      const staffOnly = (Array.isArray(data) ? data : data.data || []).filter(
        (u: User) => u.role === 'superAdmin' || u.role === 'super-admin' || u.role === 'superadmin'
      );
      setUsers(staffOnly);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newStaff.permissions.length === 0) {
      return setError('Please select at least one permission module.');
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/superadmin/users/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newStaff.name,
          email: newStaff.email,
          accessibleMenus: newStaff.permissions
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invitation failed');
      }

      setIsInviteOpen(false);
      setNewStaff({ name: '', email: '', permissions: [] });
      loadStaff();
      alert('Invitation sent successfully! The staff member will receive an email with their temporary password.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePermission = (id: string) => {
    setNewStaff(prev => ({
      ...prev,
      permissions: prev.permissions.includes(id) 
        ? prev.permissions.filter(p => p !== id)
        : [...prev.permissions, id]
    }));
  };

  const filteredStaff = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground mt-1 text-lg">Invite and manage granular access for Super Admin staff.</p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-lg shadow-indigo-500/20">
              <UserPlus className="h-5 w-5 mr-2" />
              Invite New Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Invite Staff Member</DialogTitle>
              <DialogDescription>
                An invitation email will be sent with a 12-character temporary password. They will be forced to reset it on their first login.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-5 py-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input 
                    placeholder="Enter full name" 
                    value={newStaff.name}
                    onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input 
                    type="email" 
                    placeholder="staff@kloqo.com" 
                    value={newStaff.email}
                    onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Accessible Modules (RBAC)</label>
                <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/30">
                  {MENU_PERMISSIONS.map(perm => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={perm.id} 
                        checked={newStaff.permissions.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                      />
                      <label htmlFor={perm.id} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                        {perm.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full h-11" disabled={submitting}>
                  {submitting ? 'Sending Invitation...' : 'Send Secure Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-white border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search staff by name or email..." 
              className="pl-10 h-10 border-gray-200"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="text-muted-foreground animate-pulse">Loading staff records...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[250px]">Staff Member</TableHead>
                  <TableHead>Account Email</TableHead>
                  <TableHead>Role & Access</TableHead>
                  <TableHead>Password State</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground h-64">
                      <div className="flex flex-col items-center gap-2">
                        <ShieldCheck className="h-12 w-12 text-muted-foreground/30" />
                        <p>No Super Admin staff found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((u) => (
                    <TableRow key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm",
                            u.role === 'superAdmin' ? "bg-indigo-600" : "bg-cyan-600"
                          )}>
                            {(u.name || 'S').charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold">{u.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{u.role === 'superAdmin' ? 'Root Admin' : 'Staff Member'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {u.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                          {u.role === 'superAdmin' ? (
                            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Full System Access</Badge>
                          ) : (
                            u.accessibleMenus?.map(m => (
                              <Badge key={m} variant="secondary" className="bg-white border text-[10px] uppercase font-bold tracking-wider">
                                {m}
                              </Badge>
                            )) || <span className="text-xs text-red-400">No Access Modules</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.mustChangePassword ? (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200 animate-pulse">
                            <Key className="h-3 w-3 mr-1" />
                            Reset Required
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Secure
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4 h" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { cn } from '@/lib/utils';
