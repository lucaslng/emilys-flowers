import { isFlowersEnabled } from "@/lib/flowers-flag";
import NotFoundClient from "./not-found-client";

export default async function NotFound() {
  const showFlowers = await isFlowersEnabled();
  return <NotFoundClient showFlowers={showFlowers} />;
}