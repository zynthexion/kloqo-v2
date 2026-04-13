import { useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import type { Appointment } from '@kloqo/shared';

export function useAppointmentInteractions({
  swipeEnabled,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onPriorityToggle,
  onSkipComplete
}: {
  swipeEnabled: boolean;
  onSwipeStart: (e: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>, id: string) => void;
  onSwipeMove: (e: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>) => void;
  onSwipeEnd: () => void;
  onPriorityToggle?: (appt: Appointment) => void;
  onSkipComplete: (id: string) => void;
}) {
  const [showSkipConfirm, setShowSkipConfirm] = useState<string | null>(null);
  const [pressState, setPressState] = useState<{ id: string | null; type: 'skip' | 'priority' | null; progress: number }>({ id: null, type: null, progress: 0 });
  const pressStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const startPosRef = useRef<{ x: number, y: number } | null>(null);

  const handlePressStart = (e: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>, id: string, isSwiping: boolean) => {
    e.stopPropagation();
    if (e.type === 'touchstart') e.preventDefault();
    if (isSwiping) return; 

    setPressState({ id, type: 'skip', progress: 0 });
    pressStartTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - pressStartTimeRef.current;
      const progress = Math.min((elapsed / 3000) * 100, 100); 

      setPressState(prev => ({ ...prev, progress }));

      if (progress < 100) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        onSkipComplete(id);
        setPressState({ id: null, type: null, progress: 0 });
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handlePressEnd = (e?: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>) => {
    if (e) {
      e.stopPropagation();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setPressState({ id: null, type: null, progress: 0 });
  };

  const handleCardTouchStart = (e: ReactTouchEvent<HTMLElement> | ReactMouseEvent<HTMLElement>, appt: Appointment, isSwiping: boolean) => {
    if (pressState.id || isSwiping) return;

    if (swipeEnabled) onSwipeStart(e, appt.id);

    if (appt.status !== 'Pending' && appt.status !== 'Confirmed') return;
    if (appt.isPriority) return; 

    const touch = 'touches' in e ? (e as ReactTouchEvent).touches[0] : (e as ReactMouseEvent);
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    pressStartTimeRef.current = Date.now();

    setPressState({ id: appt.id, type: 'priority', progress: 0 });

    const animate = () => {
      const elapsed = Date.now() - pressStartTimeRef.current;
      const progress = Math.min((elapsed / 800) * 100, 100); 

      setPressState(prev => ({ ...prev, progress }));

      if (progress < 100) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        if (onPriorityToggle) onPriorityToggle(appt);
        setPressState({ id: null, type: null, progress: 0 });
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleCardTouchMove = (e: ReactTouchEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) => {
    if (swipeEnabled) onSwipeMove(e);

    if (pressState.type === 'priority' && startPosRef.current) {
      const touch = 'touches' in e ? (e as ReactTouchEvent<HTMLElement>).touches[0] : (e as ReactMouseEvent<HTMLElement>);
      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);

      if (dx > 10 || dy > 10) { 
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setPressState({ id: null, type: null, progress: 0 });
        startPosRef.current = null;
      }
    }
  };

  const handleCardTouchEnd = (e: ReactTouchEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) => {
    if (swipeEnabled) onSwipeEnd();

    if (pressState.type === 'priority') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setPressState({ id: null, type: null, progress: 0 });
    }
    startPosRef.current = null;
  };

  return {
    pressState,
    showSkipConfirm,
    setShowSkipConfirm,
    handlePressStart,
    handlePressEnd,
    handleCardTouchStart,
    handleCardTouchMove,
    handleCardTouchEnd
  };
}
