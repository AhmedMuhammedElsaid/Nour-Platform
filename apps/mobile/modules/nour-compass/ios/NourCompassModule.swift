import ExpoModulesCore
import CoreMotion

// Native compass heading from CoreMotion device motion using the true-north
// reference frame — the fused (gyro + accelerometer + magnetometer) attitude, so
// `heading` is tilt-compensated and declination-corrected (true north). This is the
// iOS analogue of Android's rotation-vector sensor. Requires location services for
// the true-north frame; falls back to magnetic north otherwise.
public class NourCompassModule: Module {
  private let motionManager = CMMotionManager()
  private let queue = OperationQueue()

  public func definition() -> ModuleDefinition {
    Name("NourCompass")
    Events("onHeading")

    Function("isAvailable") { () -> Bool in
      return self.motionManager.isDeviceMotionAvailable
    }

    // iOS derives declination itself from the true-north reference frame, so the
    // location is not needed here; kept for API parity with Android.
    Function("setLocation") { (_ lat: Double, _ lng: Double) in }

    Function("start") {
      guard self.motionManager.isDeviceMotionAvailable else { return }
      self.motionManager.deviceMotionUpdateInterval = 1.0 / 30.0
      let available = CMMotionManager.availableAttitudeReferenceFrames()
      let frame: CMAttitudeReferenceFrame =
        available.contains(.xTrueNorthZVertical) ? .xTrueNorthZVertical : .xMagneticNorthZVertical
      self.motionManager.startDeviceMotionUpdates(using: frame, to: self.queue) { motion, _ in
        guard let m = motion else { return }
        var heading = m.heading // degrees relative to the reference frame
        if heading < 0 { heading += 360 }
        self.sendEvent("onHeading", [
          "trueHeading": heading,
          "magHeading": heading,
          "accuracy": 3,
        ])
      }
    }

    Function("stop") {
      self.motionManager.stopDeviceMotionUpdates()
    }

    OnDestroy {
      self.motionManager.stopDeviceMotionUpdates()
    }
  }
}
