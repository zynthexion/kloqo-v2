import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import type { Appointment } from '@kloqo/shared';
import { useLanguage } from '@/contexts/language-context';

interface ReviewPromptProps {
    appointment: Appointment;
    onClose: (wasSkipped?: boolean) => void;
}

export function ReviewPrompt({ appointment, onClose }: ReviewPromptProps) {
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { t } = useLanguage();

    const handleSubmit = async (): Promise<void> => {
        if (rating === 0) {
            toast({ variant: 'destructive', title: t.reviews.ratingRequired });
            return;
        }

        setIsSubmitting(true);
        try {
            await apiRequest(`/appointments/${appointment.id}/review`, {
                method: 'POST',
                body: JSON.stringify({ rating, feedback: feedback.trim() })
            });

            toast({ title: t.reviews.thankYou, description: t.reviews.successDesc });
            onClose(false);
        } catch (error: any) {
            console.error('Error submitting review:', error);
            toast({ variant: 'destructive', title: t.reviews.error, description: error.message || t.reviews.failedError });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>{t.reviews.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">
                            {t.reviews.howWasDoctor.replace('{doctor}', appointment.doctor || '')}
                        </p>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="transition-colors"
                                >
                                    <Star
                                        className="h-8 w-8"
                                        fill={
                                            star <= (hoveredRating || rating)
                                                ? '#FFD700'
                                                : 'none'
                                        }
                                        stroke={
                                            star <= (hoveredRating || rating)
                                                ? '#FFD700'
                                                : '#D1D5DB'
                                        }
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-2 block">
                            {t.reviews.feedbackLabel}
                        </label>
                        <Textarea
                            placeholder={t.reviews.feedbackPlaceholder}
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            rows={4}
                            maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {feedback.length}/500 {t.reviews.characters}
                        </p>
                    </div>

                    <div className="flex pt-2">
                        <Button
                            className="w-full"
                            onClick={() => {
                                handleSubmit().then(() => {
                                    onClose(false);
                                }).catch(() => {
                                    // Error already handled in handleSubmit
                                });
                            }}
                            disabled={isSubmitting || rating === 0}
                        >
                            {isSubmitting ? (
                                t.reviews.submitting
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    {t.reviews.submit}
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

