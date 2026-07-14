package com.nour.adhan

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/** One adhan to fire at an exact wall-clock time. */
data class AdhanAlarm(
  val key: String,
  val fireAtMillis: Long,
  val fajr: Boolean,
  val volume: Double,
)

/**
 * Arms exact adhan alarms (vs the old 22-chained-notifications scheme that exhausted the
 * per-app allow-while-idle quota). Each alarm fires [AdhanAlarmReceiver], which starts
 * [AdhanPlayerService] to play the full adhan — no JS/React needed at fire time.
 *
 * Pool vs armed window: the JS layer hands us a long (~60-day) pool of instants. We
 * PERSIST the whole pool but only ARM the nearest [MAX_ARMED] (keeping the count of
 * live allow-while-idle alarms tiny, well clear of the OS quota that once deferred
 * every alarm). Each time an alarm fires, [AdhanAlarmReceiver] calls [rearmFromPersisted]
 * to roll the window forward to the next pooled instant — so the adhan keeps firing for
 * the whole horizon even if the app is never reopened. [BootReceiver] re-arms the same
 * way after a reboot (alarms don't survive reboot). Every app open refills the pool.
 */
object AdhanScheduler {
  private const val PREFS = "nour_adhan_prefs"
  private const val KEY_ITEMS = "items"
  private const val BASE_REQUEST_CODE = 7100
  private const val TEST_REQUEST_CODE = 7099
  // Request-code / cancel-sweep ceiling. Only ever [MAX_ARMED] are live at once, but we
  // sweep the whole range on cancel so no stale PendingIntent from a prior arming lingers.
  private const val MAX_ALARMS = 64
  // How many alarms are actually armed at any moment (~2.5 days at 5/day). Kept small so
  // the per-app allow-while-idle quota never meters us (the old ~200-alarm bug).
  private const val MAX_ARMED = 12

  const val EXTRA_KEY = "key"
  const val EXTRA_FAJR = "fajr"
  const val EXTRA_VOLUME = "volume"

  /** Replace the schedule: persist the full future pool, arm only the nearest [MAX_ARMED]. */
  fun scheduleAll(context: Context, alarms: List<AdhanAlarm>) {
    cancelAll(context)
    val now = System.currentTimeMillis()
    val future = alarms.filter { it.fireAtMillis > now }.sortedBy { it.fireAtMillis }
    persist(context, future)
    armNearest(context, future)
  }

  /** Arms a single one-off alarm (the in-app "Test adhan" button) without touching the real schedule. */
  fun scheduleTest(context: Context, alarm: AdhanAlarm) {
    arm(context, alarm, TEST_REQUEST_CODE)
  }

  fun cancelAll(context: Context) {
    cancelArmed(context)
    clearPersisted(context)
  }

  /**
   * Re-arm the nearest still-future alarms from the persisted pool WITHOUT shrinking it.
   * Used after a reboot AND after each alarm fires — in the fire case the just-fired
   * instant is now in the past, so it drops out and the next pooled instant enters the
   * armed window (the rolling step that keeps the adhan going with no app open).
   */
  fun rearmFromPersisted(context: Context) {
    val now = System.currentTimeMillis()
    val future = loadPersisted(context).filter { it.fireAtMillis > now }.sortedBy { it.fireAtMillis }
    cancelArmed(context)
    armNearest(context, future)
  }

  /** Arm the nearest [MAX_ARMED] of an already-future, already-sorted list. */
  private fun armNearest(context: Context, future: List<AdhanAlarm>) {
    future.take(MAX_ARMED).forEachIndexed { index, alarm -> arm(context, alarm, BASE_REQUEST_CODE + index) }
  }

  /** Cancel every armable PendingIntent slot (does NOT touch the persisted pool). */
  private fun cancelArmed(context: Context) {
    val am = alarmManager(context)
    for (i in 0 until MAX_ALARMS) {
      existingPendingIntent(context, BASE_REQUEST_CODE + i)?.let { am.cancel(it); it.cancel() }
    }
  }

  private fun arm(context: Context, alarm: AdhanAlarm, requestCode: Int) {
    val am = alarmManager(context)
    val intent = Intent(context, AdhanAlarmReceiver::class.java).apply {
      putExtra(EXTRA_KEY, alarm.key)
      putExtra(EXTRA_FAJR, alarm.fajr)
      putExtra(EXTRA_VOLUME, alarm.volume)
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val pi = PendingIntent.getBroadcast(context, requestCode, intent, flags)
    // Exact + allow-while-idle so it fires on time even in Doze. Fall back to inexact
    // only if exact-alarm permission is somehow missing (it's declared in app.json).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.fireAtMillis, pi)
    } else {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.fireAtMillis, pi)
    }
  }

  private fun existingPendingIntent(context: Context, requestCode: Int): PendingIntent? {
    val intent = Intent(context, AdhanAlarmReceiver::class.java)
    val flags = PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getBroadcast(context, requestCode, intent, flags)
  }

  private fun alarmManager(context: Context) =
    context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  // --- persistence ---

  private fun persist(context: Context, alarms: List<AdhanAlarm>) {
    val arr = JSONArray()
    for (a in alarms) {
      arr.put(
        JSONObject()
          .put("key", a.key)
          .put("fireAtMillis", a.fireAtMillis)
          .put("fajr", a.fajr)
          .put("volume", a.volume),
      )
    }
    prefs(context).edit().putString(KEY_ITEMS, arr.toString()).apply()
  }

  private fun loadPersisted(context: Context): List<AdhanAlarm> {
    val raw = prefs(context).getString(KEY_ITEMS, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        AdhanAlarm(
          key = o.optString("key", ""),
          fireAtMillis = o.optLong("fireAtMillis", 0L),
          fajr = o.optBoolean("fajr", false),
          volume = o.optDouble("volume", 1.0),
        )
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  private fun clearPersisted(context: Context) {
    prefs(context).edit().remove(KEY_ITEMS).apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
