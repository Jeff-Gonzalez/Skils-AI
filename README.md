# Refugio Natural — Mindfulness en Realidad Virtual

Página web autocontenida que simula un escenario natural (bosque con lago al
atardecer) para practicar mindfulness y respiración consciente. Funciona en
navegador de escritorio, móvil, y en visores de realidad virtual compatibles
con WebXR (Meta Quest, etc.).

## Qué incluye

- **Escena 3D procedural** construida con [three.js](https://threejs.org/):
  terreno con colinas suaves, lago con oleaje animado, árboles de baja
  poligonización, montañas de fondo, luciérnagas y aves — todo generado por
  código, sin imágenes ni modelos externos.
- **Guía de respiración 3D**: una esfera luminosa flotando sobre el lago que
  se expande y contrae siguiendo el patrón de respiración elegido, visible
  tanto en pantalla como dentro del visor VR.
- **Tres patrones de respiración**: caja (4-4-4-4), 4-7-8 y respiración
  coherente (5-5), con duración de sesión configurable (3, 5, 10, 15 min o
  libre).
- **Paisaje sonoro generado por síntesis** (viento, agua y una campanilla en
  cada cambio de fase) usando la Web Audio API — no depende de archivos de
  audio externos.
- **Soporte WebXR**: si el navegador y el dispositivo lo permiten, aparece un
  botón "Entrar en RV" para vivir la experiencia en inmersión completa. Si no
  hay visor disponible, la experiencia se controla arrastrando/tocando la
  pantalla (cámara orbital limitada para evitar mareo).

## Cómo probarla

Al ser HTML/CSS/JS estático (sin build), basta con servirla con cualquier
servidor local, por ejemplo:

```bash
python3 -m http.server 8080
```

y abrir `http://localhost:8080` en el navegador. Para probar el modo VR
necesitas un navegador con soporte WebXR (por ejemplo, el navegador de Meta
Quest) accediendo a la página mediante HTTPS o `localhost`.

## Estructura

```
index.html        Estructura de la página y menú de configuración
css/style.css      Estilos de la interfaz (menú, guía de respiración, HUD)
js/scene.js         Construcción de la escena 3D (terreno, lago, árboles, luciérnagas, guía de respiración)
js/breathing.js      Patrones y temporización de la respiración
js/audio.js           Paisaje sonoro generado por Web Audio API
js/app.js               Orquestación: renderer, controles, WebXR, UI y bucle de animación
```

## Uso previsto

Pensada como primer módulo de un proyecto de salud mental preventiva: una
práctica breve y guiada de respiración en un entorno natural simulado, útil
tanto en pantalla convencional como en sesiones de realidad virtual para
regulación emocional y manejo del estrés.
