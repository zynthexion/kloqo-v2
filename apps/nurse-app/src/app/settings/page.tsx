'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LogOut, ChevronRight, CalendarDays, Settings, Clock, MessageSquare, User, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';

export default function SettingsPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { activeRole } = useActiveIdentity();

  const handleLogout = async () => {
    try {
      localStorage.removeItem('selectedDoctorId');
      localStorage.removeItem('clinicId');
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAdmin = user?.role === 'clinicAdmin' || user?.role === 'superAdmin';

  const menuItems = [
    {
      title: 'Doctor Availability',
      icon: CalendarDays,
      href: '/settings/availability',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      show: true,
    },
    {
      title: 'Clinic Settings',
      icon: Settings,
      href: '/settings/clinic',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      show: isAdmin,
    },
    {
      title: 'Operating Hours',
      icon: Clock,
      href: '/settings/operating-hours',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      show: isAdmin,
    },
    {
      title: 'WhatsApp Bot',
      icon: MessageSquare,
      href: '/settings/whatsapp',
      color: 'text-green-600',
      bg: 'bg-green-50',
      show: isAdmin,
    },
    {
      title: 'Day Snapshot',
      icon: BarChart3,
      href: '/day-snapshot',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      show: true,
    },
  ].filter(item => item.show);

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col h-full bg-muted/20">
        <header className="relative p-4 pb-8 text-white rounded-b-3xl bg-theme-blue">
          <div className="absolute top-[-50px] left-[-50px] w-[150px] h-[150px] bg-white/20 rounded-full" />
          <div className="absolute top-[30px] right-[-80px] w-[200px] h-[200px] border-[20px] border-white/20 rounded-full" />

          <div className="relative z-10 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-white hover:bg-white/10 hover:text-white -ml-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>

          {user && (
            <div className="relative z-10 mt-4 flex items-center gap-3 bg-white/10 rounded-2xl p-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm">{user.name || user.email}</p>
                <p className="text-xs opacity-80 capitalize">{activeRole}</p>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 pt-6 space-y-6">
          <RoleSwitcher />
          
          <div className="space-y-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-1">
              Quick Links
            </p>

          {menuItems.map((item) => (
            <Link href={item.href} key={item.title}>
              <div className={cn(
                "flex items-center justify-between p-4 rounded-2xl cursor-pointer bg-white hover:bg-slate-50 shadow-sm border border-slate-100 transition-all",
                theme === 'modern' && "glass-card border-none"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(`p-2.5 rounded-xl ${item.bg}`, theme === 'modern' && "bg-primary/10")}>
                    <item.icon className={cn(`h-5 w-5 ${item.color}`, theme === 'modern' && "text-primary")} />
                  </div>
                  <span className="font-semibold text-slate-700">{item.title}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </Link>
          ))}

          <div className="pt-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-3">
              Appearance
            </p>
            <div className={cn(
                "flex items-center justify-between p-4 rounded-2xl bg-white shadow-sm border border-slate-100",
                theme === 'modern' && "glass-card border-none"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl bg-slate-100", theme === 'modern' && "bg-primary/10")}>
                  <Settings className={cn("h-5 w-5 text-slate-600", theme === 'modern' && "text-primary")} />
                </div>
                <div>
                   <span className="font-semibold text-slate-700 block">Modern UI</span>
                   <span className="text-[10px] text-muted-foreground uppercase tracking-tight font-bold">Premium Experience</span>
                </div>
              </div>
              <Switch checked={theme === 'modern'} onCheckedChange={(val) => setTheme(val ? 'modern' : 'normal')} />
            </div>
          </div>
        </div>

          <div className="pt-4 pb-10">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-3">
              Account
            </p>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-100 transition-all"
            >
              <div className="p-2.5 rounded-xl bg-red-100">
                <LogOut className="h-5 w-5 text-red-600" />
              </div>
              <span className="font-semibold text-red-600">Log Out</span>
            </button>
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout>
      <div className="space-y-12 py-8 animate-in fade-in duration-700">
        <header>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 px-1">Manage your clinic preferences and account</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {menuItems.map((item) => (
              <Link href={item.href} key={item.title}>
                <div className="group p-8 rounded-[2.5rem] bg-white border border-slate-50 shadow-premium transition-all duration-500 flex flex-col items-center text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]">
                    <div className={cn("p-6 rounded-[2rem] text-white transition-transform group-hover:rotate-6 mb-6 shadow-lg", "bg-primary shadow-primary/20", item.bg.replace('bg-', 'bg-opacity-10 '))}>
                        <item.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h4 className="text-xl font-black text-slate-900 tracking-tight">{item.title}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Configuration Options</p>
                </div>
              </Link>
            ))}

            {/* Appearance Toggle for Tablet */}
            <div className="p-8 rounded-[2.5rem] bg-white border border-slate-50 shadow-premium flex flex-col items-center text-center">
                <div className="p-6 rounded-[2rem] bg-slate-50 text-slate-400 mb-6">
                    <Settings className="h-8 w-8" />
                </div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">Modern Interface</h4>
                <div className="mt-6 flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Legacy</span>
                    <Switch checked={theme === 'modern'} onCheckedChange={(val) => setTheme(val ? 'modern' : 'normal')} />
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Premium</span>
                </div>
            </div>

            {/* Logout Card */}
            <div 
                onClick={handleLogout}
                className="group p-8 rounded-[2.5rem] bg-red-50/50 border border-red-100 shadow-premium transition-all duration-500 flex flex-col items-center text-center cursor-pointer hover:bg-red-50 hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]"
            >
                <div className="p-6 rounded-[2rem] bg-red-100 text-red-600 mb-6">
                    <LogOut className="h-8 w-8" />
                </div>
                <h4 className="text-xl font-black text-red-600 tracking-tight">Sign Out</h4>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mt-2">End your session</p>
            </div>
        </div>
      </div>
    </TabletDashboardLayout>
  );

  return (
    <ResponsiveAppLayout 
      mobile={mobileView} 
      tablet={tabletView} 
    />
  );
}
