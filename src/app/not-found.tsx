import { isFlowersEnabled } from "@/lib/flowers-flag";
import NotFoundClient from "./not-found-client";

export default function NotFound() {
  const showFlowers = isFlowersEnabled();
  return <NotFoundClient showFlowers={showFlowers} />;
}