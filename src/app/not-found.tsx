import { isFlowersEnabled, isUnderConstruction } from "@/lib/flagship-flag";
import UnderConstruction from "@/components/under-construction";
import StoreShell from "@/components/layout/StoreShell";
import NotFoundClient from "./not-found-client";

export default function NotFound() {
  if (isUnderConstruction()) {
    return <UnderConstruction />;
  }
  const showFlowers = isFlowersEnabled();
  return (
    <StoreShell>
      <NotFoundClient showFlowers={showFlowers} />
    </StoreShell>
  );
}
