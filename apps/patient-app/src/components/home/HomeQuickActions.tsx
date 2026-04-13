'use client';

import { Camera, Ticket, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';

interface QuickActionProps {
    onScanConsult: () => void;
    onScanConfirm: () => void;
}

export function HomeQuickActions({ onScanConsult, onScanConfirm }: QuickActionProps) {
    const { t, language } = useLanguage();

    return (
        <div className="px-6 mt-8">
            <div className="grid grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={onScanConsult}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center shadow-sm transition hover:shadow-md active:scale-95 flex flex-col items-center justify-center min-h-[160px] gap-3"
                >
                    <div className="bg-emerald-100 p-3 rounded-full">
                        <Camera className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-emerald-900 leading-tight">
                            {t.home.consultWithoutAppointment}
                        </h3>
                        <p className="text-[10px] text-emerald-600/70 mt-1">
                            {t.home.scanQRCode}
                        </p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={onScanConfirm}
                    className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-center shadow-sm transition hover:shadow-md active:scale-95 flex flex-col items-center justify-center min-h-[160px] gap-3"
                >
                    <div className="bg-blue-100 p-3 rounded-full">
                        <Ticket className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-sm text-blue-900 leading-tight">
                            {language === 'ml' ? 'ഹാജരാവൽ സ്ഥിരീകരിക്കുക' : 'Confirm Arrival'}
                        </h3>
                        <p className="text-[10px] text-blue-600/70 mt-1">
                            {language === 'ml' ? 'ക്ലിനിക്കിലെത്തിയത് സ്ഥിരീകരിക്കുക' : 'Confirm arrival at clinic'}
                        </p>
                    </div>
                </button>
            </div>
        </div>
    );
}
