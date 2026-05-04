'use client';

import { useState, useEffect } from 'react';
import { getClinicNow } from '@kloqo/shared-core';

export function useCurrentTime() {
    const [currentTime, setCurrentTime] = useState(getClinicNow());

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(getClinicNow()), 60000);
        return () => clearInterval(timerId);
    }, []);

    return { currentTime };
}
