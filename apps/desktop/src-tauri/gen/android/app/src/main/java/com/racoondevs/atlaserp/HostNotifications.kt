package com.racoondevs.atlaserp

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import app.tauri.plugin.Invoke

object HostNotifications {
  fun show(activity: Activity, invoke: Invoke) {
    val options = invoke.getArgs()
    val id = options.optInt("id", 0)
    val title = options.optString("title").take(300)
    val channel = options.optString("channelId")
    if (id <= 0 || title.isBlank() || channel !in listOf("atlas-calls-v1", "atlas-alerts-v1")) {
      invoke.reject("INVALID_NOTIFICATION"); return
    }
    val intent = Intent(activity, MainActivity::class.java).apply {
      action = Intent.ACTION_MAIN
      flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val target = options.optJSONObject("extra")?.optJSONObject("target")
    val kind = target?.optString("kind")
    val targetId = target?.optString("targetId") ?: ""
    if (kind in listOf("call", "chat") && Regex("^[a-zA-Z0-9-]{1,128}$").matches(targetId)) {
      intent.action = Intent.ACTION_VIEW
      intent.setDataAndType(Uri.parse("atlas://$kind/$targetId"), "application/octet-stream")
    }
    val contentIntent = PendingIntent.getActivity(activity, id, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(activity, channel)
      .setSmallIcon(R.mipmap.ic_launcher_monochrome)
      .setContentTitle(title)
      .setContentText(options.optString("body").take(2000))
      .setContentIntent(contentIntent)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .build()
    try {
      NotificationManagerCompat.from(activity).notify(id, notification)
      invoke.resolve()
    } catch (_: SecurityException) { invoke.reject("Permiso de notificaciones denegado.") }
  }
}
