export function isUnderConstruction(): boolean {
  return process.env.UNDER_CONSTRUCTION === "true";
}
