'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useCurrency, formatMoney } from '@/shared/contexts/CurrencyContext'
import { toMoney, type MoneyRow } from '@/shared/currency/money'
import { convertMoney } from '@/shared/currency/rates'
import { useExchangeRates } from '@/shared/currency/useExchangeRates'
import { CURRENCY_CODES, type CurrencyCode } from '@/shared/static/currencies'

interface MoneyTotalsProps {
  /** Rows in any of the supported currencies; summed per currency. */
  value: MoneyRow[] | null | undefined
  /** Hide the live-rate convert button. */
  convertible?: boolean
  /** Flow inside text (button right after the value) instead of filling the row. */
  inline?: boolean
  className?: string
}

type Anchor = { top: number; bottom: number; left: number; right: number }

/**
 * The one way to show money. Each currency gets its own line (system currency
 * first, large; others smaller underneath) and inherits the parent's font size
 * and colour. The ⇄ button sits in the top corner, outside the figures, and
 * opens a floating live-rate preview above the value — the original amounts
 * never move or change. Rates are cached for 2 h (see currency/rates.ts).
 */
export function MoneyTotals({ value, convertible = true, inline = false, className = '' }: MoneyTotalsProps) {
  const { currencyCode } = useCurrency()
  const { t, locale, dir } = useTranslation()
  const [target, setTarget] = useState<CurrencyCode | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const fx = useExchangeRates(target !== null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const rows = value ?? []
  const totals = toMoney(rows, 'UNKNOWN').sort((a, b) => rank(a.currency, currencyCode) - rank(b.currency, currencyCode))
  if (totals.length === 0) totals.push({ amount: 0, currency: rows[0]?.currency || currencyCode })

  const converted = target && fx.rates ? convertMoney(rows, target, fx.rates) : null
  const failed = target !== null && (fx.error !== null || (fx.rates !== null && converted === null))
  const time = fx.fetchedAt ? new Date(fx.fetchedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''

  const measure = () => {
    const r = rootRef.current?.getBoundingClientRect()
    if (r) setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: window.innerWidth - r.right })
  }
  const close = () => setTarget(null)

  // While open: follow the value on scroll/resize; Escape or a click elsewhere closes.
  const onScroll = useEffectEvent(measure)
  const onKey = useEffectEvent((e: KeyboardEvent) => { if (e.key === 'Escape') close() })
  const onPointer = useEffectEvent((e: PointerEvent) => {
    const node = e.target as Node
    if (!rootRef.current?.contains(node) && !popoverRef.current?.contains(node)) close()
  })
  useEffect(() => {
    if (!target) return
    const scroll = () => onScroll()
    const key = (e: KeyboardEvent) => onKey(e)
    const pointer = (e: PointerEvent) => onPointer(e)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', scroll)
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', pointer)
    return () => {
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', scroll)
      document.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', pointer)
    }
  }, [target])

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (target) return close()
    measure()
    setTarget(currencyCode)
  }

  const label = target ? t('settings.currency.showOriginal') : t('settings.currency.convert')
  // Prefer floating above the value; flip below when too close to the top.
  const below = anchor ? anchor.top < 96 : false

  return (
    <span ref={rootRef} className={`relative min-w-0 ${inline ? 'inline-block max-w-full align-top' : 'block'} ${convertible ? (inline ? 'pe-6' : 'pe-8') : ''} ${className}`}>
      {totals.map((m, i) => (
        <span key={m.currency} className={`block break-words ${i === 0 ? '' : 'text-[0.6em] leading-snug opacity-75'}`}>
          {formatMoney(m.amount, m.currency)}
        </span>
      ))}

      {convertible && (
        <button
          type="button"
          aria-pressed={target !== null}
          aria-label={label}
          data-tooltip={target ? undefined : label}
          onClick={toggle}
          className={`absolute end-0 inline-flex items-center ${inline ? 'top-1/2 h-5 w-5 -translate-y-1/2' : 'top-0 h-6 w-6'} justify-center rounded-md border transition-colors ${
            target
              ? 'border-accent bg-accent text-accent-foreground'
              : 'border-[#EAEAEA] bg-white text-[#9B9A97] hover:bg-accent/10 hover:text-accent-ink'
          }`}
        >
          <SwapIcon spinning={fx.loading && target !== null} />
        </button>
      )}

      {target && anchor && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('settings.currency.convert')}
          dir={dir}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: below ? anchor.bottom + 6 : anchor.top - 6,
            transform: below ? undefined : 'translateY(-100%)',
            ...(dir === 'rtl' ? { right: anchor.right } : { left: anchor.left }),
          }}
          className="z-[70] w-max max-w-[calc(100vw-16px)] rounded-xl border border-[#EAEAEA] bg-white p-3 text-[#1A1A1A] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {failed ? (
            <p className="text-xs font-medium text-[#9F2F2D]">{t('settings.currency.fxError')}</p>
          ) : converted === null ? (
            <p className="text-xs text-[#787774]">{t('settings.currency.fxLoading')}</p>
          ) : (
            <>
              <p className="text-lg font-bold tabular-nums leading-tight">≈ {formatMoney(converted, target)}</p>
              <p className="mt-0.5 text-[11px] text-[#787774]">{t('settings.currency.liveRateAt').replace('{time}', time)}</p>
            </>
          )}
          <div className="mt-2 flex gap-1" role="group" aria-label={t('settings.currency.label')}>
            {CURRENCY_CODES.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={code === target}
                onClick={() => setTarget(code)}
                className={`h-7 rounded-md px-2 text-[11px] font-semibold transition-colors ${
                  code === target ? 'bg-accent text-accent-foreground' : 'bg-[#F1F1EF] text-[#787774] hover:text-accent-ink'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}

/**
 * A single amount with the same convert control. Without `currency` it uses
 * the nearest `CurrencyScope` (the record's currency), else the system one.
 */
export function MoneyAmount({ amount, currency, ...rest }: { amount: number; currency?: string | null } & Omit<MoneyTotalsProps, 'value'>) {
  const { scopeCurrency, currencyCode } = useCurrency()
  const code = currency === undefined ? scopeCurrency ?? currencyCode : currency || 'UNKNOWN'
  return <MoneyTotals value={[{ amount, currency: code }]} {...rest} />
}

function SwapIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={spinning ? 'animate-spin' : ''}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  )
}

/** System currency first, then catalog order, unknown codes last. */
function rank(code: string, system: string): number {
  if (code === system) return -1
  const i = (CURRENCY_CODES as string[]).indexOf(code)
  return i === -1 ? CURRENCY_CODES.length : i
}
