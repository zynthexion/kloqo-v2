'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAllClinics, fetchAllPatients, fetchAllAppointments, calculateGrowthTrends, firestoreTimestampToDate, parseDateString } from '@/lib/analytics';
import { formatGrowthPercentage } from '@/lib/metrics';
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Users, Building2, Calendar } from 'lucide-react';
import type { Clinic, Patient, Appointment } from '@kloqo/shared';

export default function GrowthAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [growthData, setGrowthData] = useState<Array<{ date: string; count: number }>>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [clinicsData, patientsData, appointmentsData] = await Promise.all([
          fetchAllClinics(),
          fetchAllPatients(),
          fetchAllAppointments(),
        ]);

        const clinicsArr = Array.isArray(clinicsData) ? clinicsData : (clinicsData as any).data || [];
        const patientsArr = Array.isArray(patientsData) ? patientsData : (patientsData as any).data || [];
        const appointmentsArr = Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData as any).data || [];

        setClinics(clinicsArr);
        setPatients(patientsArr);
        setAppointments(appointmentsArr);

        // Calculate growth trends for last 90 days
        const trends = calculateGrowthTrends(appointmentsArr, 90);
        setGrowthData(trends);
      } catch (error) {
        console.error('Error loading growth data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate monthly stats
  const monthlyStats = (() => {
    const now = new Date();
    const months = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthAppointments = appointments.filter((apt: Appointment) => {
        let aptDate = firestoreTimestampToDate(apt.createdAt);
        if (!aptDate && apt.date) {
            aptDate = parseDateString(apt.date);
        }
        
        if (!aptDate) return false;
        return aptDate >= monthStart && aptDate <= monthEnd;
      });

      const monthPatients = patients.filter((patient: Patient) => {
        const createdDate = firestoreTimestampToDate(patient.createdAt);
        return createdDate && createdDate >= monthStart && createdDate <= monthEnd;
      });

      const monthClinics = clinics.filter((clinic: Clinic) => {
        const regDate = firestoreTimestampToDate(clinic.registrationDate);
        return regDate && regDate >= monthStart && regDate <= monthEnd;
      });

      months.push({
        month: format(monthDate, 'MMM yyyy'),
        appointments: monthAppointments.length,
        patients: monthPatients.length,
        clinics: monthClinics.length,
      });
    }
    
    return months;
  })();

  // Calculate growth percentages
  const currentMonth = monthlyStats[monthlyStats.length - 1];
  const previousMonth = monthlyStats[monthlyStats.length - 2];
  const patientGrowth = previousMonth ? formatGrowthPercentage(currentMonth.patients, previousMonth.patients) : '0%';
  const appointmentGrowth = previousMonth ? formatGrowthPercentage(currentMonth.appointments, previousMonth.appointments) : '0%';
  const clinicGrowth = previousMonth ? formatGrowthPercentage(currentMonth.clinics, previousMonth.clinics) : '0%';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading growth analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Growth Analytics</h1>
        <p className="text-muted-foreground mt-1">Patient and clinic growth trends</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Patients (This Month)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth.patients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {previousMonth && (
                <span className={currentMonth.patients >= previousMonth.patients ? 'text-green-600' : 'text-red-600'}>
                  {patientGrowth} from last month
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Clinics (This Month)</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth.clinics}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {previousMonth && (
                <span className={currentMonth.clinics >= previousMonth.clinics ? 'text-green-600' : 'text-red-600'}>
                  {clinicGrowth} from last month
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments (This Month)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth.appointments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {previousMonth && (
                <span className={currentMonth.appointments >= previousMonth.appointments ? 'text-green-600' : 'text-red-600'}>
                  {appointmentGrowth} from last month
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Growth Trends</CardTitle>
          <CardDescription>Last 6 months of growth</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="patients" fill="#8884d8" name="New Patients" />
              <Bar dataKey="appointments" fill="#82ca9d" name="Appointments" />
              <Bar dataKey="clinics" fill="#ffc658" name="New Clinics" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Appointment Trends (Last 90 Days) */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Appointment Trends</CardTitle>
          <CardDescription>Last 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growthData}>
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
                name="Appointments"
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Growth Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Growth Summary</CardTitle>
          <CardDescription>Detailed month-over-month metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Month</th>
                  <th className="text-right p-2">New Patients</th>
                  <th className="text-right p-2">New Clinics</th>
                  <th className="text-right p-2">Appointments</th>
                  <th className="text-right p-2">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((stat, index) => {
                  const prevStat = index > 0 ? monthlyStats[index - 1] : null;
                  const growth = prevStat ? formatGrowthPercentage(stat.appointments, prevStat.appointments) : '-';
                  
                  return (
                    <tr key={stat.month} className="border-b">
                      <td className="p-2 font-medium">{stat.month}</td>
                      <td className="text-right p-2">{stat.patients}</td>
                      <td className="text-right p-2">{stat.clinics}</td>
                      <td className="text-right p-2">{stat.appointments}</td>
                      <td className={`text-right p-2 ${growth.startsWith('+') ? 'text-green-600' : growth.startsWith('-') ? 'text-red-600' : ''}`}>
                        {growth}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
