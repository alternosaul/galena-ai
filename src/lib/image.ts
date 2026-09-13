/**
 * Recorta al centro y reduce una imagen a un cuadrado de `size` px (JPEG).
 * Mantiene el avatar pequeño mientras se guarda en el navegador.
 * TODO(auth): al tener backend, subir el archivo a storage y guardar solo la URL.
 */
export async function resizeImageToSquare(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");

    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
