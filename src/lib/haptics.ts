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
  if (isAndroid) android(AndroidHaptics.Virtual_Key)
  else impact(Impact.Light)
}

// Entering selection mode via long press
export function hapticSelect() {
  if (isAndroid) android(AndroidHaptics.Long_Press)
  else impact(Impact.Medium)
}

// Toggle checkbox on/off — crisp click
export function hapticToggle() {
  if (isAndroid) android(AndroidHaptics.Clock_Tick)
  else impact(Impact.Rigid)
}

// Swipe between photos — subtle tick
export function hapticTick() {
  if (isAndroid) android(AndroidHaptics.Clock_Tick)
  else void Haptics.selectionAsync()
}

// Sheet / modal open or close
export function hapticSoft() {
  if (isAndroid) android(AndroidHaptics.Virtual_Key)
  else impact(Impact.Soft)
}

// Segmented control / tab switch / dark mode toggle
export function hapticSwitch() {
  if (isAndroid) android(AndroidHaptics.Toggle_On)
  else impact(Impact.Rigid)
}

// FAB / primary action button
export function hapticAction() {
  if (isAndroid) android(AndroidHaptics.Context_Click)
  else impact(Impact.Medium)
}

// Success: album created, photos added, favorite saved
export function hapticSuccess() {
  if (isAndroid) android(AndroidHaptics.Confirm)
  else notify(Notify.Success)
}

// Warning: about to delete
export function hapticWarning() {
  if (isAndroid) android(AndroidHaptics.Reject)
  else notify(Notify.Warning)
}

// Error: something failed
export function hapticError() {
  if (isAndroid) android(AndroidHaptics.Reject)
  else notify(Notify.Error)
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
