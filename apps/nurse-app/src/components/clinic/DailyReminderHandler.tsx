'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export function DailyReminderHandler() {
    const { user } = useAuth();
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        if (!user || hasChecked) return;

        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        const hour = now.getHours();

        // Determine current window
        let currentWindow: 'morning' | 'evening' | 'expiry' = 'expiry';
        if (hour >= 7 && hour < 11) currentWindow = 'morning';
        else if (hour >= 17 && hour < 20) currentWindow = 'evening';

        const storageKey = `last_daily_reminder_run_${currentWindow}`;
        const lastRunDate = localStorage.getItem(storageKey);

        if (lastRunDate === today) {
            console.log(`Daily reminders for ${currentWindow} already run today.`);
            setHasChecked(true);
            return;
        }

        const runCheck = async () => {
            const clinicId = user.clinicId;
            if (!clinicId) return;

            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            console.log(`Running Daily Reminder Check (${currentWindow}) at ${API_URL}...`);
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/notifications/batch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                        clinicId,
                        window: currentWindow
                    }),
                });

                if (response.ok) {
                    localStorage.setItem(storageKey, today);
                    setHasChecked(true);
                }
            } catch (error) {
                console.error('Error running daily reminders:', error);
            }
        };

        runCheck();

    }, [user, hasChecked]);

    return null;
}
