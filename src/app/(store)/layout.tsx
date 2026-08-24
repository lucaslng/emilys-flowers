// Storefront routes live in the `(store)` route group (URL-transparent) so the
// under-construction gate applies to them but NOT to /admin/* (which has its
// own layout at src/app/admin/layout.tsx).

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