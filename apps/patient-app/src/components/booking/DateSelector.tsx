'use client';

import { useEffect, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDayOfWeek } from '@/lib/date-utils';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

interface DateSelectorProps {
    dates: Date[];
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    currentMonth: string;
    language: string;
    t: any;
    setApi: (api: CarouselApi) => void;
}

export function DateSelector({
    dates, selectedDate, onDateSelect, currentMonth, language, t, setApi
}: DateSelectorProps) {
    if (dates.length === 0) {
        return (
            <div className="flex gap-3 overflow-x-auto pb-2 px-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-2 min-w-[60px]">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="font-bold text-lg">{t.bookAppointment.selectDate}</h2>
                <span className="text-sm font-medium">{currentMonth}</span>
            </div>
            
            <Carousel setApi={setApi} opts={{ align: "start", dragFree: true }} className="w-full">
                <CarouselContent className="-ml-2">
                    {dates.map((d, index) => {
                        const isSelected = isSameDay(d, selectedDate);
                        return (
                            <CarouselItem key={index} className="basis-1/5 pl-2">
                                <Button
                                    onClick={() => onDateSelect(d)}
                                    variant="outline"
                                    className={cn(
                                        "w-full h-auto flex flex-col items-center justify-center p-3 rounded-xl gap-1 transition-colors",
                                        isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted hover:bg-muted/80"
                                    )}
                                >
                                    <span className="text-xs font-medium uppercase">{formatDayOfWeek(d, language as any)}</span>
                                    <span className="text-xl font-bold">{format(d, 'dd')}</span>
                                </Button>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>
            </Carousel>
        </div>
    );
}
