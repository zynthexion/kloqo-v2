import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { displayTime12h, getClinic12hTimeString } from '@kloqo/shared-core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CheckCircle2, Check, SkipForward, Star, Phone, Loader2 } from 'lucide-react';
import type { Appointment } from '@kloqo/shared';
import { format, addMinutes } from 'date-fns';
import React from 'react';

export interface AppointmentCardProps {
  appt: Appointment;
  index: number;
  currentPos: number;
  isSwiping: boolean;
  swipeStyle: React.CSSProperties;
  isBuffer: boolean;
  isActionable: boolean;
  isPhoneMode: boolean;
  isInactive: boolean;
  isClinicOut: boolean;
  theme: string;
  
  showPositionNumber: boolean;
  showEstimatedTime: boolean;
  showStatusBadge: boolean;
  showTopRightActions: boolean;
  averageConsultingTime: number;
  currentTime: Date;
  estimatedTimes?: Array<{ appointmentId: string; estimatedTime: string; isFirst: boolean }>;
  
  selectedAppointmentId: string | null;
  firstActionableAppointmentId: string | null;
  pendingCompletionId: string | null;
  pressState: { id: string | null; type: 'skip' | 'priority' | null; progress: number };
  isCapturing: boolean;
  
  getStatusBadge: (appt: Appointment) => JSX.Element | null;
  shouldShowConfirmArrival: (appt: Appointment) => boolean;
  tokenDistribution: 'classic' | 'advanced';
  
