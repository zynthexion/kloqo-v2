'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import { DollarSign, TrendingUp, Users, Building2, ArrowUpRight } from 'lucide-react';

export function OverviewTab({ metrics, appointments }: any) {
  return (
    <div className="space-y-8 animate-in fade-in transition-all duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MRR Card */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all border-none shadow-sm bg-gradient-to-br from-blue-500 to-blue-600">
          <CardHeader className="pb-2">
            <p className="text-blue-100 text-sm font-medium">Monthly Recurring Revenue</p>
            <CardTitle className="text-3xl font-bold text-white tracking-tighter">₹{metrics.mrr.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-blue-100 text-xs">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              <span>Incl. Ads & Passport Streams</span>
            </div>
          </CardContent>
          <DollarSign className="absolute -right-2 -bottom-2 h-24 w-24 text-white/10" />
        </Card>

        {/* ARR Card */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all border-none shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600">
          <CardHeader className="pb-2">
            <p className="text-emerald-100 text-sm font-medium">Annual Revenue Runrate</p>
            <CardTitle className="text-3xl font-bold text-white tracking-tighter">₹{metrics.arr.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-emerald-100 text-xs">Projected current scale x12</div>
          </CardContent>
          <TrendingUp className="absolute -right-2 -bottom-2 h-24 w-24 text-white/10" />
        </Card>

        {/* GMV Card */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all border-none shadow-sm bg-gradient-to-br from-purple-500 to-purple-600">
          <CardHeader className="pb-2">
            <p className="text-purple-100 text-sm font-medium">System GMV (All-time)</p>
            <CardTitle className="text-3xl font-bold text-white tracking-tighter">₹{metrics.gmv.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-purple-100 text-xs">{appointments.length} Consultations processed</div>
          </CardContent>
          <Building2 className="absolute -right-2 -bottom-2 h-24 w-24 text-white/10" />
        </Card>

        {/* Patient Reach Card */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all border-none shadow-sm bg-gradient-to-br from-orange-500 to-orange-600">
          <CardHeader className="pb-2">
            <p className="text-orange-100 text-sm font-medium">Patient Reach</p>
            <CardTitle className="text-3xl font-bold text-white tracking-tighter">{metrics.totalPatients.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-orange-100 text-xs">Unique patients in ecosystem</div>
          </CardContent>
          <Users className="absolute -right-2 -bottom-2 h-24 w-24 text-white/10" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Revenue Breakdown</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.breakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {metrics.breakdown.map((e: any, i: number) => <Cell key={`cell-${i}`} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Growth Scenarios</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'Month 0', real: metrics.mrr },
                { name: 'Month 6', real: metrics.mrr * 8 },
                { name: 'Month 12', real: metrics.mrr * 30 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="real" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Realistic" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
