FROM python:3.12-slim

# libsndfile1: soundfile lo necesita para leer los WAV de la petición.
RUN apt-get update && \
    apt-get install -y --no-install-recommends libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces ejecuta el contenedor como uid 1000; sin este usuario, pip y las
# cachés de numba/librosa escriben en rutas sin permiso y el arranque falla.
RUN useradd --create-home --uid 1000 galena
USER galena
WORKDIR /home/galena/app
ENV PATH=/home/galena/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    NUMBA_CACHE_DIR=/tmp/numba \
    XDG_CACHE_HOME=/tmp/cache

COPY --chown=galena:galena requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

COPY --chown=galena:galena . .

# Ajustes para instancias pequeñas (Render Free: 512 MB), medidos con ese límite:
# - MALLOC_*: los arreglos grandes de numpy se devuelven al sistema al liberarse; sin esto la
#   memoria retenida crece de ~276 a ~417 MB tras algunas detecciones.
# - Una detección a la vez: dos llamadas simultáneas de 137 s tocan el límite. La segunda recibe 503.
# - Llamadas de hasta 150 s: una de 290 s con los detectores Galena no cabe en 512 MB. El sitio no
#   puede enviar más de ~137 s por el límite de 4.5 MB de Vercel.
# Las variables de entorno del servicio (p. ej. en Render) tienen prioridad sobre estos valores.
ENV MALLOC_MMAP_THRESHOLD_=131072 \
    MALLOC_TRIM_THRESHOLD_=131072 \
    MALLOC_ARENA_MAX=2 \
    GALENA_INFERENCE_SLOTS=1 \
    GALENA_MAX_SECONDS=150

# Render, Fly y Cloud Run inyectan $PORT; 7860 es el puerto por defecto.
ENV PORT=7860
EXPOSE 7860

# El lifespan de app.py carga los 6 detectores y calienta librosa/numba antes de aceptar
# tráfico, así que el arranque en frío tarda; un solo worker basta y evita duplicar memoria.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]
