
import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Stethoscope, Star, CheckCircle, Search, Map } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { Doctor } from '@kloqo/shared';

export const metadata: Metadata = {
    title: 'Top Rated Doctors and Specialists - Kloqo',
    description: 'Browse top specialists and clinics near you. Book your care instantly with verified reviews and real-time availability.',
};

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getDoctorsAndClinics() {
    try {
        const [doctorsRes, clinicsRes] = await Promise.all([
            fetch(`${API_URL}/doctors`, { next: { revalidate: 60 } }).then(res => res.json()),
            fetch(`${API_URL}/clinics`, { next: { revalidate: 60 } }).then(res => res.json())
        ]);

        const doctors = Array.isArray(doctorsRes) ? doctorsRes : (doctorsRes.data || []);
        const clinicsArr = Array.isArray(clinicsRes) ? clinicsRes : (clinicsRes.data || []);

        const clinics = clinicsArr.reduce((acc: any, c: any) => {
            acc[c.id] = c;
            return acc;
        }, {} as any);

        return doctors.map((d: any) => ({
            ...d,
            clinic: clinics[d.clinicId] || null
        }));
    } catch (error) {
        console.error('Error fetching doctors and clinics:', error);
        return [];
    }
}

export default async function DoctorsDirectoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const doctors = await getDoctorsAndClinics();
    const resolvedSearchParams = await searchParams;

    const query = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q.toLowerCase() : '';
    const dept = typeof resolvedSearchParams.dept === 'string' ? resolvedSearchParams.dept.toLowerCase() : '';
    const city = typeof resolvedSearchParams.city === 'string' ? resolvedSearchParams.city.toLowerCase() : '';
    const sort = typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : 'recommended';

    let filteredDoctors = doctors.filter((doctor: any) => {
        const searchMatches = !query || 
            doctor.name?.toLowerCase().includes(query) ||
            doctor.specialization?.toLowerCase().includes(query) ||
            doctor.clinic?.name?.toLowerCase().includes(query);

        const deptMatches = !dept || 
            doctor.department?.toLowerCase().includes(dept) || 
            doctor.specialization?.toLowerCase().includes(dept);

        const cityMatches = !city || 
            doctor.clinic?.city?.toLowerCase().includes(city) ||
            doctor.clinic?.address?.toLowerCase().includes(city);

        return searchMatches && deptMatches && cityMatches;
    });

    // Handle Sorting
    if (sort === 'rating') {
        filteredDoctors.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'fee-low') {
        filteredDoctors.sort((a: any, b: any) => (a.consultationFee || 0) - (b.consultationFee || 0));
    } else if (sort === 'experience') {
        filteredDoctors.sort((a: any, b: any) => (parseInt(b.experience) || 0) - (parseInt(a.experience) || 0));
    }

    const departments = Array.from(new Set(doctors.map((d: Doctor) => d.department || (d as any).specialization).filter(Boolean))).sort();
    const cities = Array.from(new Set(doctors.map((d: Doctor) => (d as any).clinic?.city || (d as any).clinic?.address?.split(',').pop()?.trim()).filter(Boolean))).sort();

    return (
        <div className="min-h-screen bg-slate-50 font-body">
            {/* Header / Search Hero */}
            <div className="bg-white border-b-2 border-slate-100 sticky top-0 z-30 shadow-sm transition-all duration-300">
                <div className="container mx-auto px-4 py-6 max-w-5xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <Link href="/">
                                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <Map className="w-5 h-5 text-primary" />
                                </div>
                            </Link>
                            <div>
                                <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Find Specialists</h1>
                                <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest leading-none">Verified Doctors In Your Area</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Link href="/login">
                                <Button variant="outline" className="rounded-xl font-bold uppercase text-xs tracking-widest h-10 border-slate-200">Sign In</Button>
                            </Link>
                        </div>
                    </div>

                    <form action="/doctors" method="GET" className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-grow">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                name="q"
                                defaultValue={query}
                                placeholder="Search by name, specialization, or clinic..."
                                className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-inner"
                            />
                        </div>
                        
                        <div className="flex gap-2">
                             <select 
                                name="sort" 
                                defaultValue={sort}
                                className="h-12 px-4 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-primary/20 shadow-inner"
                            >
                                <option value="recommended">Recommended</option>
                                <option value="rating">Top Rated</option>
                                <option value="fee-low">Lowest Fee</option>
                                <option value="experience">Experience</option>
                            </select>
                            <Button type="submit" className="h-12 w-12 rounded-2xl p-0">
                                <Search className="w-5 h-5" />
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

            <main className="container mx-auto px-4 py-8 max-w-5xl flex flex-col md:flex-row gap-8">
                {/* Side Filter Component (Server component pseudo-sidebar) */}
                <aside className="w-full md:w-64 space-y-8 flex-shrink-0">
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Popular Specialties</h3>
                        <div className="flex flex-wrap md:flex-col gap-2">
                            <Link href="/doctors" className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${!dept ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                                All
                            </Link>
                            {departments.slice(0, 8).map((d: any) => (
                                <Link 
                                    key={d}
                                    href={`/doctors?dept=${encodeURIComponent(d)}`}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${dept === d.toLowerCase() ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {d}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">City Filter</h3>
                        <div className="flex flex-wrap md:flex-col gap-2">
                            {cities.map((c: any) => (
                                <Link 
                                    key={c}
                                    href={`/doctors?city=${encodeURIComponent(c)}`}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${city === c.toLowerCase() ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {c}
                                </Link>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Listing Area */}
                <div className="flex-grow space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                            {filteredDoctors.length} {filteredDoctors.length === 1 ? 'Doctor' : 'Doctors'} Found
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredDoctors.map((doctor: any) => (
                            <Link href={`/doctors/${doctor.id}`} key={doctor.id} className="group">
                                <Card className="border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[2rem] overflow-hidden bg-white/80 backdrop-blur-xl border border-white/20">
                                    <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start">
                                        <div className="relative flex-shrink-0 group-hover:scale-110 transition-transform duration-500">
                                            <Avatar className="h-24 w-24 md:h-32 md:w-32 rounded-[1.5rem] shadow-lg ring-4 ring-white">
                                                <AvatarImage src={doctor.photoUrl} alt={doctor.name} className="object-cover" />
                                                <AvatarFallback className="text-3xl bg-slate-100 font-black text-slate-300">
                                                    {doctor.name?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            {doctor.rating >= 4.5 && (
                                                <div className="absolute -top-3 -right-3 h-8 w-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg transform rotate-12">
                                                    <Star className="w-4 h-4 text-white fill-white" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-grow space-y-2 md:space-y-3">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="text-xl md:text-2xl font-black text-slate-800 group-hover:text-primary transition-colors leading-tight">{doctor.name}</h3>
                                                        <CheckCircle className="w-5 h-5 text-blue-500" />
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="secondary" className="bg-slate-100 text-[10px] font-black tracking-widest uppercase text-slate-500 border-none px-2 py-0.5 rounded-lg">
                                                            {doctor.department || doctor.specialization}
                                                        </Badge>
                                                        {doctor.experience && (
                                                            <Badge className="bg-green-100 text-green-700 text-[10px] font-black tracking-widest uppercase border-none px-2 py-0.5 rounded-lg">
                                                                {doctor.experience} XP
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-start md:items-end">
                                                    <span className="text-2xl font-black text-slate-800">₹{doctor.consultationFee || '0'}</span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultation Fee</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col space-y-2 py-3 border-y border-slate-50">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <Stethoscope className="w-4 h-4 text-primary" />
                                                    <span className="text-xs font-bold">{doctor.qualification || 'Verified Specialist'}</span>
                                                </div>
                                                <div className="flex items-start gap-2 text-slate-500">
                                                    <MapPin className="w-4 h-4 text-red-400 mt-0.5" />
                                                    <span className="text-xs font-medium italic">{doctor.clinic?.name}, {doctor.clinic?.city || doctor.clinic?.address}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                        <Star 
                                                            key={s} 
                                                            className={`w-3.5 h-3.5 ${s <= (doctor.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                                                        />
                                                    ))}
                                                    <span className="ml-2 text-xs font-black text-slate-800 uppercase tracking-widest">{doctor.rating || '5.0'}</span>
                                                </div>
                                                <Button size="sm" className="rounded-xl px-6 font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all">
                                                    Book Now
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}

                        {filteredDoctors.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <Search className="w-6 h-6 text-slate-200" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Doctors Found</h3>
                                <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Try adjusting your filters or location</p>
                                <Link href="/doctors">
                                    <Button variant="ghost" className="mt-8 font-black uppercase text-xs tracking-widest text-primary">Clear all filters</Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

