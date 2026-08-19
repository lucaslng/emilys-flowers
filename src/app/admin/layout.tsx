// src/app/admin/layout.tsx
//
// Admin routes are exempt from the under-construction gate (the gate lives in
// src/app/(store)/layout.tsx), so the owner can review orders and send
// shipping notifications while the storefront is down.

import type { ReactNode } from "react";
import StoreShell from "@/components/layout/StoreShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}