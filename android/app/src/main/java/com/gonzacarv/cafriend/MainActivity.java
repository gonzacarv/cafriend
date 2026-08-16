package com.gonzacarv.cafriend;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Conecta el botón "volver" de Android con el historial del WebView.
     *
     * Capacitor 8 no trae ningún manejo del back: sin esto el sistema cierra la
     * actividad en el primer toque, sin importar lo que tenga abierto la app.
     * Los overlays de CaFriend (sheets y asistente) empujan una entrada de
     * historial cuando se abren, así que delegar en `goBack()` los cierra de a
     * uno y recién sale de la app cuando no queda nada.
     *
     * Se usa OnBackPressedDispatcher y no el viejo onBackPressed() porque, con
     * targetSdk 36, Android habilita el back predictivo y ya no llama al
     * método deprecado.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        if (getBridge() != null && getBridge().getWebView().canGoBack()) {
                            getBridge().getWebView().goBack();
                        } else {
                            finish();
                        }
                    }
                }
            );
    }
}
