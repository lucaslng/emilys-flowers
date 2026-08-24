// Exempt from the under-construction gate (which lives in the (store) layout)
// so the owner can review orders while the storefront is down.

import type { ReactNode } from "react";
import StoreShell from "@/components/layout/StoreShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}