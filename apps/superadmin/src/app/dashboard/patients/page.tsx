'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { fetchAllPatients, fetchAllAppointments, fetchAllUsers, deletePatient, getPatientFirstBooking, getPatientLastActive, firestoreTimestampToDate, parseDateString, fetchDashboardData } from '@/lib/analytics';
import { calculate30DayRetention, calculateMAU } from '@/lib/metrics';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays, endOfDay, startOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Users, Activity, TrendingUp, Calendar, Search, MapPin, Smartphone, Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Patient, Appointment, User, SuperadminDashboardData } from '@kloqo/shared';

import { useRouter } from 'next/navigation';
import { Clock, CheckCircle, Timer } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Removed local parseDateString - using the one from @/lib/analytics

export default function PatientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dashboardData, setDashboardData] = useState<SuperadminDashboardData | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    mau: 0,
    dau: 0,
    retention30d: 0,
    retention90d: 0,
    avgAppointments: 0,
    newVsReturning: { new: 0, returning: 0 },
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const showToast = (title: string, description?: string, variant: 'default' | 'destructive' = 'default') => {
    alert(`${title}\n${description || ''}`);
  };

  const loadPatients = async () => {
    try {
      const res = await fetchAllPatients(page, limit);
      if (Array.isArray(res)) {
        setPatients(res);
        setTotalCount(res.length);
      } else {
        setPatients(res.data);
        setTotalCount(res.total);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [patientsRes, dashboardData, usersData] = await Promise.all([
          fetchAllPatients(page, limit),
          fetchDashboardData(
            dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
            dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
          ),
          fetchAllUsers(),
        ]);

        if (Array.isArray(patientsRes)) {
          setPatients(patientsRes);
          setTotalCount(patientsRes.length);
        } else {
          setPatients(patientsRes.data);
          setTotalCount(patientsRes.total);
        }
        
        setUsers(usersData as User[]);
        setDashboardData(dashboardData);

        if (dashboardData.patientsAnalytics) {
          const analytics = dashboardData.patientsAnalytics;
          setStats({
            total: dashboardData.metrics.totalPatients,
            mau: dashboardData.metrics.mau,
            dau: 0, // Still simplified
            retention30d: dashboardData.metrics.retention,
            retention90d: dashboardData.metrics.retention, // Using same for now
            avgAppointments: dashboardData.metrics.totalPatients > 0 ? dashboardData.metrics.totalAppointments / dashboardData.metrics.totalPatients : 0,
            newVsReturning: analytics.segmentation,
          });
        }
      } catch (error) {
        console.error('Error loading patient analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    // Refresh punctuality stats when date range changes
    const refreshAnalytics = async () => {
      if (loading) return;
      try {
        const data = await fetchDashboardData(
          dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
          dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
        );
        setDashboardData(data);
        if (data.patientsAnalytics) {
          setStats(prev => ({
            ...prev,
            newVsReturning: data.patientsAnalytics!.segmentation
          }));
        }
      } catch (error) {
        console.error('Error refreshing analytics:', error);
      }
    };
    refreshAnalytics();
  }, [dateRange]);

  useEffect(() => {
    if (!loading) loadPatients();
  }, [page]);

  const totalPages = Math.ceil(totalCount / limit);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  const handleDelete = async (patient: Patient) => {
    if (!confirm(`Are you sure you want to delete ${patient.name || 'this patient'}?`)) return;
    setProcessingAction(patient.id);
    try {
      await deletePatient(patient.id);
      loadPatients();
      showToast('Patient Deleted', `${patient.name} has been soft deleted.`);
    } catch (error) {
      showToast('Error', 'Failed to delete patient.', 'destructive');
    } finally {
      setProcessingAction(null);
    }
  };

  // Filter patients
  const filteredPatients = useMemo(() => {
    if (!searchTerm) return patients;

    const search = searchTerm.toLowerCase();
    return patients.filter(patient =>
      patient.name?.toLowerCase().includes(search) ||
      patient.phone?.toLowerCase().includes(search) ||
      patient.email?.toLowerCase().includes(search) ||
      patient.place?.toLowerCase().includes(search)
    );
  }, [patients, searchTerm]);

  // Calculate age group distribution
  const ageGroupData = dashboardData?.patientsAnalytics?.demographics?.ageGroups || [];

  // Calculate gender distribution
  const genderData = dashboardData?.patientsAnalytics?.demographics?.gender || [];

  // Calculate location distribution
  const locationData = useMemo(() => {
    const locations = new Map<string, number>();

    patients.forEach(patient => {
      const place = patient.place || 'Unknown';
      locations.set(place, (locations.get(place) || 0) + 1);
    });

    return Array.from(locations.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [patients]);

  // Calculate punctuality metrics based on selected date range
  const punctualityStats = dashboardData?.patientsAnalytics?.punctuality || {
    punctuality: 0,
    avgWait: 0,
    meetingEfficiency: 0,
    total: 0,
    punctualCount: 0,
    confirmedCount: 0,
    efficientCount: 0,
    completedCount: 0,
    waitCount: 0
  };

  // Calculate patient registration trends (last 30 days)
  const registrationTrends = dashboardData?.patientsAnalytics?.registrationTrends || [];

  // Calculate appointment frequency distribution
  const appointmentFrequency = (() => {
    const patientCounts = new Map<string, number>();
    appointments.forEach((apt: any) => {
      patientCounts.set(apt.patientId, (patientCounts.get(apt.patientId) || 0) + 1);
    });

    const frequency: Record<string, number> = {
      '1': 0,
      '2-3': 0,
      '4-5': 0,
      '6-10': 0,
      '11+': 0,
    };

    patientCounts.forEach((count) => {
      if (count === 1) frequency['1']++;
      else if (count >= 2 && count <= 3) frequency['2-3']++;
      else if (count >= 4 && count <= 5) frequency['4-5']++;
      else if (count >= 6 && count <= 10) frequency['6-10']++;
      else frequency['11+']++;
    });

    return Object.entries(frequency).map(([range, count]) => ({
      range,
      count,
    }));
  })();

  // Get appointment count for a patient
  const getPatientAppointmentCount = (patientId: string) => {
    // This now requires a separate call or specific metadata if we don't fetch all appointments
    // For now, returning 0 or placeholder since we want to avoid fetching all
    return 0; 
  };

  const getPatientPwaStatus = (patientId: string, patientPhone: string) => {
    // Try to find user by patientId link first
    let user = users.find(u => u.patientId === patientId);

    // If not found, try by phone number
    if (!user && patientPhone) {
      user = users.find(u => u.phone === patientPhone);
    }

    return user?.pwaInstalled || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading patient analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Patient Analytics</h1>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          Last updated: {format(new Date(), 'MMM d, h:mm a')}
        </Badge>
      </div>

      {/* Patient Punctuality & Wait Time Card */}
      <Card className="bg-slate-50/50 border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/50 border-b border-slate-100">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Patient Punctuality & Process Analytics
            </CardTitle>
            <CardDescription>Punctuality, wait times, and appointment completion efficiency</CardDescription>
          </div>
          <DateRangePicker 
            initialDateRange={dateRange}
            onDateChange={setDateRange}
          />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-blue-50 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Clock className="h-12 w-12 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-500 mb-1">Punctual Arrivals</span>
              <div className="text-3xl font-bold text-blue-700">{punctualityStats.punctuality.toFixed(1)}%</div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                {punctualityStats.punctualCount} / {punctualityStats.confirmedCount} appointments
              </p>
              <div className="w-full h-1.5 bg-blue-100 rounded-full mt-4">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                  style={{ width: `${punctualityStats.punctuality}%` }} 
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-emerald-50 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Timer className="h-12 w-12 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-slate-500 mb-1">Average Visit Time</span>
              <div className="text-3xl font-bold text-emerald-700">{punctualityStats.avgWait} <span className="text-sm font-normal">mins</span></div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Based on {punctualityStats.waitCount} completions
              </p>
              <div className="h-1.5 mt-4" /> {/* Placeholder for alignment */}
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-purple-50 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle className="h-12 w-12 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-slate-500 mb-1">Meeting Efficiency</span>
              <div className="text-3xl font-bold text-purple-700">{punctualityStats.meetingEfficiency.toFixed(1)}%</div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                {punctualityStats.efficientCount} / {punctualityStats.completedCount} on-time
              </p>
              <div className="w-full h-1.5 bg-purple-100 rounded-full mt-4">
                <div 
                  className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                  style={{ width: `${punctualityStats.meetingEfficiency}%` }} 
                />
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">Analysis based on {punctualityStats.total} validated appointments in the selected period.</p>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Active</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mau.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.mau / stats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Active</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dau.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">30-Day Retention</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.retention30d.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Return within 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Age Group Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Age Group Distribution</CardTitle>
            <CardDescription>Patient age demographics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ageGroupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" name="Patients" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
            <CardDescription>Patient gender demographics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Top Locations</CardTitle>
            <CardDescription>Patient location distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={locationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#82ca9d" name="Patients" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Other Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Patient Registration Trend</CardTitle>
            <CardDescription>New patients (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={registrationTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="New Patients"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appointment Frequency</CardTitle>
            <CardDescription>Distribution of appointments per patient</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={appointmentFrequency}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" name="Number of Patients" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Retention Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">30-Day Retention</span>
                <span className="text-lg font-semibold">{stats.retention30d.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">90-Day Retention</span>
                <span className="text-lg font-semibold">{stats.retention90d.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Average Appointments per Patient</span>
                <span className="text-lg font-semibold">{stats.avgAppointments.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient Segmentation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm">New Patients</span>
                  <span className="text-sm font-semibold">
                    {stats.newVsReturning.new} ({stats.total > 0 ? ((stats.newVsReturning.new / stats.total) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${stats.total > 0 ? (stats.newVsReturning.new / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm">Returning Patients</span>
                  <span className="text-sm font-semibold">
                    {stats.newVsReturning.returning} ({stats.total > 0 ? ((stats.newVsReturning.returning / stats.total) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${stats.total > 0 ? (stats.newVsReturning.returning / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patients Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Patients</CardTitle>
          <CardDescription>Complete list of all registered patients</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-medium">Name</th>
                  <th className="text-left p-3 text-sm font-medium">Age</th>
                  <th className="text-left p-3 text-sm font-medium">Gender</th>
                  <th className="text-left p-3 text-sm font-medium">Phone</th>
                  <th className="text-left p-3 text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <Smartphone className="h-4 w-4" />
                      PWA Installed?
                    </div>
                  </th>
                  <th className="text-left p-3 text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Location
                    </div>
                  </th>
                  <th className="text-left p-3 text-sm font-medium">Appointments</th>
                  <th className="text-left p-3 text-sm font-medium">Registered</th>
                  <th className="text-left p-3 text-sm font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      {searchTerm ? 'No patients found matching your search.' : 'No patients registered yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const createdDate = patient.createdAt ? firestoreTimestampToDate(patient.createdAt) : null;
                    const appointmentCount = getPatientAppointmentCount(patient.id);
                    const displayPhone = patient.communicationPhone || patient.phone;

                    return (
                      <tr
                        key={patient.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{patient.name || '(No Name)'}</span>
                            {patient.isLinkPending && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                Link Sent
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm">{patient.age || 'N/A'}</td>
                        <td className="p-3">
                          {patient.sex ? (
                            <Badge variant="outline">
                              {patient.sex}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not specified</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">{displayPhone || 'N/A'}</td>
                        <td className="p-3 text-sm">
                          {getPatientPwaStatus(patient.id, patient.phone) ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">No</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">{patient.place || 'Unknown'}</td>
                        <td className="p-3">
                          <Badge variant="secondary">{appointmentCount}</Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {createdDate ? format(createdDate, 'MMM d, yyyy') : 'N/A'}
                        </td>
                         <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => router.push(`/dashboard/patients/${patient.id}`)}
                              title="View Details"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(patient)}
                              disabled={processingAction === patient.id}
                              title="Delete Patient"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredPatients.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} patients
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
