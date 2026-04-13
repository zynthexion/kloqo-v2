'use client';

import Image from 'next/image';

interface BrandingProps {
    tagline: string;
}

export function BrandingSection({ tagline }: BrandingProps) {
    return (
        <div className="flex flex-col items-center space-y-3 mb-8">
        <div className="flex flex-col items-center justify-center py-4">
            <h1 className="text-4xl font-extrabold tracking-tighter text-[#256cad]">Kloqo</h1>
            <div className="h-1 w-12 bg-[#256cad] rounded-full mt-1"></div>
        </div>
            <p className="text-sm text-muted-foreground font-medium text-center">{tagline}</p>
        </div>
    );
}
