"use client";

import { SWRConfig } from "swr";
import { AuthProvider } from "@/lib/auth-context";
import LearnerCacheWarmup from "@/components/LearnerCacheWarmup";

const swrOptions = {
  /** Dedupe identical requests within this window (ms). */
  dedupingInterval: 120_000,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  errorRetryCount: 2,
  /** Retry sooner after failure so transient errors recover quickly. */
  errorRetryInterval: 2_000,
  focusThrottleInterval: 300_000,
};

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig value={swrOptions}>
      <AuthProvider>
        {children}
        <LearnerCacheWarmup />
      </AuthProvider>
    </SWRConfig>
  );
}