  onCardTouchStart: (e: React.TouchEvent<HTMLElement> | React.MouseEvent<HTMLElement>, appt: Appointment) => void;
  onCardTouchMove: (e: React.TouchEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => void;
  onCardTouchEnd: (e: React.TouchEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => void;
  onPressStart: (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>, id: string) => void;
  onPressEnd: (e?: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => void;
  onCardClick: () => void;
  onCompleteClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCallClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  
  onUpdateStatus?: boolean;
  onAddToQueue?: (appointment: Appointment) => void | ((appointment: Appointment) => void);
  onRejoinQueue?: (appointment: Appointment) => void;
}

export const AppointmentCard = React.forwardRef<HTMLDivElement, AppointmentCardProps>((
  {
    appt,
    index,
    currentPos,
  isSwiping,
  swipeStyle,
  isBuffer,
  isActionable,
  isPhoneMode,
  isInactive,
  isClinicOut,
  theme,
  
  showPositionNumber,
  showEstimatedTime,
  showStatusBadge,
  showTopRightActions,
  averageConsultingTime,
  currentTime,
  estimatedTimes = [],
  
  selectedAppointmentId,
  firstActionableAppointmentId,
  pendingCompletionId,
  pressState,
  isCapturing,
  
  getStatusBadge,
  shouldShowConfirmArrival,
  tokenDistribution,
  
  onCardTouchStart,
  onCardTouchMove,
  onCardTouchEnd,
  onPressStart,
  onPressEnd,
  onCardClick,
  onCompleteClick,
  onCallClick,
  
  onUpdateStatus,
  onAddToQueue,
  onRejoinQueue
  }, 
  ref
) => {
  const isModern = theme === 'modern';

  return (
    <div
      ref={ref}
      className={cn(
        "p-4 flex flex-col gap-3 border transition-all duration-200 relative",
        isModern ? "rounded-[2rem] border-white/50 bg-white shadow-premium" : "rounded-xl",
        isSwiping && 'text-white',
        !isModern && !isSwiping && "bg-white border-border shadow-md hover:shadow-lg",
        !isModern && !isSwiping && appt.status === 'Confirmed' && !appt.isPriority && "bg-green-50 border-green-200",
        !isModern && !isSwiping && appt.isPriority && "bg-amber-50 border-amber-400 shadow-md ring-1 ring-amber-400/50",
        !isModern && !isSwiping && isBuffer && !appt.isPriority && "bg-blue-50/80 border-blue-400",
        !isModern && !isSwiping && appt.skippedAt && "bg-amber-50/50 border-amber-400",
        !isModern && !isSwiping && appt.status === 'No-show' && "bg-red-50 border-red-200",
      )}
      style={swipeStyle}
      onMouseDown={(e) => onCardTouchStart(e, appt)}
      onTouchStart={(e) => onCardTouchStart(e, appt)}
      onClick={onCardClick}
      onMouseMove={onCardTouchMove}
      onTouchMove={onCardTouchMove}
      onMouseUp={onCardTouchEnd}
      onTouchEnd={onCardTouchEnd}
      onMouseLeave={onCardTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isCapturing && pendingCompletionId === appt.id && (
        <div className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold text-primary animate-pulse">UPLOADING...</span>
        </div>
      )}
      
      {pressState.type === 'priority' && pressState.id === appt.id && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 rounded-t-xl overflow-hidden z-20">
          <div
            className="h-full bg-amber-500 transition-all duration-[50ms] ease-linear"
            style={{ width: `${pressState.progress}%` }}
          />
        </div>
      )}
      
      <div
        className={cn(
          "transition-opacity duration-200",
          !isSwiping && appt.status === 'Skipped' && 'border-l-4 border-yellow-400 pl-2',
          !isSwiping && appt.status === 'Completed' && 'opacity-50',
          !isSwiping && appt.status === 'Cancelled' && (appt.cancellationReason === 'DOCTOR_LEAVE' ? 'border-l-4 border-orange-400 pl-2' : 'opacity-60'),
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="flex-1">
              <div className="flex justify-between items-center">
                {(() => {
                  if (showEstimatedTime) {
                    const est = estimatedTimes.find(e => e.appointmentId === appt.id);
                    if (est?.isFirst && isClinicOut) return null; // Wait, actually the original logic checked clinicStatus === 'In' here

                    const displayTime = est?.estimatedTime 
                      ? displayTime12h(est.estimatedTime) 
                      : (index === 0 ? '' : getClinic12hTimeString(addMinutes(currentTime, (averageConsultingTime || 15) * index)));
                    
                    if (!displayTime) return null;

                    return (
                      <Badge variant={isSwiping ? 'default' : 'outline'} className={cn("text-xs", isSwiping && 'bg-white/20 text-white')}>
                        {appt.date && `${appt.date} - `}
                        {displayTime}
                      </Badge>
                    );
                  }

                  return (
                    <Badge variant={isSwiping ? 'default' : 'outline'} className={cn("text-xs", isSwiping && 'bg-white/20 text-white')}>
                      {appt.date && `${appt.date} - `}
                      {['Confirmed', 'Completed', 'Cancelled', 'No-show'].includes(appt.status) ? appt.time : displayTime12h(appt.time)}
                    </Badge>
                  );
                })()}
                
                {showStatusBadge && getStatusBadge(appt)}
                
                {appt.isPriority && (
                  <Badge variant="default" className="ml-2 bg-amber-500 text-white hover:bg-amber-600 border-amber-600 flex gap-1 items-center">
                    <Star className="h-3 w-3 fill-current" />
                    Priority
                  </Badge>
                )}
                
                {!showStatusBadge && appt.status === 'Skipped' && (
                  <Badge variant="destructive" className="ml-2 bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-600">Late</Badge>
                )}
                
                {onUpdateStatus && isActionable && !showTopRightActions && (
                  <div className="flex-1 flex items-center gap-2 ml-2">
                    {(appt.status === 'Pending' || appt.status === 'Skipped' || appt.status === 'No-show') && (onAddToQueue || onRejoinQueue) && shouldShowConfirmArrival(appt) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRejoinQueue && (appt.status === 'Skipped' || appt.status === 'No-show')) onRejoinQueue(appt);
                              else onAddToQueue?.(appt);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Confirm Arrival</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {appt.status === 'Confirmed' && onUpdateStatus && !showTopRightActions && (
                      <div className="flex-1 flex items-center justify-between relative">
                        {appt.id === firstActionableAppointmentId && (
                          <div className="relative">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={cn(
                                    "h-7 w-7 transition-all duration-200 relative overflow-hidden select-none touch-none",
                                    pressState.id === appt.id ? "bg-yellow-100 border-yellow-300 scale-110" : "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200"
                                  )}
                                  disabled={isClinicOut}
                                  onMouseDown={(e) => onPressStart(e, appt.id)}
                                  onTouchStart={(e) => onPressStart(e, appt.id)}
                                  onMouseUp={(e) => onPressEnd(e)}
                                  onMouseLeave={(e) => onPressEnd(e)}
                                  onTouchEnd={(e) => onPressEnd(e)}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  <SkipForward className="h-4 w-4 relative z-10 pointer-events-none" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{pressState.id === appt.id ? "Hold to skip..." : "Hold 3s to Skip"}</p>
                              </TooltipContent>
                            </Tooltip>
                            {pressState.id === appt.id && (
                              <div className="absolute -right-3 top-0 h-full w-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="w-full bg-yellow-500 transition-all duration-[50ms] ease-linear absolute bottom-0"
                                  style={{ height: `${pressState.progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {appt.id === selectedAppointmentId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="icon"
                                className={cn(
                                  "h-10 w-10 text-white rounded-full shadow-lg ml-auto transition-all duration-300 hover:scale-110 hover:rotate-3",
                                  theme === 'modern' ? "bg-primary shadow-primary/30" : "bg-green-600 hover:bg-green-700"
                                )}
                                onClick={onCompleteClick}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                              >
                                <Check className="h-6 w-6" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Complete Appointment</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-start mt-1">
                <div className="flex items-center gap-2">
                  {showPositionNumber && (
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {currentPos}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <p className={cn("font-semibold", isInactive && 'line-through text-muted-foreground')}>
                      {(() => {
                        if (tokenDistribution === 'classic') {
                          if (appt.status === 'Pending' || !appt.classicTokenNumber) {
                            return appt.patientName;
                          }
                          return `#${appt.classicTokenNumber.toString().padStart(3, '0')} - ${appt.patientName}`;
                        }
                        return (['Completed', 'Cancelled', 'No-show'].includes(appt.status) || !appt.tokenNumber)
                          ? appt.patientName
                          : `#${appt.tokenNumber} - ${appt.patientName}`;
                      })()}
                    </p>
                    {appt.skippedAt && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-200 border-amber-400 text-amber-800 leading-none flex items-center justify-center font-bold">
                        Late
                      </Badge>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {(appt.age && appt.place) && (
                  <p className={cn("text-sm", isSwiping ? 'text-white/80' : 'text-muted-foreground')}>
                    {appt.age} yrs, {appt.place}
                  </p>
                )}
              </div>

              {isPhoneMode && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-10 gap-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200 font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onCallClick) onCallClick(e);
                    }}
                  >
                    <Phone className="h-4 w-4" />
                    <span>Call {appt.communicationPhone || 'No Number'}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

AppointmentCard.displayName = 'AppointmentCard';
