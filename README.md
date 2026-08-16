# CaFriend ☕

PWA para asistir la preparación de café. Reemplaza las notas de molienda y recetas
por algo que se usa con una mano mientras la otra sostiene la pava.

Dos secciones:

- **Espresso** — seguimiento del setting de molinillo de cada café en curso, con
  historial fechado de todos los cambios y archivo de cafés terminados.
- **V60** — recetas paramétricas escalables y asistente de brewing con timer,
  objetivos de balanza, sonido y vibración en cada transición.

Todo se guarda en el teléfono (`localStorage`). No hay servidor ni cuenta.

## Uso

```bash
npm install
npm run dev      # desarrollo en http://localhost:5173/cafriend/
npm test         # 27 tests: escalado de recetas + flujos de UI
npm run build    # bundle de producción en dist/
```

## Cómo funcionan las recetas

Una receta guarda **ratio** (ml de agua por gramo de café) y una lista de pasos.
Cada pour define su objetivo como **fracción acumulada del agua total**, no como
mililitros fijos — por eso una sola receta sirve para cualquier dosis.

Al preparar, se elige el tamaño por cualquiera de las tres magnitudes y las otras
dos se calculan:

| Magnitud       | Qué es                                          |
| -------------- | ----------------------------------------------- |
| **Café (g)**   | lo que se muele                                 |
| **Agua (ml)**  | total vertido — **es lo que marca la balanza**  |
| **Taza (ml)**  | lo que realmente se toma                        |

La diferencia entre agua y taza es lo que retiene el lecho: unos 2 ml por gramo
de café, configurable en Ajustes. Durante el brew, todos los objetivos que muestra
el asistente son de **balanza** (agua vertida).

Las tres recetas que vienen cargadas — Hoffmann, Rao y Kasuya 4:6 — reproducen la
tabla de las notas originales. Las desviaciones conocidas (donde esa tabla no era
internamente consistente entre tamaños) están documentadas y verificadas en
[`src/lib/scaling.test.ts`](src/lib/scaling.test.ts).

## El asistente

Una vez que arranca, corre solo de punta a punta: ningún paso espera a que toques
nada, porque el tiempo total de la receta tiene que cumplirse tal cual está
definida. El único control es pausar.

El tiempo de drenado es un **diagnóstico de molienda**: si al llegar al objetivo
el filtro todavía gotea, la molienda está muy fina; si drenó bastante antes, está
muy gruesa. El resumen final lo recuerda.

Detalles que importan en el teléfono:

- El reloj se deriva de `performance.now()`, nunca de acumular ticks, así que no
  se atrasa si Android suspende la pestaña.
- `AudioContext` se crea en el tap de ▶ — Android bloquea el audio sin un gesto
  previo del usuario.
- Wake Lock mantiene la pantalla encendida y se re-adquiere al volver de segundo
  plano.

## Respaldo

Ajustes → **Descargar backup JSON** exporta todo. Al importar se puede *fusionar*
(gana la versión más nueva de cada registro) o *reemplazar todo*. Es el camino
para pasar los datos a otro teléfono o recuperarlos tras una reinstalación.

## Deploy

El workflow de [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
publica a GitHub Pages en cada push a `main`. En el repo hay que poner
Settings → Pages → Source: **GitHub Actions**.

`base` en [`vite.config.ts`](vite.config.ts) está en `/cafriend/`, que asume
`usuario.github.io/cafriend/`. Con dominio propio en la raíz, cambiarlo a `/`.
