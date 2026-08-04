import React, { useCallback, useRef } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { haptics } from './useHaptics'
import { spacing, typography } from './theme'

/**
 * The camera surface, ported from BSV Browser unchanged in behaviour.
 *
 * It stays deliberately stupid: it reports raw barcode strings and nothing else.
 * No validation, no retry policy, no idea what a payment is. Every caller has a
 * different notion of which strings are acceptable, and a scanner that decided
 * that for them would have to grow a mode per caller — which is exactly how BSV
 * Browser's single scanner would have splintered into five.
 *
 * It also presents nothing. There is no <Modal> here because NativeModalHost owns
 * presentation for every native surface in this shell; a Modal of its own would
 * open a second iOS window above the layer the shell coordinates with the tab
 * WebViews, and the tab layer would have no way to stand down for it.
 */

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface QRScannerProps {
  /**
   * Why this caller wants the camera, shown on the pre-permission screen.
   *
   * The source app had one scanner and one rationale — its backup-shares copy —
   * because that was the only caller that reached the permission prompt first.
   * Here the same component also opens for payments, and telling someone paying
   * a friend that we need the camera for "printed backup share QR codes" is
   * simply untrue. Defaults to the payment case, which is the common one.
   */
  permissionReason?: string
  /** Called with the raw barcode string. Caller is responsible for validation. */
  onScan: (data: string) => void
  /** Dismiss the scanner. */
  onClose: () => void
  /** Hint text shown below the finder window. Falls back to a generic i18n key. */
  hintText?: string
  /**
   * When true the scanner keeps accepting barcodes after each `onScan` call
   * (e.g. for multi-share Shamir recovery or scans that need caller-side
   * validation before closing). When false (default) scanning is disabled
   * after the first successful read.
   */
  multiScan?: boolean
  /**
   * Forward every recognised barcode immediately — no scan lock, no per-read
   * haptic. For animated multi-part codes (~5 reads/s): the lock would cap
   * assembly below 1 part/1.5 s, and per-read haptics would buzz constantly.
   * The caller owns dedupe and completion.
   */
  continuous?: boolean
  /**
   * Optional render callback for extra content in the bottom overlay area,
   * rendered below the hint text. Useful for progress dots, error banners, etc.
   */
  renderBottom?: () => React.ReactNode
}

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

const SCAN_WINDOW_SIZE = 260
const CORNER_SIZE = 24
const CORNER_THICKNESS = 3
const SCAN_LOCK_DELAY_MS = 1500

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export default function QRScanner({
  permissionReason,
  onScan,
  onClose,
  hintText,
  multiScan = false,
  continuous = false,
  renderBottom
}: QRScannerProps) {
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissions()

  // Prevent rapid-fire duplicate scans
  const scanLockRef = useRef(false)
  const stoppedRef = useRef(false)

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (continuous) {
        if (stoppedRef.current) return
        onScan(data)
        return
      }

      if (scanLockRef.current || stoppedRef.current) return
      scanLockRef.current = true

      // tap = recognition pulse; avoids double-fire with callers that fire
      // their own success/error haptic in onScan
      haptics.tap()
      onScan(data)

      if (!multiScan) {
        // Single-scan mode: stop scanning permanently (caller should close)
        stoppedRef.current = true
      } else {
        // Multi-scan mode: re-enable after a brief delay
        setTimeout(() => {
          scanLockRef.current = false
        }, SCAN_LOCK_DELAY_MS)
      }
    },
    [onScan, multiScan, continuous]
  )

  /* ── Permission not yet determined ─────────────────────────────────────── */
  if (!permission) {
    return <View style={styles.fill} />
  }

  /* ── Permission denied permanently — link to Settings ──────────────────── */
  if (!permission.granted && !permission.canAskAgain) {
    return (
      <View style={styles.permScreen}>
        <View style={styles.permIconWrap}>
          <Ionicons name="camera-outline" size={40} color="#fff" />
        </View>
        <Text style={styles.permTitle}>{t('scan_shares_camera_needed')}</Text>
        <Text style={styles.permBody}>{t('camera_denied_description')}</Text>
        <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.permBtnText}>{t('open_settings')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: spacing.lg }} onPress={onClose}>
          <Text style={styles.permBack}>{t('go_back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  /* ── Permission not yet granted — pre-permission explanation ─────────── */
  if (!permission.granted) {
    return (
      <View style={styles.permScreen}>
        <View style={styles.permIconWrap}>
          <Ionicons name="camera-outline" size={40} color="#fff" />
        </View>
        <Text style={styles.permTitle}>{t('scan_shares_camera_needed')}</Text>
        <Text style={styles.permBody}>{permissionReason ?? t('scan_shares_camera_description')}</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>{t('continue_action')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  /* ── Camera + overlay ──────────────────────────────────────────────────── */
  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      {/* Dark overlay with cutout */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.overlayTop}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Center row with cutout */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanWindow}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom info */}
        <View style={styles.overlayBottom}>
          <Text style={styles.hintText}>{hintText ?? t('scan_qr_default_hint')}</Text>
          {renderBottom?.()}
        </View>
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Styles                                    */
/* -------------------------------------------------------------------------- */

// Literal colours, not palette tokens: this surface sits on a live camera feed,
// where the overlay's contrast is against video rather than against any of the
// app's own backgrounds. The source component destructured `colors` and never
// used it for the same reason.
const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#000'
  },

  // ── Permission screen ──────────────────────────────────────────────────
  permScreen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl
  },
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl
  },
  permTitle: {
    ...typography.headline,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.sm
  },
  permBody: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: spacing.xxl
  },
  permBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl
  },
  permBtnText: {
    ...typography.headline,
    color: '#fff'
  },
  permBack: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.5)'
  },

  // ── Scanner overlay ────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between'
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: spacing.lg
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_WINDOW_SIZE
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)'
  },
  scanWindow: {
    width: SCAN_WINDOW_SIZE,
    height: SCAN_WINDOW_SIZE
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl
  },

  // ── Corner marks ───────────────────────────────────────────────────────
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: '#fff'
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: '#fff'
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: '#fff'
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: '#fff'
  },

  // ── Hint text ──────────────────────────────────────────────────────────
  hintText: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center'
  }
})
