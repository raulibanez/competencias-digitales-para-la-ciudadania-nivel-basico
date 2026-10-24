# Competencias digitales para la ciudadanía · Nivel básico

Curso de autoformación (unas 14 horas) para preparar el examen de competencias digitales para la ciudadanía, nivel básico, de tuCertiCyL (Junta de Castilla y León). Está pensado para alumnos de 1.º de Sistemas Microinformáticos y Redes, pero sirve a cualquier persona.

Está basado en el curso «Soy competente digital: construye tu mejor versión digital», de CyL Digital (Junta de Castilla y León), y en la demo del examen de tuCertiCyL.

Son presentaciones web 16:9 con buscador, ejercicios interactivos y un simulacro del examen. Material no oficial: no está hecho ni revisado por la Junta de Castilla y León.

## Estructura

```
index.html          Portada con los temas y el progreso de cada uno
assets/             Motor de diapositivas (deck-stage.js), estilos (cdc.css), ejercicios y simulaciones (cdc.js), imágenes comunes
tema0/ … tema5/     Una presentación por tema: index.html, img/ (ia/ generadas, cyl/ de CyL Digital), sim/ (simulaciones) y retos/
simulacro/          Pantalla tipo examen: demo oficial (20 preguntas) y simulacro de 63 preguntas sacadas de los temas
herramientas/       recorta-iconos.py (hojas de iconos generadas → WebP), mosaico.py (revisar capturas) y emulador-pose.js (mover la cámara del emulador de Android)
```

| Tema | Contenido |
|---|---|
| 0 | El examen tuCertiCyL |
| 1 | Buscar y gestionar información |
| 2 | Comunicación y colaboración |
| 3 | Creación de contenidos |
| 4 | Seguridad, bienestar y uso responsable |
| 5 | Resolución de problemas |

## Cómo se construye un tema

1. Se prepara y revisa el guion del tema (material de trabajo, fuera del repositorio).
2. Con el guion aprobado se escribe `temaN/index.html`: una `<section>` por diapositiva dentro de `<deck-stage>`, con las clases de `assets/cdc.css`.
3. Las ilustraciones se generan en el estilo del curso (formas translúcidas con los colores de cada área) y se recortan a WebP en `temaN/img/ia/`. Las imágenes de CyL Digital van en `temaN/img/cyl/`, siempre con su crédito.
4. Se publica en GitHub Pages y se enlaza desde `index.html`.

## Preguntas y ejercicios

Las preguntas se escriben en JSON dentro de la diapositiva y `assets/cdc.js` las monta:

```html
<div class="preg-bloque"><script type="application/json">
  {"tipo": "test", "enunciado": "…", "opciones": ["…", "…"], "correcta": 1, "explicacion": "…"}
</script></div>
```

- Tipos: `test` (una o varias respuestas, con imágenes en las opciones o en el enunciado), `emparejar`, `ordenar`, `reto` (archivo para descargar y respuesta escrita o de opción) y `simulacion`.
- `<div class="comprueba" data-comp="4.1">` con una lista de 3 preguntas: el **Comprueba** de cada competencia. El resultado se guarda en el navegador (`localStorage`, clave `cdc-progreso`) y lo muestran el índice del tema, el cierre y la portada del curso.
- `<div class="repaso-test">` con una lista de preguntas: test de repaso con el botón **Otra pregunta**.
- Simulaciones de imagen: los datos van en `temaN/sim/*.js` con `CDC.sim('id', {inicio, ancho, alto, pantallas})`; cada pantalla tiene su imagen y sus zonas de clic (`clic` o `clic-derecho`) y la pantalla a la que llevan. Es el mismo formato que las simulaciones de la demo de tuCertiCyL. Se puede fallar un clic; el segundo fallo anula la pregunta, como en el examen.
- Simulaciones HTML (pantallas de móvil): una `<template>` con varias `.pantalla-html`; los elementos con `data-ir` llevan a otra pantalla y la que tiene `data-final` es la correcta.

## Ver las presentaciones en local

```
python -m http.server 8000
```

y abre `http://localhost:8000/`. Teclas: flechas para avanzar, **B** para buscar en el tema, **P** pantalla completa.

## Licencia

- **Contenido propio** (diapositivas, textos, preguntas e imágenes propias): [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es) — ver `LICENSE`. Se puede copiar y adaptar sin fines comerciales, citando la autoría y compartiendo el resultado con la misma licencia.
- **Código propio**: [MIT](LICENSE-CODE). Son estos archivos:
  - `assets/cdc.js` y `assets/cdc.css`.
  - `simulacro/simulacro.js` y `simulacro/simulacro.css`.
  - Los programas de `herramientas/`.
  - El CSS y el JavaScript escritos dentro de las páginas `index.html` (portada, temas y simulacro).
- **No entran en estas licencias:**
  - `assets/deck-stage.js`, el componente `<deck-stage>` que mueve las diapositivas. No es código propio: está copiado de la plantilla «omelette starter», como dice su cabecera.
  - `assets/img/logo-centro-didactico.webp`, el logo de Centro Didáctico. Es la marca del centro y no se licencia.
  - Los datos de la demo de tuCertiCyL (Junta de Castilla y León): sus preguntas (el JSON de `simulacro/index.html`), imágenes, archivos de los retos, pantallas y zonas de clic. Están en `simulacro/demo/` y en los archivos de los temas que citan la demo (`sim/*.js`, `img/cyl/`, `retos/`). La demo se usa sin fines comerciales, citando la fuente.
  - El material de CyL Digital. Parte de los textos, imágenes y preguntas procede del curso «Soy competente digital: construye tu mejor versión digital», de CyL Digital (Junta de Castilla y León). CyL Digital publica sus contenidos formativos con licencia Creative Commons, uso no comercial, citando la fuente. Cada diapositiva o pregunta que usa ese material lo indica.
  - Otras imágenes de terceros: cada una lleva su crédito y su licencia.

Atribución: «*Competencias digitales para la ciudadanía · Nivel básico*, basado en «Soy competente digital», de CyL Digital (Junta de Castilla y León). Adaptación: Raúl Ibáñez, 2026. CC BY-NC-SA 4.0».
