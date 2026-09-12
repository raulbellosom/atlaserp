package com.racoondevs.atlaserp

import android.os.Bundle
import android.content.Intent
import android.webkit.WebView
import android.webkit.WebSettings
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override val handleBackNavigation: Boolean = true

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    // Preserve the real Chromium/Android UA for LiveKit and browser feature detection.
    webView.settings.userAgentString = WebSettings.getDefaultUserAgent(this) + " AtlasNativeHost/1.0"
    webView.settings.setSupportMultipleWindows(false)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    normalizeIntent(intent)
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onNewIntent(intent: Intent) {
    normalizeIntent(intent)
    super.onNewIntent(intent)
  }

  private fun normalizeIntent(intent: Intent) {
    // Tao 0.35's JNI intent handler unwraps a null getType() for VIEW/SEND.
    // Preserve URI/extras and provide a neutral MIME before entering Rust.
    // URI authorization remains in the deep-link parser; MIME grants no access.
    if (intent.type == null && intent.action in listOf(Intent.ACTION_VIEW, Intent.ACTION_SEND, Intent.ACTION_SEND_MULTIPLE)) {
      intent.setDataAndType(intent.data, "application/octet-stream")
    }
  }
}
