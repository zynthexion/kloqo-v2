"use client";

import { useEffect } from "react";
import { ResponsiveAppLayout } from "@/components/layout/ResponsiveAppLayout";
import { NurseDesktopShell } from "@/components/layout/NurseDesktopShell";
import { useActiveIdentity } from "@/hooks/useActiveIdentity";

// Phase 5: Modular Components & Hooks
import { useDaySnapshot } from "@/hooks/use-day-snapshot";
import { MobileSnapshotView } from "@/components/day-snapshot/MobileSnapshotView";
import { TabletSnapshotView } from "@/components/day-snapshot/TabletSnapshotView";

export default function DaySnapshotPage() {
  const state = useDaySnapshot();
  const { activeRole } = useActiveIdentity();

  // Auth guard
  useEffect(() => {
    if (!state.authLoading && !state.user) window.location.href = "/login";
  }, [state.user, state.authLoading]);

  return (
    <ResponsiveAppLayout 
      mobile={<MobileSnapshotView {...state} activeRole={activeRole || ''} />} 
      tablet={
        activeRole === "nurse" ? (
          <NurseDesktopShell>
             <TabletSnapshotView {...state} activeRole={activeRole || ''} />
          </NurseDesktopShell>
        ) : (
          <TabletSnapshotView {...state} activeRole={activeRole || ''} />
        )
      } 
    />
  );
}
