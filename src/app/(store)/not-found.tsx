import { isFlowersEnabled } from "@/lib/flowers-flag";
import NotFoundClient from "../not-found-client";

export default function StoreNotFound() {
  const showFlowers = isFlowersEnabled();
  return <NotFoundClient showFlowers={showFlowers} />;
}