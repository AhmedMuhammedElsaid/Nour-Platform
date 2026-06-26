package com.nour.adhan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Fired by AlarmManager at the exact prayer time (even in Doze). Starts the
 * foreground service that plays the adhan. Runs entirely in native — no React.
 */
class AdhanAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val service = Intent(context, AdhanPlayerService::class.java).apply {
      action = AdhanPlayerService.ACTION_PLAY
      putExtra(AdhanScheduler.EXTRA_KEY, intent.getStringExtra(AdhanScheduler.EXTRA_KEY))
      putExtra(AdhanScheduler.EXTRA_FAJR, intent.getBooleanExtra(AdhanScheduler.EXTRA_FAJR, false))
      putExtra(AdhanScheduler.EXTRA_VOLUME, intent.getDoubleExtra(AdhanScheduler.EXTRA_VOLUME, 1.0))
    }
    ContextCompat.startForegroundService(context, service)
  }
}
