'use client';

import { Clinic } from '@kloqo/shared';

interface ArrivalHeaderProps {
    clinic: Clinic;
}

export function ArrivalHeader({ clinic }: ArrivalHeaderProps) {
    return (
        <div className="bg-primary text-primary-foreground p-6 rounded-b-[2rem] pb-24">
            <h1 className="text-2xl font-bold mb-2">Confirm Arrival</h1>
            <p className="text-sm opacity-90">{clinic.name}</p>
        </div>
    );
}
