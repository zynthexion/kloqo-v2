import { useRef, useState, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';

type SwipeState = { id: string | null; startX: number; currentX: number; width: number };
const createSwipeState = (): SwipeState => ({ id: null, startX: 0, currentX: 0, width: 0 });

export function useSwipeable({ swipeEnabled, onSwipeComplete }: { swipeEnabled: boolean, onSwipeComplete: (id: string) => void }) {
  const [swipeState, setSwipeState] = useState<SwipeState>(createSwipeState);
  const swipeDataRef = useRef<SwipeState>(createSwipeState());
  const swipedItemRef = useRef<HTMLDivElement | null>(null);

  const handleSwipeStart = (e: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>, id: string) => {
    if (!swipeEnabled) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const target = e.currentTarget as HTMLElement | null;
    const width = target?.offsetWidth ?? 0;
    const nextState: SwipeState = { id, startX: clientX, currentX: clientX, width };
    swipeDataRef.current = nextState;
    setSwipeState(nextState);
  };

  const handleSwipeMove = (e: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>) => {
    if (!swipeEnabled || swipeDataRef.current.id === null) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    swipeDataRef.current = { ...swipeDataRef.current, currentX: clientX };
    setSwipeState({ ...swipeDataRef.current });
  };

  const handleSwipeEnd = () => {
    if (!swipeEnabled || swipeDataRef.current.id === null) return;

    const { id, currentX, startX, width } = swipeDataRef.current;
    const deltaX = currentX - startX;
    const swipeWidth = width || swipedItemRef.current?.offsetWidth || 0;
    const swipeThreshold = swipeWidth * 0.6;

    if (swipeThreshold === 0) {
      const reset = createSwipeState();
      swipeDataRef.current = reset;
      setSwipeState(reset);
      return;
    }

    if (deltaX < -swipeThreshold) {
      onSwipeComplete(id);
    }

    const reset = createSwipeState();
    swipeDataRef.current = reset;
    setSwipeState(reset);
  };

  const getSwipeStyle = (id: string): React.CSSProperties => {
    if (!swipeEnabled || swipeState.id !== id) return { transition: 'transform 0.2s ease-out, background-color 0.2s ease-out' };

    const deltaX = swipeState.currentX - swipeState.startX;
    const limitedDeltaX = Math.min(0, deltaX);
    const baseWidth = swipeState.width || swipedItemRef.current?.offsetWidth || 300;
    const opacity = Math.min(Math.abs(limitedDeltaX) / (baseWidth * 0.7 || 1), 0.7);

    return {
      transform: `translateX(${limitedDeltaX}px)`,
      backgroundColor: `rgba(4, 120, 87, ${opacity})`,
      transition: swipeState.id === null ? 'transform 0.2s ease-out, background-color 0.2s ease-out' : 'none',
    };
  };

  return {
    swipeState,
    swipedItemRef,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
    getSwipeStyle
  };
}
