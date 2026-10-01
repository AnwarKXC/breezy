import { createRoot } from 'react-dom/client'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import authReducer, { setUser } from '../../src/store/authSlice'
import { I18nProvider } from '../../src/i18n/provider'
import en from '../../src/i18n/locales/en.json'
import ar from '../../src/i18n/locales/ar.json'
import { GeneralJournalTab } from '../../src/modules/accounting/components/GeneralJournalTab'

const params = new URLSearchParams(location.search)
const locale = params.get('locale') === 'ar' ? 'ar' : 'en'
const store = configureStore({ reducer: { auth: authReducer } })
store.dispatch(setUser({ user: { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.test', displayName: 'Fixture' }, role: 'accountant' }))
document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
createRoot(document.getElementById('root')!).render(
  <Provider store={store}><I18nProvider locale={locale} dictionary={locale === 'ar' ? ar : en}><main style={{ maxWidth: 1100, margin: 'auto', padding: 16 }}><GeneralJournalTab /></main></I18nProvider></Provider>,
)
