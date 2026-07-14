package com.nour.adhan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Fired by AlarmManager at the exact prayer time (even in Doze). Starts the
 * foreground service that plays the adhan, then rolls the armed window forward to the
 * next pooled instant so the schedule never runs dry. Runs entirely in native — no React.
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

    // Roll the window forward: the just-fired instant is now in the past, so re-arming
    // from the persisted pool arms the NEXT one. This is what keeps the adhan firing for
    // the whole ~60-day horizon without the app ever being reopened. Cheap (a
    // SharedPreferences read + a few setExact calls) — safe inside the broadcast window.
    AdhanScheduler.rearmFromPersisted(context)
  }
}
