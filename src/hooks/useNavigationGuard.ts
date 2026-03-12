import { useEffect, useCallback, useState, useRef } from 'react';

/**
 * Prevents accidental navigation away from a page with unsaved changes.
 * - Adds beforeunload browser prompt
 * - Prevents back/forward browser navigation via history manipulation
 * - Prevents edge-swipe back gesture on touch devices
 */
export const useNavigationGuard = (shouldBlock: boolean) => {
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const isLeavingRef = useRef(false);

  // Browser beforeunload
  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isLeavingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  // Push extra history entry & catch popstate to block browser back
  useEffect(() => {
    if (!shouldBlock) return;
    
    // Push a guard state
    window.history.pushState({ guard: true }, '');
    
    const handlePopState = (e: PopStateEvent) => {
      // If user confirmed leave, don't block
      if (isLeavingRef.current) return;
      // Re-push to prevent leaving
      window.history.pushState({ guard: true }, '');
      setShowLeaveDialog(true);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldBlock]);

  // Prevent edge swipe gestures
  useEffect(() => {
    if (!shouldBlock) return;
    
    let startX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isLeavingRef.current) return;
      // If swipe started from edge (< 30px), prevent it
      if (startX < 30 || startX > window.innerWidth - 30) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [shouldBlock]);

  const requestLeave = useCallback((action: () => void) => {
    if (shouldBlock) {
      setPendingAction(() => action);
      setShowLeaveDialog(true);
    } else {
      action();
    }
  }, [shouldBlock]);

  const confirmLeave = useCallback(() => {
    isLeavingRef.current = true;
    setShowLeaveDialog(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const cancelLeave = useCallback(() => {
    setShowLeaveDialog(false);
    setPendingAction(null);
  }, []);

  return { showLeaveDialog, requestLeave, confirmLeave, cancelLeave };
};
