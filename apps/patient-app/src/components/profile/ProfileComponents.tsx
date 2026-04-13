'use client';

import Link from 'next/link';
import { ChevronRight, LogOut, Share, Home, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const NotificationSettings = dynamic(() => import('@/components/notification-settings').then(mod => mod.NotificationSettings), { ssr: false, loading: () => <Skeleton className="h-10 w-full mb-4" /> });
const LanguageSettings = dynamic(() => import('@/components/language-settings').then(mod => mod.LanguageSettings), { ssr: false, loading: () => <Skeleton className="h-10 w-full mb-4" /> });

interface MenuItem {
    icon: any;
    label: string;
    href?: string;
    onClick?: () => void;
}

export function ProfileMenu({ items, logout, t }: { items: MenuItem[]; logout: () => void; t: any }) {
    return (
        <div className="space-y-6">
            <div className="bg-card rounded-xl shadow-sm overflow-hidden divide-y divide-border">
                <NotificationSettings />
                <LanguageSettings />
                {items.map((item, i) => (
                    item.href ? (
                        <Link href={item.href} key={i}>
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <item.icon className="h-6 w-6 text-primary" />
                                    <span className="font-semibold">{item.label}</span>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </Link>
                    ) : (
                        <button key={i} type="button" onClick={item.onClick} className="w-full text-left">
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <item.icon className="h-6 w-6 text-primary" />
                                    <span className="font-semibold">{item.label}</span>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </button>
                    )
                ))}
            </div>
            <Button onClick={logout} variant="outline" className="w-full justify-start items-center gap-4 p-4 h-auto bg-card border-destructive/20 hover:bg-destructive/10">
                <LogOut className="h-6 w-6 text-red-500" />
                <span className="font-semibold text-red-500">{t.profile.logout}</span>
            </Button>
        </div>
    );
}

export function LegalModals({ dialogs, pwa, t }: { dialogs: any; pwa: any; t: any }) {
    const iosSteps = [
        { icon: Share, title: t.pwa.installStepShare, description: t.pwa.installStepShareDesc },
        { icon: Home, title: t.pwa.installStepAdd, description: t.pwa.installStepAddDesc },
        { icon: CheckCircle2, title: t.pwa.installStepConfirm, description: t.pwa.installStepConfirmDesc },
    ];

    return (
        <>
            <Dialog open={dialogs.showTerms} onOpenChange={dialogs.setShowTerms}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t.profile.terms}</DialogTitle></DialogHeader>
                    <div className="space-y-4 text-sm">
                        <p className="font-semibold">English</p>
                        <p className="text-muted-foreground">Follow queue rules, arrive on time, respect staff.</p>
                        <p className="font-semibold pt-4">Malayalam (മലയാളം)</p>
                        <p className="text-muted-foreground">ക്യൂ നിയമങ്ങൾ പാലിക്കുകയും സമയത്ത് റിപ്പോർട്ട് ചെയ്യുകയും ചെയ്യുക.</p>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogs.showPrivacy} onOpenChange={dialogs.setShowPrivacy}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t.profile.privacyPolicy}</DialogTitle></DialogHeader>
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <p>We value your privacy. Your data is used only for managing appointments.</p>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogs.showInstallPrompt} onOpenChange={dialogs.setShowInstallPrompt}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t.pwa.installApp}</DialogTitle>
                        <DialogDescription>{t.pwa.installQuickAccess}</DialogDescription>
                    </DialogHeader>
                    {pwa.isIOS && (
                        <div className="space-y-3">
                            {iosSteps.map((s, i) => (
                                <div key={i} className="flex gap-3 p-3 border rounded-xl items-start">
                                    <span className="h-6 w-6 bg-primary/10 text-primary flex items-center justify-center rounded-full text-xs font-bold">{i+1}</span>
                                    <div><p className="font-bold text-sm">{s.title}</p><p className="text-xs text-muted-foreground">{s.description}</p></div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => dialogs.setShowInstallPrompt(false)}>{t.profile.maybeLater}</Button>
                        <Button className="flex-1" onClick={pwa.handleInstallAction}>{pwa.isIOS ? t.profile.gotIt : t.profile.installNow}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
