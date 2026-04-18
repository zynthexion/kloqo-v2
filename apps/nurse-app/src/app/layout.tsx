import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ActiveIdentityProvider } from "@/contexts/ActiveIdentityContext";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import WakeLockHandler from "@/components/WakeLockHandler";
import AddToHomeScreenPrompt from "@/components/AddToHomeScreenPrompt";
import { DailyReminderHandler } from "@/components/clinic/DailyReminderHandler";
import { NurseDashboardProvider } from "@/contexts/NurseDashboardContext";
import { AppGuard } from "@/components/layout/AppGuard";
import { KloqoIntegrationProvider } from "@/contexts/KloqoIntegrationProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <title>Kloqo Nurse</title>
        <meta name="description" content="Nurse app for managing clinic appointments." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        {/* Critical CSS moved to globals.css */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Michroma&display=swap"
          as="style"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Michroma&display=swap"
        />
        <meta name="theme-color" content="#256cad" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kloqo Nurse" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={cn("antialiased min-h-screen font-body bg-muted/20 font-sans")}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <ActiveIdentityProvider>
                <NurseDashboardProvider>
                  <KloqoIntegrationProvider>
                    <GlobalErrorHandler />
                    <WakeLockHandler />
                    <DailyReminderHandler />
                    <AppGuard>
                      {children}
                    </AppGuard>
                    <AddToHomeScreenPrompt />
                    <Toaster />
                  </KloqoIntegrationProvider>
                </NurseDashboardProvider>
              </ActiveIdentityProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
