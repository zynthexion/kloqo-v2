'use client';

import { FileText, Download, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface Prescription {
    id: string;
    doctorName: string;
    clinicName: string;
    date: Date;
    fileUrl: string;
}

interface HomePrescriptionsProps {
    prescriptions: Prescription[];
    t: any;
}

export function HomePrescriptions({ prescriptions, t }: HomePrescriptionsProps) {
    if (prescriptions.length === 0) return null;

    const handleShare = async (p: Prescription) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Prescription from ${p.doctorName}`,
                    text: `View my prescription from ${p.clinicName}`,
                    url: p.fileUrl,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        }
    };

    return (
        <div className="px-6 space-y-3 mt-8">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-card-foreground">
                    {t.home.myPrescriptions}
                </h2>
                <Button variant="link" className="text-primary p-0 h-auto">
                    {t.common.seeAll || 'See All'}
                </Button>
            </div>

            <div className="space-y-3">
                {prescriptions.map((p) => (
                    <Card key={p.id} className="border-primary/5 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-grow min-w-0">
                                <p className="font-bold text-slate-900 truncate">{p.doctorName}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.clinicName}</p>
                                <p className="text-[10px] text-primary font-medium mt-0.5">
                                    {format(p.date, 'dd MMM yyyy')}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-slate-400 hover:text-primary rounded-full"
                                    onClick={() => handleShare(p)}
                                >
                                    <Share2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-slate-400 hover:text-primary rounded-full"
                                    onClick={() => window.open(p.fileUrl, '_blank')}
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
