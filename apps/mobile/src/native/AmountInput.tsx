import React, { useContext, useState, useEffect, useRef } from 'react'
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native'
import Animated, { FadeInUp, FadeOutDown, useReducedMotion } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

// Side-effect import: the shared catalogue initialises i18next at module scope, and
// `useTranslation` below returns raw keys if that has not happened. It arrives
// transitively via WalletContext today, but naming it here keeps this component
// correct if it is ever mounted on its own.
import '../wallet/support/translations'
import { useTheme, spacing, typography, radii, durations } from './theme'
import { useWallet } from '../wallet/WalletContext'
import { ExchangeRateContext } from '../wallet/ExchangeRateContext'
import { parseDisplayToSatoshis, formatAmount } from '@nexus/wallet-core/src/utils/amountFormatHelpers'

/**
 * Sentinel meaning "send the whole balance", carried in the same satoshi-string
 * field as a real amount. Its value is one satoshi below the 21M-BSV supply, so no
 * genuine input can collide with it.
 *
 * This component only recognises and displays it. Whoever owns the amount is
 * responsible for turning it into a real figure before signing — a caller that
 * passes it straight to a spend will try to send 21 million BSV.
 */
export const SEND_MAX_VALUE = '2099999999999999'

interface AmountInputProps {
  /**
   * Show the "Send Max" shortcut. Defaults to true for send flows.
   * Pass false when asking someone ELSE to pay: the max there would be the
   * requester's own balance, which is meaningless to the payer.
   */
  showMax?: boolean
  value: string
  onChangeText: (text: string) => void
}

/**
 * Unit-aware amount input.
 *
 * In BSV mode (default): accepts integer satoshis via number-pad.
 * In USD mode: accepts dollar amounts with up to 2 decimals via decimal-pad,
 * converts to satoshis internally.
 *
 * The `onChangeText` callback always emits satoshi integer strings, and the
 * `value` prop is always a satoshi integer string. Currency is a display concern
 * and stops at this component's edge — no caller should ever hold dollars.
 */
export const AmountInput: React.FC<AmountInputProps> = ({ value, onChangeText, showMax = true }) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { settings } = useWallet()
  const { satoshisPerUSD, usdPerBsv } = useContext(ExchangeRateContext)
  const reducedMotion = useReducedMotion()

  const currency = settings?.currency || 'BSV'
  // No real rate means no dollar entry. The context keeps a hardcoded fallback so a
  // field stays usable, but converting someone's "$50" through a constant that is
  // 20% stale sends 20% of the wrong amount — refuse, and take satoshis instead.
  const rateKnown = usdPerBsv !== null
  const isUSD = currency === 'USD' && rateKnown
  const isSendMax = value === SEND_MAX_VALUE

  // In USD mode, we maintain a separate display value (dollars) from the satoshi value
  const [usdDisplayValue, setUsdDisplayValue] = useState('')
  const lastEmittedSats = useRef('')

  // Sync USD display value when the satoshi value changes externally (e.g., cleared by parent)
  useEffect(() => {
    if (!isUSD) return
    // Avoid re-syncing when we caused the change ourselves — round-tripping our own
    // emission back through the converter would rewrite what the user is typing.
    if (value === lastEmittedSats.current) return

    if (!value || value === '0') {
      setUsdDisplayValue('')
    } else if (value === SEND_MAX_VALUE) {
      // Don't try to convert SEND_MAX_VALUE to USD
    } else {
      // Convert satoshis back to USD for display
      const sats = parseInt(value, 10)
      if (!isNaN(sats) && satoshisPerUSD > 0) {
        const usd = sats / satoshisPerUSD
        // Show up to 2 decimal places, trimming trailing zeros
        setUsdDisplayValue(usd % 1 === 0 ? usd.toFixed(0) : usd.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
      }
    }
    lastEmittedSats.current = value
  }, [value, isUSD, satoshisPerUSD])

  const handleChangeText = (text: string) => {
    if (isUSD) {
      // Validate USD input: allow digits, one decimal point, up to 2 decimal places
      if (text && !/^\d*\.?\d{0,2}$/.test(text)) return
      setUsdDisplayValue(text)
      const sats = parseDisplayToSatoshis(text, 'USD', satoshisPerUSD)
      const satsStr = text ? String(sats) : ''
      lastEmittedSats.current = satsStr
      onChangeText(satsStr)
    } else {
      // BSV mode: integer satoshis passthrough
      onChangeText(text)
    }
  }

  if (isSendMax) {
    return (
      <View style={[styles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.accent }]}>
        <View style={styles.sendMaxDisplay}>
          <Ionicons name="wallet-outline" size={18} color={colors.accent} />
          <Text style={[styles.sendMaxLabel, { color: colors.accent }]}>{t('entire_wallet_balance')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (isUSD) setUsdDisplayValue('')
            onChangeText('')
          }}
          style={[styles.clearButton, { backgroundColor: colors.accent + '15' }]}
        >
          <Ionicons name="close" size={16} color={colors.accent} />
        </TouchableOpacity>
      </View>
    )
  }

  const displayValue = isUSD ? usdDisplayValue : value
  const placeholder = isUSD ? '0.00' : '0'
  const keyboardType = isUSD ? ('decimal-pad' as const) : ('number-pad' as const)
  const unitLabel = isUSD ? 'USD' : 'satoshis'

  // Secondary converted-currency line
  const satsForConversion = value ? parseInt(value, 10) : 0
  const secondaryText = isUSD
    ? (satsForConversion > 0 ? formatAmount(satsForConversion, 'BSV', satoshisPerUSD) : null)
    : (satsForConversion > 0 && rateKnown ? formatAmount(satsForConversion, 'USD', satoshisPerUSD) : null)

  const entering = reducedMotion ? undefined : FadeInUp.duration(durations.instant)
  const exiting = reducedMotion ? undefined : FadeOutDown.duration(durations.instant)

  return (
    <View>
      <View style={[styles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.separator }]}>
        <TextInput
          value={displayValue}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType}
          returnKeyType="done"
          style={[styles.input, { color: colors.textPrimary }]}
        />
        <View style={styles.unitLabelPressable}>
          {/* Keyed on the label so a currency switch remounts and the enter/exit pair
              actually runs — without the key it is one node whose text mutates. */}
          <Animated.View key={unitLabel} entering={entering} exiting={exiting}>
            <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>{unitLabel}</Text>
          </Animated.View>
        </View>
        {showMax && (
          <TouchableOpacity
            onPress={() => onChangeText(SEND_MAX_VALUE)}
            style={[styles.maxButton, { backgroundColor: colors.accent + '15' }]}
          >
            <Text style={[styles.maxText, { color: colors.accent }]}>{t('send_max')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {secondaryText != null && (
        <Text style={[styles.secondaryAmount, { color: colors.textSecondary }]}>{secondaryText}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth
  },
  input: {
    ...typography.largeTitle,
    // Tabular figures: digits keep their column as the amount grows, so the field
    // does not shimmer sideways while someone types.
    fontVariant: ['tabular-nums'],
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  unitLabelPressable: {
    paddingRight: spacing.sm
  },
  unitLabel: {
    ...typography.footnote
  },
  secondaryAmount: {
    ...typography.title3,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs
  },
  maxButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginRight: spacing.sm
  },
  maxText: {
    ...typography.footnote,
    fontWeight: '600'
  },
  sendMaxDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  sendMaxLabel: {
    ...typography.body,
    fontWeight: '600'
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  }
})
