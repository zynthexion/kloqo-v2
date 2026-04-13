import { useState, useCallback } from 'react';

export function usePrescriptionViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);

  const openViewer = useCallback((url: string) => {
    setPrescriptionUrl(url);
    setIsOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setPrescriptionUrl(null), 300); // Clear after transiton
  }, []);

  return { 
    isOpen, 
    prescriptionUrl, 
    openViewer, 
    closeViewer 
  };
}
