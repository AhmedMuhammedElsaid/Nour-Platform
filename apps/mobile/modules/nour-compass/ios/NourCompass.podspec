Pod::Spec.new do |s|
  s.name           = 'NourCompass'
  s.version        = '0.1.0'
  s.summary        = 'Native compass heading (CoreMotion true-north device motion)'
  s.description    = 'Fused, tilt-compensated compass heading for the Qibla screen.'
  s.author         = ''
  s.homepage       = 'https://github.com/AhmedMuhammedElsaid/Nour-Platform'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'CoreMotion'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
