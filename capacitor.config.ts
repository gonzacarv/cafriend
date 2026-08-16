import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.gonzacarv.cafriend',
  appName: 'CaFriend',
  webDir: 'dist',
  android: {
    // Servir como https://localhost hace que el WebView sea un contexto seguro,
    // que es lo que habilita el Wake Lock (pantalla encendida durante el brew).
    // Sin esto la API no existe y la pantalla se apaga a mitad de una receta.
    androidScheme: 'https',
  },
  backgroundColor: '#12100e',
}

export default config
