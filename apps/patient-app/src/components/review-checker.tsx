'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { ReviewPrompt } from './review-prompt';
import { parseAppointmentDateTime } from '@/lib/utils';
import { addHours, differenceInHours } from 'date-fns';
import type { Appointment } from '@kloqo/shared';

// Constants
const REVIEW_DELAY_HOURS = 1; // Wait 1 hour after completion before showing review
const REVIEW_COOLDOWN_HOURS = 24; // Don't show again for 24 hours if skipped

/**
 * ReviewChecker
 * Periodically checks for completed appointments that haven't been reviewed.
 * Now uses the REST API instead of direct Firestore access.
 */
export function ReviewChecker() {
    const [pendingReview, setPendingReview] = useState<Appointment | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user?.patientId) return;

        const checkForPendingReview = async () => {
            try {
                // Fetch completed, unreviewed appointments for the patient (including doctor metadata)
                const res = await apiRequest(
                    `/appointments?patientId=${user.patientId}&status=Completed&reviewed=false&includeDoctorData=true`
                );
                
                const unreviewedAppointments: (Appointment & { doctorData?: any })[] = res.appointments || [];

                if (unreviewedAppointments.length === 0) return;

                const now = new Date();

                // Check each unreviewed appointment for timing eligibility
                for (const appointment of unreviewedAppointments) {
                    // 1. Check skip cooldown (local storage)
                    const skipKey = `review_skipped_${appointment.id}`;
                    const skipData = localStorage.getItem(skipKey);
                    
                    if (skipData) {
                        const skipTimestamp = parseInt(skipData, 10);
                        const hoursSinceSkip = differenceInHours(now, new Date(skipTimestamp));
                        if (hoursSinceSkip < REVIEW_COOLDOWN_HOURS) continue; 
                    }

                    // 2. Calculate timing eligibility
                    try {
                        const appointmentDateTime = parseAppointmentDateTime(appointment.date, appointment.time);
                        
                        // Use doctor's specific avg consulting time if available from the metadata
                        const avgConsultingTime = appointment.doctorData?.averageConsultingTime || 15;

                        // Estimate completion time: appointment time + average consulting time
                        const estimatedCompletionTime = addHours(appointmentDateTime, avgConsultingTime / 60);
                        
                        // Calculate when review should be shown (completion + delay)
                        const reviewShowTime = addHours(estimatedCompletionTime, REVIEW_DELAY_HOURS);
                        
                        // Only show if enough time has passed
                        if (now >= reviewShowTime) {
                            setPendingReview(appointment);
                            return; // Found the most relevant one, stop looking
                        }
                    } catch (error) {
                        console.error('[ReviewChecker] Date parsing error:', error);
                        continue;
                    }
                }
            } catch (error) {
                console.error('[ReviewChecker] API error:', error);
            }
        };

        checkForPendingReview();
        
        // Recheck logic
        const interval = setInterval(checkForPendingReview, 30 * 60 * 1000); // Check every 30 mins
        return () => clearInterval(interval);
    }, [user?.patientId]);

    if (!pendingReview) return null;

    return (
        <ReviewPrompt
            appointment={pendingReview}
            onClose={(wasSkipped?: boolean) => {
                if (wasSkipped) {
                    const skipKey = `review_skipped_${pendingReview.id}`;
                    localStorage.setItem(skipKey, Date.now().toString());
                }
                setPendingReview(null);
            }}
        />
    );
}



