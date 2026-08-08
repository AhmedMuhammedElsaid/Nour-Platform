package com.nour.shortcuts

import android.content.Context
import android.content.pm.ShortcutManager
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// One-tap "Add to Home screen" for the launcher shortcuts expo-quick-actions
// already publishes (ids "sabah"/"masaa"/"kahf" — see use-adhkar-quick-actions.ts).
// expo-quick-actions itself never calls ShortcutManager.requestPinShortcut(), so
// this module fills that one gap: look the shortcut up by id (already carries the
// right title/icon/intent) and hand it straight to requestPinShortcut(), which
// shows the OS's own confirmation dialog. No new ShortcutInfo is built here.
class NourShortcutsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("NourShortcuts")

    // NOTE: no bare `return@Function`/`return@AsyncFunction` — same K2 compiler
    // gotcha as nour-compass (Function/AsyncFunction bodies must return via the
    // last expression, an explicit bare return fails to compile under New Arch).
    Function("isPinSupported") {
      val sm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.getSystemService(ShortcutManager::class.java)
      } else {
        null
      }
      sm?.isRequestPinShortcutSupported ?: false
    }

    AsyncFunction("requestPin") { id: String ->
      val sm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.getSystemService(ShortcutManager::class.java)
      } else {
        null
      }
      if (sm != null && sm.isRequestPinShortcutSupported) {
        val existing = sm.dynamicShortcuts.find { it.id == id }
        if (existing != null) {
          sm.requestPinShortcut(existing, null)
          true
        } else {
          false
        }
      } else {
        false
      }
    }
  }
}
