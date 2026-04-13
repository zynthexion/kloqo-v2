'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Building2,
  Users,
  DollarSign,
  FileText,
  AlertTriangle,
  Activity,
  SlidersHorizontal,
  User,
  CreditCard,
  Bell,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { useAuth } from '@/contexts/AuthContext';

const menuItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview', permission: 'Dashboard' },
  { href: '/dashboard/growth', icon: TrendingUp, label: 'Growth Analytics', permission: 'Analytics' },
  { href: '/dashboard/traffic', icon: Globe, label: 'Traffic Analytics', permission: 'Analytics' },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notifications', permission: 'Notifications' },
  { href: '/dashboard/marketing', icon: TrendingUp, label: 'Marketing Analytics', permission: 'Analytics' },
  { href: '/dashboard/clinics', icon: Building2, label: 'Clinics', permission: 'Clinics' },
  { href: '/dashboard/doctors', icon: User, label: 'Doctors', permission: 'Doctors' },
  { href: '/dashboard/patients', icon: Users, label: 'Patients', permission: 'Patients' },
  { href: '/dashboard/staff', icon: Users, label: 'Staff Management', permission: 'Staff' },
  { href: '/dashboard/financial', icon: DollarSign, label: 'Financial', permission: 'Analytics' },
  { href: '/dashboard/reports', icon: FileText, label: 'Reports', permission: 'Analytics' },
  { href: '/dashboard/departments', icon: SlidersHorizontal, label: 'Departments', permission: 'Clinics' },
  { href: '/dashboard/errors', icon: AlertTriangle, label: 'Error Logs', permission: 'Analytics' },
  { href: '/dashboard/health', icon: Activity, label: 'App Health', permission: 'Analytics' },
  { href: '/dashboard/settings', icon: SlidersHorizontal, label: 'System Settings', permission: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Root 'superAdmin' sees everything. Staff see only allowed modules.
  const filteredItems = menuItems.filter((item) => {
    if (!user) return false;
    if (user.role === 'superAdmin' || user.role === 'superadmin') return true;
    return user.accessibleMenus?.includes(item.permission);
  });

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Kloqo SuperAdmin</h2>
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

