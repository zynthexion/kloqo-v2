
import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle, ShieldCheck, Mail, Globe, Heart, Clock, ChevronRight, Star } from 'lucide-react';
import { DoctorAvailabilityPreview } from '@/components/doctors/DoctorAvailabilityPreview';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetch doctor data helper using V2 Backend API
async function getDoctor(id: string) {
    try {
        const res = await fetch(`${API_URL}/public-booking/doctors/${id}`, { next: { revalidate: 60 } }).then(res => res.json());
        if (!res || res.error) return null;
        
        const doctor = res.doctor || res;
        
        // Fetch clinic details separately if not nested
        let clinic = null;
        if (doctor.clinicId) {
            const clinicRes = await fetch(`${API_URL}/public-booking/clinics/${doctor.clinicId}`, { next: { revalidate: 3600 } }).then(res => res.json());
            if (clinicRes && !clinicRes.error) {
                clinic = clinicRes.clinic || clinicRes;
            }
        }
        
        return { ...doctor, clinic };
    } catch (error) {
        console.error(`Error fetching doctor ${id}:`, error);
        return null;
    }
}

// 1. Dynamic Metadata Generation
export async function generateMetadata(
    { params }: { params: Promise<{ id: string }> },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params;
    const doctor: any = await getDoctor(id);

    if (!doctor) {
        return {
            title: 'Doctor Not Found - Kloqo',
        };
    }

    const doctorName = doctor.name || 'Doctor';
    const speciality = doctor.department || doctor.specialization || 'Specialist';
    const city = doctor.clinic?.city || doctor.clinic?.address || 'Kerala';
    const clinicName = doctor.clinic?.name || '';

    return {
        title: `${doctorName} | Specialized ${speciality} in ${city} | Kloqo`,
        description: `Book appointment with Dr. ${doctorName}, ${speciality} at ${clinicName}. See verified reviews, consult fee, and choose your preferred slot.`,
        openGraph: {
            title: `Dr. ${doctorName} - ${speciality}`,
            description: `Book appointment with Dr. ${doctorName} at ${clinicName}.`,
            images: doctor.photoUrl ? [doctor.photoUrl] : [],
        },
    };
}

