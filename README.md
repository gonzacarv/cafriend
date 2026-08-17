# ☕ CaFriend

Aplicación web para seguimiento de molienda de espresso y preparación asistida
de V60. Funciona sin conexión y guarda los datos en el propio dispositivo.

<p align="center">
  <img src="img/screenshot.png" alt="CaFriend en un teléfono Android" width="320">
</p>

---

## Qué resuelve

Dos tareas concretas del café de especialidad:

- 🎛️ **Espresso** — registro del punto de molienda de cada café en uso, con
  historial fechado de cada ajuste.
- 🌀 **V60** — recetas que escalan a cualquier dosis, y un asistente que guía
  tiempos y pesos durante la preparación.

No requiere cuenta ni servidor. Los datos quedan en el almacenamiento local del
navegador o de la app.

---

## 🎛️ Espresso — seguimiento de molienda

Cada café se da de alta una vez con marca, tipo, país y fecha de tueste. La
pantalla principal muestra el valor actual del molinillo en tamaño grande.

| Acción | Resultado |
| --- | --- |
| Modificar el valor | Se registra con fecha y hora |
| Agregar una nota | Queda asociada a ese ajuste (*"amargo, abro un punto"*) |
| Marcar el café como terminado | Pasa a **Finalizados**, conservando el historial |

El historial indica la dirección de cada cambio: **↓ más fino**, **↑ más
grueso**. También se muestran los días transcurridos desde el tueste.

---

## 🌀 V60 — recetas escalables

Las recetas almacenan proporciones, no mililitros fijos. El tamaño de la
preparación se define por cualquiera de estas tres magnitudes y el resto se
calcula:

| Dato de entrada | Cálculo |
| --- | --- |
| Café en taza (250 ml) | Dosis de café molido y agua total |
| Agua a verter (300 ml) | Dosis de café molido y café en taza |
| Café molido (18 g) | Agua total y café en taza |

> **Agua vertida y café en taza no son lo mismo.** El lecho retiene alrededor de
> 2 ml por gramo de café: 240 ml de agua sobre 16 g dejan unos 208 ml en la
> taza. La aplicación distingue ambos valores y durante la preparación muestra
> siempre el de la balanza.

Incluye tres recetas y permite crear otras:

| Receta | Característica | Uso habitual |
| --- | --- | --- |
| 🇬🇧 **Hoffmann** | Vertidos continuos, tolerante al error | Uso diario, café desconocido |
| 🇺🇸 **Rao** | Vertido continuo tras el bloom, alta claridad | Especialidad, tuestes claros |
| 🇯🇵 **Kasuya 4:6** | Cinco pulsos con esperas largas | Cafés frutales, experimentación |

---

## ▶️ Asistente de preparación

Una vez iniciada la receta no requiere interacción hasta que termina. Cada
transición se señala con un sonido y un patrón de vibración distinto, de modo
que no es necesario mirar la pantalla.

En cada momento se indica una sola acción:

- 💧 **Verté** — peso objetivo en la balanza y tiempo disponible.
- ⏸️ **Esperá** — tiempo restante hasta el próximo vertido, y qué observar en el
  cono mientras tanto.

La distinción es relevante: salvo en los vertidos declarados como continuos, no
se vierte durante toda la ventana de tiempo. Se vierte, se espera a que el lecho
drene, y se vuelve a verter. El bloom es el caso más claro: unos segundos de
vertido y medio minuto de espera.

La duración de cada vertido se calcula a partir del caudal configurado en la
receta, por lo que se ajusta sola al cambiar la dosis.

La pantalla permanece encendida durante la preparación y el cronómetro se
mantiene exacto aunque el sistema suspenda la aplicación en segundo plano.

---

## 🔍 Diagnóstico de molienda por drenado

Cada receta define el momento en que el filtro debería quedar seco. La
comparación con lo observado orienta el ajuste del molinillo:

| Observación | Interpretación | Ajuste |
| --- | --- | --- |
| Seguía goteando | Molienda demasiado fina | Abrir el molinillo |
| Drenó bastante antes | Molienda demasiado gruesa | Cerrar el molinillo |
| Terminó cerca del objetivo | Molienda adecuada | Sin cambios |

Tres limitaciones a tener en cuenta al interpretarlo:

1. **El drenado no depende solo de la molienda.** La altura del vertido, la
   agitación y la temperatura influyen de forma comparable.
2. **Los últimos pulsos drenan más lento.** Los finos migran y el filtro se
   satura a medida que avanza la preparación.
3. **Una dosis mayor drena más lento.** El lecho es más profundo, por lo que un
   mismo tiempo objetivo pierde precisión si la dosis cambia mucho.

El tiempo total de preparación es el indicador más confiable; el drenado de cada
pulso aporta una señal complementaria.

---

## 💾 Gestión de datos

Ajustes → **Descargar backup** genera un archivo `.json` con los cafés, su
historial y las recetas. Sirve para migrar a otro dispositivo o restaurar
después de una reinstalación.

Al importar se puede **fusionar** —prevalece la versión más reciente de cada
registro— o **reemplazar** el contenido actual.

---

## 📱 Instalación

**APK de Android.** Descargar `cafriend.apk`, abrirlo en el dispositivo y
autorizar la instalación desde origen desconocido. La aplicación queda instalada
con todos sus recursos incluidos y no requiere conexión.

**Desde el navegador.** Abrir la aplicación en Chrome y usar
Menú ⋮ → **Agregar a pantalla de inicio**.

> El bloqueo de apagado de pantalla requiere que la aplicación se sirva por
> HTTPS. El APK cumple esa condición; una IP de red local por `http://` no.

---

## 🛠️ Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/cafriend/
npm test         # lógica de recetas, interfaz y reglas de layout
npm run build    # bundle de producción en dist/
```

React + TypeScript + Vite, con `vite-plugin-pwa` para el service worker. Sin
backend ni librerías de estado: los datos se guardan en `localStorage` y la
lógica de recetas son funciones puras en
[`src/lib/scaling.ts`](src/lib/scaling.ts), cubiertas por tests.

El despliegue a GitHub Pages se ejecuta en cada push a `main`
([workflow](.github/workflows/deploy.yml)). Para alojarlo en otra ruta, ajustar
`base` en [`vite.config.ts`](vite.config.ts).

### 🤖 Compilación del APK

El empaquetado usa [Capacitor](https://capacitorjs.com/), que incluye la
aplicación web dentro de un WebView sin depender de un servidor.

```bash
npm run build:apk    # → dist-apk/cafriend.apk
```

Requiere JDK 21 y el SDK de Android. Ambos pueden instalarse en un directorio
aparte, sin modificar el sistema:

```bash
mkdir -p ~/android-tools && cd ~/android-tools
curl -L -o jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse" && tar xzf jdk.tar.gz
curl -L -o cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
mkdir -p sdk/cmdline-tools && unzip -q cmdline-tools.zip -d sdk/cmdline-tools && mv sdk/cmdline-tools/cmdline-tools sdk/cmdline-tools/latest
yes | sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=sdk --licenses
sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=sdk "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

La compilación usa la firma de debug, suficiente para instalar el APK
manualmente. Publicarlo en Play Store requiere una clave de release propia.

> El modo `capacitor` del build cambia `base` a `/` y omite el service worker:
> dentro del APK los archivos ya están en el dispositivo, y un service worker
> sobre un origen local solo agrega puntos de falla.
