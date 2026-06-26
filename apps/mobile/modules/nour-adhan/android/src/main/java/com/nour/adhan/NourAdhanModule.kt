package com.nour.adhan

import android.content.Context
import android.content.Intent
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AdhanItemRecord : Record {
  @Field var key: String = ""
  @Field var fireAtMillis: Double = 0.0
  @Field var fajr: Boolean = false
  @Field var volume: Double = 1.0
}

class NourAdhanModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("NourAdhan")

    AsyncFunction("scheduleAll") { items: List<AdhanItemRecord> ->
      val alarms = items.map { AdhanAlarm(it.key, it.fireAtMillis.toLong(), it.fajr, it.volume) }
      AdhanScheduler.scheduleAll(context, alarms)
    }

    AsyncFunction("cancelAll") {
      AdhanScheduler.cancelAll(context)
    }

    AsyncFunction("playTest") { delayMs: Double ->
      val fireAt = System.currentTimeMillis() + delayMs.toLong()
      AdhanScheduler.scheduleTest(context, AdhanAlarm("test", fireAt, false, 1.0))
    }

    AsyncFunction("stop") {
      val intent = Intent(context, AdhanPlayerService::class.java).apply {
        action = AdhanPlayerService.ACTION_STOP
      }
      context.startService(intent)
    }
  }
}
