import * as Haptics from 'expo-haptics'

export async function impactLight(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

export async function impactMedium(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
}
