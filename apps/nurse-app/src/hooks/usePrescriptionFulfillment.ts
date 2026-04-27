import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { Appointment } from '@kloqo/shared';

type Tab = 'queue' | 'search';

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function usePrescriptionFulfillment() {
  const { user, logout } = useAuth();
  const clinicId = user?.clinicId;

  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Appointment[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Modals
  const [dispenseTarget, setDispenseTarget] = useState<Appointment | null>(null);
  const [billValue, setBillValue] = useState('');
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [dispensing, setDispensing] = useState(false);

  const [abandonTarget, setAbandonTarget] = useState<Appointment | null>(null);
  const [abandonReason, setAbandonReason] = useState('');
  const [abandoning, setAbandoning] = useState(false);

  // Print support
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const fetchQueue = useCallback(async () => {
    if (!clinicId) return;
    setLoadingQueue(true);
    try {
      const data = await apiRequest<Appointment[]>(`/clinic/prescriptions?clinicId=${clinicId}&pharmacyStatus=pending`);
      setQueue((data || []).sort((a, b) => {
        const aTime = toDate(a.completedAt)?.getTime() ?? 0;
        const bTime = toDate(b.completedAt)?.getTime() ?? 0;
        return aTime - bTime;
      }));
    } catch (e) {
      console.error('[Fulfillment] Queue Fetch Error:', e);
    } finally {
      setLoadingQueue(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleSearch = useCallback(async () => {
    const cleanPhone = searchQuery.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      alert('🔒 Privacy Check: Please enter a full 10-digit phone number to retrieve history.');
      return;
    }
    if (!clinicId) return;
    
    setLoadingSearch(true);
    try {
      const data = await apiRequest<Appointment[]>(`/clinic/prescriptions?clinicId=${clinicId}&patientPhone=${cleanPhone}`);
      setSearchResults(data || []);
    } catch (e) {
      console.error('[Fulfillment] Search Error:', e);
    } finally {
      setLoadingSearch(false);
    }
  }, [clinicId, searchQuery]);

  const confirmDispense = useCallback(async () => {
    if (!dispenseTarget) return;
    setDispensing(true);
    try {
      await apiRequest(`/prescriptions/${dispenseTarget.id}/dispense`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          billValue: billValue ? Number(billValue) : undefined,
          notes: dispenseNotes.trim() || undefined
        }),
      });
      setQueue(prev => prev.filter(a => a.id !== dispenseTarget.id));
      setDispenseTarget(null);
      setBillValue('');
      setDispenseNotes('');
      alert('Order Fulfilled');
    } catch (e) {
      console.error('[Fulfillment] Dispense Error:', e);
    } finally {
      setDispensing(false);
    }
  }, [billValue, dispenseNotes, dispenseTarget]);

  const confirmAbandon = useCallback(async () => {
    if (!abandonTarget || !abandonReason) return;
    setAbandoning(true);
    try {
      await apiRequest(`/prescriptions/${abandonTarget.id}/abandon`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: abandonReason }),
      });
      setQueue(prev => prev.filter(a => a.id !== abandonTarget.id));
      setAbandonTarget(null);
      setAbandonReason('');
    } catch (e) {
      console.error('[Fulfillment] Abandon Error:', e);
    } finally {
      setAbandoning(false);
    }
  }, [abandonReason, abandonTarget]);

  const handleBrandedPrint = useCallback((appt: Appointment) => {
    if (!printIframeRef.current || !appt.prescriptionUrl) return;

    const iframe = printIframeRef.current;
    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Prescription - ${appt.patientName}</title>
          <style>
            @page { margin: 10mm; size: A4; }
            body { font-family: sans-serif; margin: 0; padding: 20px; color: #1e293b; }
            header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
            .clinic-info h1 { font-size: 24px; color: #1e3a8a; margin: 0; }
            .clinic-info p { font-size: 12px; color: #64748b; margin: 2px 0; }
            .patient-meta { background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border: 1px solid #e2e8f0; }
            .patient-meta div b { font-size: 10px; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px; }
            .patient-meta div span { font-weight: 700; font-size: 14px; }
            .rx-container { text-align: center; }
            .rx-image { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
            footer { position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          </style>
        </head>
        <body>
          <header>
            <div class="clinic-info">
              <h1>${(user as any)?.clinicName || 'Digital Prescription'}</h1>
              <p>Clinical Fulfillment Record</p>
            </div>
            <div style="text-align: right">
              <div style="font-weight: 800; color: #3b82f6; font-size: 20px;">#${appt.tokenNumber || '---'}</div>
              <div style="font-size: 10px; color: #94a3b8;">${new Date().toLocaleDateString()}</div>
            </div>
          </header>

          <div class="patient-meta">
            <div><b>Patient Name</b><span>${appt.patientName}</span></div>
            <div><b>Consulting Doctor</b><span>Dr. ${appt.doctorName}</span></div>
            <div><b>Date</b><span>${toDate(appt.completedAt)?.toLocaleDateString() || '--'}</span></div>
            <div><b>Status</b><span>Order Fulfilled</span></div>
          </div>

          <div class="rx-container">
            <img src="${appt.prescriptionUrl}" class="rx-image" />
          </div>

          <footer>
            This is a computer-generated prescription fulfilled at ${(user as any)?.clinicName}. 
            Powered by Kloqo V2.
          </footer>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  }, [user]);

  return {
    user,
    logout,
    activeTab,
    setActiveTab,
    queue,
    searchQuery,
    setSearchQuery,
    searchResults,
    loadingQueue,
    loadingSearch,
    viewerUrl,
    setViewerUrl,
    dispenseTarget,
    setDispenseTarget,
    billValue,
    setBillValue,
    dispenseNotes,
    setDispenseNotes,
    dispensing,
    abandonTarget,
    setAbandonTarget,
    abandonReason,
    setAbandonReason,
    abandoning,
    printIframeRef,
    handleSearch,
    confirmDispense,
    confirmAbandon,
    handleBrandedPrint
  };
}
