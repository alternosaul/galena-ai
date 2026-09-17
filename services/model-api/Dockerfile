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

# Spaces expone 7860. Render, Fly y Cloud Run inyectan $PORT.
ENV PORT=7860
EXPOSE 7860

# El lifespan de app.py carga los 6 detectores y calienta librosa/numba antes de aceptar
# tráfico, así que el arranque en frío tarda; un solo worker basta y evita duplicar memoria.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]
