import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Clinic } from './use-clinic-data';

const loadQRScanner = () => import('html5-qrcode').then(module => module.Html5Qrcode);

interface QRScannerProps {
    clinic: Clinic | null;
    clinicId: string | null;
    checkLocation: () => Promise<any>;
    setLocationError: (error: string | null) => void;
    setPermissionGranted: (granted: boolean) => void;
}

export function useQRScanner({
    clinic,
    clinicId,
    checkLocation,
    setLocationError,
    setPermissionGranted
}: QRScannerProps) {
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const router = useRouter();

    const handleCameraScan = () => {
        if (!showQRScanner || !clinic) return;

        setIsScanning(true);

        checkLocation().then(result => {
            if (!result.allowed) {
                setLocationError(result.error || 'Location check failed');
                setIsScanning(false);
                return;
            }

            loadQRScanner().then(Html5Qrcode => {
                const html5Qrcode = new Html5Qrcode("qr-reader");
                return html5Qrcode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText) => {
                        html5Qrcode.stop().then(() => {
                            setIsScanning(false);
                            setShowQRScanner(false);

                            try {
                                const url = new URL(decodedText);
                                const params = new URLSearchParams(url.search);
                                const scannedClinicId = params.get('clinicId');

                                if (scannedClinicId && scannedClinicId === clinicId) {
                                    setPermissionGranted(true);
                                } else {
                                    router.push('/login');
                                }
                            } catch (error) {
                                router.push('/login');
                            }
                        });
                    },
                    (errorMessage) => {
                        // Handle scan errors silently
                    }
                ).catch(err => {
                    console.error("QR scan error:", err);
                    setIsScanning(false);
                    setShowQRScanner(false);
                });
            }).catch(err => {
                console.error("Error loading QR scanner:", err);
                setIsScanning(false);
                setShowQRScanner(false);
            });
        });
    };

    return {
        showQRScanner,
        setShowQRScanner,
        isScanning,
        setIsScanning,
        handleCameraScan
    };
}
