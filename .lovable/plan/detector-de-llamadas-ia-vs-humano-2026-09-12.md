# Detector de llamadas IA vs. Humano

Panel web con barra lateral para analizar llamadas y ver si fueron hechas por una IA o por una persona.

## Identidad visual

- Naranja `#FF671F` como color principal (acciones, acentos)
- Azul profundo `#003049` para superficies y encabezados
- Arena `#EAD7D1` para fondos suaves y bordes
- Casi negro `#0D1117` como fondo del modo oscuro
- Componentes shadcn en toda la interfaz

## Barra lateral (colapsable)

Detector · History · API · Model

## Detector (pantalla principal)

- Dos formas de enviar datos: pegar el JSON de la llamada o subir un archivo de audio
- Resultado grande: recuadro **Human** (verde), **AI** (rojo) o **Loading** (gris)
- Velocímetro semicircular animado de rojo a verde con la confianza de 0 a 1
- Selector de modelo arriba del resultado
- Datos de la llamada analizada (duración, id, origen) junto al resultado

## History

Tabla tipo registro con las últimas solicitudes: fecha/hora, id de llamada, modelo usado, resultado, confianza y tiempo de respuesta. Búsqueda, filtro por resultado y clic en una fila para ver el detalle.

Mientras la base de datos de TigerData esté en construcción, el historial vive en el navegador durante la sesión y el código incluye comentarios marcando exactamente dónde conectar TigerData después.

## API

Pantalla de configuración: URL del modelo, clave/token, tiempo de espera, modelo por defecto, y un botón de "probar conexión". También muestra el ejemplo del JSON que la página acepta y la dirección del endpoint propio de la app para que otros sistemas le envíen llamadas.

## Model

Fichas de cada modelo disponible con su versión, descripción y estado, más gráficas interactivas (con etiquetas al pasar el cursor) de sus métricas: precisión, recall, F1, AUC, matriz de confusión y precisión a lo largo del tiempo.

## Detalles técnicos

- Rutas TanStack: `/` (Detector), `/history`, `/api-config`, `/model`
- Tokens de color en `src/styles.css` (oklch), sidebar de shadcn, recharts para el velocímetro y las métricas
- Endpoints propios en la app con datos simulados, comentados para el reemplazo real:
  - `POST /api/public/detect` — recibe el JSON de la llamada y devuelve `is_synthetic`, `confidence`, `model`, `latency_ms`
  - `POST /api/public/detect/audio` — recibe el archivo de audio
  - `GET /api/public/models` — lista de modelos y métricas
- Cada handler lleva un bloque `// TODO: conectar modelo real` con la forma exacta del fetch al backend y la variable de entorno de la clave
- Un módulo `src/lib/tigerdata.ts` con la interfaz de historial (guardar/listar) implementada en memoria y comentarios de conexión a TigerData
- Validación de entrada con Zod; sin credenciales en el navegador
