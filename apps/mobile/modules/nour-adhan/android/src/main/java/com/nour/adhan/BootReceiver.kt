package com.nour.adhan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Re-arm the persisted adhan alarms after a reboot (AlarmManager alarms don't survive reboot). */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      "android.intent.action.QUICKBOOT_POWERON",
      -> AdhanScheduler.rearmPersisted(context)
    }
  }
}
