// The (store) route group scopes the under-construction gate to storefront
// routes only — /admin/* has its own layout and stays reachable.

import type { ReactNode } from "react";
import { isUnderConstruction } from "@/lib/flagship-flag";
import UnderConstruction from "@/components/under-construction";
import StoreShell from "@/components/layout/StoreShell";

export default function StoreLayout({ children }: { children: ReactNode }) {
  if (isUnderConstruction()) {
    return <UnderConstruction />;
  }
  return <StoreShell>{children}</StoreShell>;
}