// Shared pure helper — safe for both Node-only build-time modules and
// Workers-safe runtime code.

/** Derive a URL slug from a product name, e.g. "Cream White Rose" → "cream-white-rose". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
