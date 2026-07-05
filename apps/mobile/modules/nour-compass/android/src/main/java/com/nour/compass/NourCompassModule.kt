package com.nour.compass

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Native compass heading from the **fused rotation-vector sensor** — the same
// sensor the browser's `deviceorientationabsolute` uses (gyroscope + accelerometer
// + magnetometer). This is tilt-compensated and stable, so it does not suffer the
// "accuracy 0" of the raw magnetometer / geomagnetic-only heading that the JS
// expo-sensors / expo-location paths gave. Declination (from the caller's location)
// is added so the emitted `trueHeading` matches the true-north Qibla bearing.
class NourCompassModule : Module(), SensorEventListener {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val sensorManager: SensorManager
    get() = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

  private val rotationMatrix = FloatArray(9)
  private val orientation = FloatArray(3)
  private var declination = 0f
  private var listening = false
  private var lastEmit = 0L

  override fun definition() = ModuleDefinition {
    Name("NourCompass")
    Events("onHeading")

    Function("isAvailable") {
      sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null
    }

    // Provide the current location so magnetic → true-north declination can be
    // applied (matches the great-circle Qibla bearing, which is true north).
    Function("setLocation") { lat: Double, lng: Double ->
      declination = GeomagneticField(
        lat.toFloat(),
        lng.toFloat(),
        0f,
        System.currentTimeMillis(),
      ).declination
    }

    // NOTE: no bare `return@Function` here. Under the New-Arch stack (Kotlin
    // 2.1.20 K2 + expo-modules-core 56) a `Function {}` body's expected return
    // type is `Any?`; only the implicit last-expression return is Unit-coerced,
    // so an explicit bare `return@Function` fails to compile. Use if-blocks.
    Function("start") {
      if (!listening) {
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        if (sensor != null) {
          sensorManager.registerListener(
            this@NourCompassModule,
            sensor,
            SensorManager.SENSOR_DELAY_GAME,
          )
          listening = true
        }
      }
    }

    Function("stop") {
      if (listening) {
        sensorManager.unregisterListener(this@NourCompassModule)
        listening = false
      }
    }

    OnDestroy {
      if (listening) {
        sensorManager.unregisterListener(this@NourCompassModule)
        listening = false
      }
    }
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
    // ~33Hz cap — smooth without flooding the bridge.
    val now = System.currentTimeMillis()
    if (now - lastEmit < 30) return
    lastEmit = now

    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
    SensorManager.getOrientation(rotationMatrix, orientation)
    val magDeg = Math.toDegrees(orientation[0].toDouble()) // -180..180, 0 = magnetic N
    val mag = (magDeg % 360 + 360) % 360
    val trueHeading = (mag + declination) % 360.0
    sendEvent(
      "onHeading",
      mapOf(
        "trueHeading" to (trueHeading + 360) % 360,
        "magHeading" to mag,
        "accuracy" to event.accuracy,
      ),
    )
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
