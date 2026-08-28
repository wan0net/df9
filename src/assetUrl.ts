/** Resolve a public runtime file beneath Vite's configured deployment base. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
