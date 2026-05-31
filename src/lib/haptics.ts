import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notify, AndroidHaptics } = Haptics
const isAndroid = Platform.OS === 'android'

// ── primitives ──────────────────────────────────────────────────────────────

function android(type: Haptics.AndroidHaptics) {
  void Haptics.performAndroidHapticsAsync(type)
}
function impact(style: Haptics.ImpactFeedbackStyle) {
  void Haptics.impactAsync(style)
}
function notify(type: Haptics.NotificationFeedbackType) {
  void Haptics.notificationAsync(type)
}

// ── public API ───────────────────────────────────────────────────────────────

// Light tap — photo thumb press, minor button
export function hapticTap() {
  isAndroid ? android(AndroidHaptics.Virtual_Key) : impact(Impact.Light)
}

// Entering selection mode via long press
export function hapticSelect() {
  isAndroid ? android(AndroidHaptics.Long_Press) : impact(Impact.Medium)
}

// Toggle checkbox on/off — crisp click
export function hapticToggle() {
  isAndroid ? android(AndroidHaptics.Clock_Tick) : impact(Impact.Rigid)
}

// Swipe between photos — subtle tick
export function hapticTick() {
  isAndroid ? android(AndroidHaptics.Clock_Tick) : void Haptics.selectionAsync()
}

// Sheet / modal open or close
export function hapticSoft() {
  isAndroid ? android(AndroidHaptics.Virtual_Key) : impact(Impact.Soft)
}

// Segmented control / tab switch / dark mode toggle
export function hapticSwitch() {
  isAndroid ? android(AndroidHaptics.Toggle_On) : impact(Impact.Rigid)
}

// FAB / primary action button
export function hapticAction() {
  isAndroid ? android(AndroidHaptics.Context_Click) : impact(Impact.Medium)
}

// Success: album created, photos added, favorite saved
export function hapticSuccess() {
  isAndroid ? android(AndroidHaptics.Confirm) : notify(Notify.Success)
}

// Warning: about to delete
export function hapticWarning() {
  isAndroid ? android(AndroidHaptics.Reject) : notify(Notify.Warning)
}

// Error: something failed
export function hapticError() {
  isAndroid ? android(AndroidHaptics.Reject) : notify(Notify.Error)
}

// Delete confirmed — heavy double-pulse for destructive weight
export async function hapticDelete(): Promise<void> {
  if (isAndroid) {
    android(AndroidHaptics.Long_Press)
    await new Promise((r) => setTimeout(r, 80))
    android(AndroidHaptics.Reject)
  } else {
    await Haptics.impactAsync(Impact.Heavy)
    await new Promise((r) => setTimeout(r, 60))
    await Haptics.notificationAsync(Notify.Warning)
  }
}

// Long background task complete — success double-tap
export async function hapticDone(): Promise<void> {
  if (isAndroid) {
    android(AndroidHaptics.Confirm)
    await new Promise((r) => setTimeout(r, 80))
    android(AndroidHaptics.Virtual_Key)
  } else {
    await Haptics.notificationAsync(Notify.Success)
    await new Promise((r) => setTimeout(r, 80))
    await Haptics.impactAsync(Impact.Light)
  }
}

// ── legacy aliases ───────────────────────────────────────────────────────────
export const impactLight = hapticTap
export const impactMedium = hapticAction
