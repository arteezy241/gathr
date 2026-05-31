import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Show notification even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

/**
 * Schedule a daily "On this day" reminder at 9 AM.
 * Cancels any existing reminder first so re-scheduling is idempotent.
 */
export async function scheduleDailyMemoryReminder(): Promise<void> {
  // Cancel previous instance to avoid duplicates
  await Notifications.cancelScheduledNotificationAsync('gathr-daily-memory').catch(() => {})

  const granted = await requestNotificationPermission()
  if (!granted) return

  await Notifications.scheduleNotificationAsync({
    identifier: 'gathr-daily-memory',
    content: {
      title: 'Memories from Gathr 📷',
      body: 'See what you were up to on this day in previous years.',
      data: { screen: 'memories' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  })
}

export async function cancelDailyMemoryReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('gathr-daily-memory').catch(() => {})
}