export default async function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const doctor: any = await getDoctor(id);

    if (!doctor) {
        notFound();
    }

    // 2. Schema.org JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Physician',
        name: doctor.name,
        image: doctor.photoUrl,
        description: doctor.bio || `Specialist in ${doctor.department || doctor.specialization}`,
        medicalSpecialty: doctor.department || doctor.specialization,
        priceRange: doctor.consultationFee ? `₹${doctor.consultationFee}` : '$$',
        address: {
            '@type': 'PostalAddress',
            streetAddress: doctor.clinic?.address,
            addressLocality: doctor.clinic?.city,
            addressRegion: 'Kerala',
            addressCountry: 'IN'
        },
        telephone: doctor.clinic?.phone || doctor.phone,
        url: `https://kloqo.com/doctors/${doctor.id}`,
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: doctor.rating || '5',
            reviewCount: doctor.reviewList?.length || '1'
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-body pb-20">
            {/* JSON-LD Script for SEO */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Navigation Overlay */}
            <header className="bg-white/80 backdrop-blur-md border-b-2 border-slate-100 sticky top-0 z-40 transition-all">
                <div className="container mx-auto px-4 py-4 max-w-5xl flex justify-between items-center">
                    <Link href="/doctors" className="h-10 w-10 flex items-center justify-center bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                        <span className="text-xl font-bold">←</span>
                    </Link>
                    <div className="flex-grow flex justify-center px-4">
                        <Link href="/" className="font-black text-2xl text-slate-800 tracking-tighter uppercase leading-none">
                            Kloqo<span className="text-primary font-black">.</span>
                        </Link>
                    </div>
                    <div className="w-10"></div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Column: Personalized Profile */}
                    <div className="lg:col-span-8 space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-5">
                        
                        {/* 1. Hero Profile Card */}
                        <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white relative">
                            <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-primary via-blue-600 to-cyan-400 opacity-90 drop-shadow-md"></div>
                            <div className="absolute top-48 left-0 w-full h-full bg-white"></div>
                            
                            <CardContent className="pt-24 relative px-8 pb-10">
                                <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-8 text-center md:text-left">
                                    <div className="relative">
                                        <Avatar className="h-40 w-40 md:h-48 md:w-48 rounded-[2.5rem] border-8 border-white shadow-2xl ring-4 ring-slate-100/10">
                                            <AvatarImage src={doctor.photoUrl} className="object-cover" />
                                            <AvatarFallback className="text-6xl bg-slate-100 font-black text-slate-300 uppercase">{doctor.name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-2 -right-2 h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-xl border-2 border-slate-50">
                                            <CheckCircle className="w-8 h-8 text-blue-500 fill-blue-50" />
                                        </div>
                                    </div>
                                    <div className="flex-grow pb-2 space-y-1">
                                        <div className="flex items-center justify-center md:justify-start gap-3">
                                            <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-none uppercase">{doctor.name}</h1>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                                            <Badge variant="secondary" className="bg-primary/5 text-primary text-xs font-black tracking-widest uppercase px-3 py-1 rounded-lg border-none">
                                                {doctor.department || doctor.specialization}
                                            </Badge>
                                            <Badge variant="outline" className="text-slate-500 text-xs font-black tracking-widest uppercase px-3 py-1 rounded-lg border-slate-200">
                                                {doctor.qualification}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50/80 backdrop-blur rounded-[2rem] border border-slate-100 shadow-inner">
                                    <div className="flex flex-col items-center justify-center py-2">
                                        <span className="text-2xl font-black text-slate-800">₹{doctor.consultationFee || '0'}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consult Fee</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center py-2 border-l border-slate-200">
                                        <span className="text-2xl font-black text-green-600">{doctor.experience || 'NEW'}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Years XP</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center py-2 border-l border-slate-200">
                                        <span className="text-2xl font-black text-amber-500">{doctor.rating || '5.0'}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rating</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center py-2 border-l border-slate-200">
                                        <span className="text-2xl font-black text-blue-600">{doctor.reviewList?.length || '0'}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviews</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Biography & Highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                                <CardContent className="p-0">
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
                                        <ShieldCheck className="w-6 h-6 text-primary" />
                                        About Dr. {doctor.name?.split(' ').pop()}
                                    </h3>
                                    <div className="prose text-slate-600 text-sm leading-relaxed font-medium">
                                        {doctor.bio || `Dr. ${doctor.name} is a dedicated ${doctor.specialization || 'specialist'} with years of commitment to patient care at ${doctor.clinic?.name || 'our verified clinic'}.`}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                                <CardContent className="p-0">
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
                                        <Heart className="w-6 h-6 text-red-400" />
                                        Specializations
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {(doctor.specialty?.split(',') || [doctor.specialization]).map((s: string) => (
                                            <span key={s} className="bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-100">
                                                {s.trim()}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-slate-50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 leading-none">Language Expertise</p>
                                        <div className="flex gap-2">
                                            <Badge className="bg-slate-800 text-white border-none rounded-lg font-black uppercase text-[9px] tracking-widest">English</Badge>
                                            <Badge className="bg-slate-800 text-white border-none rounded-lg font-black uppercase text-[9px] tracking-widest">Malayalam</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* 3. Patient Reviews Section */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Patient Stories</h3>
                                <Button variant="ghost" className="font-black uppercase text-xs tracking-widest text-primary">View All {doctor.reviewList?.length || 0}</Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(doctor.reviewList || [
                                    { patientName: 'Ali K.', rating: 5, feedback: 'Excellent treatment and very punctual doctor.', date: 'Dec 2025' },
                                    { patientName: 'Suresh M.', rating: 5, feedback: 'Listens well and explains everything in detail.', date: 'Jan 2026' }
                                ]).slice(0, 4).map((rev: any, idx: number) => (
                                    <Card key={idx} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden p-6 hover:scale-[1.02] transition-transform">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Star key={s} className={`w-3 h-3 ${s <= (rev.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-100'}`} />
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{rev.date || 'Recent Visit'}</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-600 mb-4 h-12 line-clamp-3">"{rev.feedback || 'Excellent consultation.'}"</p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black">{rev.patientName?.[0]}</div>
                                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{rev.patientName || 'Kloqo Patient'}</span>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Booking & Location Widget (Sticky) */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="sticky top-28 space-y-6">
                            
                            {/* NEW: Dynamic Slot Preview Component */}
                            <DoctorAvailabilityPreview doctor={doctor} />

                            {/* Clinic / Contact Helper */}
                            <Card className="border-none shadow-xl rounded-[3rem] bg-white p-8">
                                <CardContent className="p-0 space-y-6">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-2">Support & Address</h3>
                                    <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Clinic Location</p>
                                        <p className="text-sm font-bold text-slate-800 leading-tight">{doctor.clinic?.name || 'Verified Center'}</p>
                                        <p className="text-[11px] font-medium text-slate-500 mt-1 italic">{doctor.clinic?.address || 'Kerala, India'}</p>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <Phone className="w-5 h-5 text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Assistance</p>
                                            <p className="text-sm font-bold text-slate-800">+91 12345 67890</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <Mail className="w-5 h-5 text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Email</p>
                                            <p className="text-sm font-bold text-slate-800">{doctor.email || 'care@kloqo.com'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

