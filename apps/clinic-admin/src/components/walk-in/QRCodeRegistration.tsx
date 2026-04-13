'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface QRCodeRegistrationProps {
  qrCodeUrl: string;
}

export function QRCodeRegistration({ qrCodeUrl }: QRCodeRegistrationProps) {
  return (
    <Card className="w-full text-center shadow-lg mt-4">
      <CardHeader>
        <CardTitle className="text-2xl">Scan to Register</CardTitle>
        <CardDescription>Scan the QR code with a phone to register.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center">
        {qrCodeUrl ? (
          <div className="p-4 bg-white rounded-lg border">
            <Image
              src={qrCodeUrl}
              alt="QR Code for appointment booking"
              width={250}
              height={250}
            />
          </div>
        ) : (
          <div className="w-[250px] h-[250px] bg-gray-200 flex items-center justify-center rounded-lg">
            <p className="text-muted-foreground">QR Code not available</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-4">Follow the instructions on your phone.</p>
      </CardContent>
    </Card>
  );
}
