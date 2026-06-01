import { createContext, useCallback, useContext, useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/lib/themeContext'

export interface SheetAction {
  label: string
  onPress?: (() => void) | undefined
  destructive?: boolean | undefined
  disabled?: boolean | undefined
}

interface SheetConfig {
  title: string
  message?: string | undefined
  actions: SheetAction[]
  cancelLabel?: string | undefined
  hideCancel?: boolean | undefined
}

interface SheetContextValue {
  showSheet: (config: SheetConfig) => void
  showConfirm: (
    title: string,
    message: string | undefined,
    onConfirm: () => void,
    opts?: { confirmLabel?: string; destructive?: boolean; cancelLabel?: string }
  ) => void
  showInfo: (title: string, message?: string) => void
}

const SheetContext = createContext<SheetContextValue | null>(null)

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [config, setConfig] = useState<SheetConfig | null>(null)
  const slideY = useRef(new Animated.Value(500)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  function open(cfg: SheetConfig) {
    setConfig(cfg)
    slideY.setValue(500)
    backdropOpacity.setValue(0)
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 2 }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start()
  }

  function close(callback?: () => void) {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 500, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setConfig(null)
      callback?.()
    })
  }

  const showSheet = useCallback((cfg: SheetConfig) => { open(cfg) }, [])

  const showConfirm = useCallback((
    title: string,
    message: string | undefined,
    onConfirm: () => void,
    opts?: { confirmLabel?: string; destructive?: boolean; cancelLabel?: string }
  ) => {
    open({
      title,
      message,
      cancelLabel: opts?.cancelLabel,
      actions: [{
        label: opts?.confirmLabel ?? 'Confirm',
        onPress: onConfirm,
        destructive: opts?.destructive,
      }],
    })
  }, [])

  const showInfo = useCallback((title: string, message?: string) => {
    open({ title, message: message ?? undefined, actions: [{ label: 'OK' }], hideCancel: true })
  }, [])

  if (config === null) {
    return (
      <SheetContext.Provider value={{ showSheet, showConfirm, showInfo }}>
        {children}
      </SheetContext.Provider>
    )
  }

  return (
    <SheetContext.Provider value={{ showSheet, showConfirm, showInfo }}>
      {children}

      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="box-none"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { close() }} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>

        {config.message !== undefined && config.message.length > 0 && (
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {config.message}
          </Text>
        )}

        {config.actions.length > 0 && (
          <ScrollView
            style={styles.actionList}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {config.actions.map((action, i) => (
              <Pressable
                key={String(i)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
                onPress={() => { close(action.onPress) }}
                disabled={action.disabled}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    { color: action.destructive === true ? '#FF3B30' : colors.accent },
                    action.disabled === true && styles.disabledText,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {config.hideCancel !== true && (
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            onPress={() => { close() }}
          >
            <Text style={[styles.cancelLabel, { color: colors.textSecondary }]}>
              {config.cancelLabel ?? 'Cancel'}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </SheetContext.Provider>
  )
}

export function useSheet(): SheetContextValue {
  const ctx = useContext(SheetContext)
  if (ctx === null) throw new Error('useSheet must be used within SheetProvider')
  return ctx
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 4,
    lineHeight: 18,
  },
  actionList: {
    maxHeight: 340,
    marginTop: 8,
  },
  actionBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.55,
  },
  disabledText: {
    opacity: 0.4,
  },
})
