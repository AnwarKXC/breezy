# Translation Guide — Arabic (ar) / English (en)

## Target Language
**Modern Standard Arabic (العربية الفصحى الحديثة)** — professional, clear style suitable for hotel management dashboards and business documents.

## Locale Files
- English: `src/i18n/locales/en.json` (canonical, 888+ keys)
- Arabic: `src/i18n/locales/ar.json` (mirrors en.json structure)

## Architecture
Custom i18n system (React Context + lazy-loaded JSON):
- `src/i18n/config.ts` — locale types, RTL helpers
- `src/i18n/provider.tsx` — I18nProvider with lazy loading
- `src/i18n/hooks/useTranslation.ts` — `{ t, locale, dir, isRTL }` hook
- `src/i18n/components/LanguageSwitcher.tsx` — language dropdown

## Style & Terminology

### Hotel Domain Terms (must be consistent)
| English | Arabic |
|---------|--------|
| Booking / Reservation | حجز |
| Check-in | تسجيل الوصول |
| Check-out | تسجيل المغادرة |
| Guest | نزيل |
| Invoice | فاتورة |
| Payment | دفعة / دفع |
| Void | إلغاء |
| Refund | استرداد |
| Room Charge | رسوم الغرفة |
| Deposit | عربون |
| Ledger | دفتر الأستاذ |
| Balance Due | الرصيد المستحق |
| Discount | خصم |
| Tax | ضريبة |
| Service Charge | رسوم الخدمة |
| Folio | حساب النزيل |
| Occupancy | الإشغال |
| Rack Rate | السعر الرسمي |
| No-show | عدم حضور |
| Revenue | إيراد |
| Expense | مصروف |
| ADR | متوسط سعر الغرفة |
| RevPAR | إيرادات الغرفة المتاحة |

### Rules
1. **Keep all placeholders** — `{roomCount}`, `{guestName}`, `{amount}`, `{days}` etc. must remain exactly as-is
2. **Preserve formatting** — markdown, HTML, JSX, PDF layout
3. **Do NOT translate** — brand names, variable names, code identifiers
4. **Acronyms stay English** — CSV, PDF, OTA, VAT, ID, RSVP
5. **Keep numbers, IDs, currencies, dates** exactly as they are
6. **RTL compatible** — use Arabic numerals (٠-٩) where appropriate, but Western numerals (0-9) are acceptable for UI

## Adding New Strings

1. Add key to `en.json` with English value
2. Copy the key to `ar.json` with Arabic translation
3. Re-run `scripts/sync-ar-locale.mjs` to validate structure parity

## Sync Script
```bash
node scripts/sync-ar-locale.mjs
```
This script:
- Merges ar.json values into en.json structure
- Preserves all existing Arabic translations
- Reports any keys still needing translation
- Preserves extra ar-only keys

## PDF Translation
Invoice PDFs use `pdfmake` with Arabic font (`public/fonts/arabic.ttf`).
- PDF labels are localized inline via the `L()` helper in `src/modules/accounting/utils/invoicePdfExport.ts`
- `Intl.NumberFormat` uses `ar-EG` for Arabic locale
- `formatDate` from `src/shared/utils/date.ts` handles RTL date formatting
