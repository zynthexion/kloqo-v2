import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LocationStatusCardProps {
  isCheckingLocation: boolean;
  locationError: string | null;
  isLocationValid: boolean;
  onCheckLocation: () => void;
}

export function LocationStatusCard({
  isCheckingLocation,
  locationError,
  isLocationValid,
  onCheckLocation
}: LocationStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCheckingLocation ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Checking location...</span>
          </div>
        ) : locationError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Location Error</AlertTitle>
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        ) : isLocationValid ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Location Verified</AlertTitle>
            <AlertDescription className="text-green-700">
              You are within 200m of the clinic.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Location Not Verified</AlertTitle>
            <AlertDescription>
              Please allow location access to confirm arrival.
            </AlertDescription>
          </Alert>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onCheckLocation}
          disabled={isCheckingLocation}
        >
          {isCheckingLocation ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Check Location'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
