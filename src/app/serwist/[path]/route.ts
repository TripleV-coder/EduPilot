import { createSerwistRoute } from "@serwist/turbopack";

/**
 * Route handler Serwist (mode Turbopack) : compile src/app/sw.ts à la volée
 * et sert le service worker compilé sous /serwist/*.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [
      // Page hors-ligne : pre-rendue au build (force-static), servie par le
      // service worker quand le réseau est indisponible. La révision change
      // à chaque build pour invalider les caches navigateur obsolètes.
      { url: "/offline", revision: new Date().toISOString() },
    ],
  });
