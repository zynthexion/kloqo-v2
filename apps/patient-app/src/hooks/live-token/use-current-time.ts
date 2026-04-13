'use client';

import { useState, useEffect } from 'react';

export function useCurrentTime() {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timerId);
    }, []);

    return { currentTime };
}
