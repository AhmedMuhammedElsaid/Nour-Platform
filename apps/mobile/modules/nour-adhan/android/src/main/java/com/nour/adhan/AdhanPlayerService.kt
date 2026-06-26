package com.nour.adhan

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Short-lived foreground service that plays the full adhan once. Started by
 * [AdhanAlarmReceiver] at the prayer time. Plays on the ALARM stream so it sounds
 * even on silent/DND, requests audio focus (pausing the music queue), shows an
 * ongoing "Stop" notification, and stops itself when the adhan finishes.
 */
class AdhanPlayerService : Service() {
  companion object {
    const val ACTION_PLAY = "com.nour.adhan.PLAY"
    const val ACTION_STOP = "com.nour.adhan.STOP"
    private const val CHANNEL_ID = "adhan_playback"
    private const val NOTIF_ID = 7711
  }

  private var player: MediaPlayer? = null
  private var audioManager: AudioManager? = null
  private var focusRequest: AudioFocusRequest? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopPlayback()
      return START_NOT_STICKY
    }

    val fajr = intent?.getBooleanExtra(AdhanScheduler.EXTRA_FAJR, false) ?: false
    val volume = (intent?.getDoubleExtra(AdhanScheduler.EXTRA_VOLUME, 1.0) ?: 1.0)
      .toFloat().coerceIn(0f, 1f)

    startInForeground()
    requestFocus()
    play(fajr, volume)
    return START_NOT_STICKY
  }

  private fun startInForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun play(fajr: Boolean, volume: Float) {
    releasePlayer()
    val resName = if (fajr) "adhan_fajr" else "adhan"
    val resId = resources.getIdentifier(resName, "raw", packageName)
    if (resId == 0) {
      stopPlayback()
      return
    }
    try {
      val mp = MediaPlayer()
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build(),
      )
      resources.openRawResourceFd(resId).use { afd ->
        mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
      }
      mp.setVolume(volume, volume)
      mp.setOnCompletionListener { stopPlayback() }
      mp.setOnErrorListener { _, _, _ -> stopPlayback(); true }
      mp.prepare()
      mp.start()
      player = mp
    } catch (e: Exception) {
      stopPlayback()
    }
  }

  private fun requestFocus() {
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audioManager = am
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()
      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(attrs)
        .build()
      focusRequest = req
      am.requestAudioFocus(req)
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }
  }

  private fun abandonFocus() {
    val am = audioManager ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { am.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(null)
    }
    focusRequest = null
    audioManager = null
  }

  private fun releasePlayer() {
    player?.let {
      try {
        if (it.isPlaying) it.stop()
      } catch (_: Exception) {
      }
      it.release()
    }
    player = null
  }

  private fun stopPlayback() {
    releasePlayer()
    abandonFocus()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun buildNotification(): android.app.Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          "Adhan",
          NotificationManager.IMPORTANCE_LOW,
        ).apply { setSound(null, null) }
        nm.createNotificationChannel(channel)
      }
    }

    val stopIntent = Intent(this, AdhanPlayerService::class.java).apply { action = ACTION_STOP }
    val stopPi = PendingIntent.getService(
      this,
      1,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("الأذان · Adhan")
      .setContentText("اضغط لإيقاف الأذان · Tap to stop")
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .addAction(0, "إيقاف · Stop", stopPi)
      .build()
  }

  override fun onDestroy() {
    releasePlayer()
    abandonFocus()
    super.onDestroy()
  }
}
