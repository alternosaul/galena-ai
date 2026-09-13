# Call Insight Dashboard

necesito una pagina web construida en react usando componentes de shadcn, usando los siguientes colores #FF671F ; #003049 ; #EAD7D1 ; #0D1117

La pagina web recibe requests en json con informacion sobre datos de llamadas busca identificar si la llamada esta echa con un agente de IA o si es humano necesitamos mostrar las estadisticas de ese resultado

is_syntethic como bolean (muestra un recuadro verde/rojo/ gris con el texto Human, AI, Loading 

una grafica tipo velocimetro de rojo a verde para mostrar la confianza de 0-1 del resultado del modelo 

(el modelo esta hosteado en el backend)

en modelo 
una graficas de metricas de rendimiento del modelo interactivas (hover con labels) modelo y otras metricas importantes 


quiero una barra lateral con acceso a los menus 

Detector - Dashboard principal con la grafica de velocimetro y el lector de confianza, selector de modelo 
History - Tabla (log-like) con toda la informacion de las ultimas solicitudes
Api - configuracion de la API al modelo 
Model - Informacion sobre el/los Modelos

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ddbb3259-9c4d-402a-9a76-0291e3103920).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
