'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { BottomNav } from '@/components/bottom-nav';
import { useProfileState } from '@/hooks/use-profile-state';
import { UserInfo } from '@/components/profile/UserInfo';
import { ProfileMenu, LegalModals } from '@/components/profile/ProfileComponents';

/**
 * ProfilePage Orchestrator
 * Modularized profile dashboard featuring User Details, App Settings, and PWA logic.
 */
function ProfilePageContent() {
    const {
        user, userLoading, logout,
        getUserInitials,
        menuItems,
        dialogs,
        pwa,
        t
    } = useProfileState();

    if (userLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="flex min-h-screen w-full flex-col bg-green-50/50 font-body">
            <header className="flex items-center p-4">
                <Link href="/home" className="p-2"><ArrowLeft className="h-6 w-6" /></Link>
                <h1 className="text-xl font-bold text-center flex-grow">{t.profile.myProfile}</h1>
                <div className="w-8"></div>
            </header>

            <main className="flex-grow p-4 space-y-8 pb-32">
                <UserInfo user={user} initials={getUserInitials()} />
                <ProfileMenu items={menuItems} logout={logout} t={t} />
            </main>

            <LegalModals dialogs={dialogs} pwa={pwa} t={t} />
            <BottomNav />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <AuthGuard>
            <ProfilePageContent />
        </AuthGuard>
    );
}

export const dynamic = 'force-dynamic';
