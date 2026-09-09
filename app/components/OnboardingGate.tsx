"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadBudget } from "../lib/budgetStorage";

/**
 * Redirect-only gate. Sends first-time visitors to /onboarding and finished
 * users away from it, but never hides its children: every page renders its
 * own loading skeleton on the server and on the first client frame, so there
 * is no blank frame while the decision is made. When a redirect fires, the
 * skeleton (or page) is simply replaced by the destination route.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const complete = !!loadBudget()?.meta?.onboardingComplete;
    const onOnboarding = pathname === "/onboarding";
    if (!complete && !onOnboarding) router.replace("/onboarding");
    else if (complete && onOnboarding) router.replace("/");
  }, [pathname, router]);

  return <>{children}</>;
}
