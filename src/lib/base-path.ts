/**
 * Prefijo público de la app. En producción es "" (sitio en /); la instancia dev se compila con
 * APP_BASE_PATH=/dev/ y vive en https://galenia.tech/dev. Las rutas del router ya lo aplican
 * solas; esto es para lo que no pasa por el router (fetch, imágenes de /public, redirects).
 */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

export function withBase(path: string) {
  return `${BASE_PATH}${path}`;
}
