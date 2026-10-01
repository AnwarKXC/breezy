// Starter questions for the assistant, independent of the app language: the
// widget has its own AR/EN switch so an admin can pick questions in either
// language (the model answers in the language of the question).

export type SuggestionLanguage = 'ar' | 'en'

export const ASSISTANT_SUGGESTIONS: Record<SuggestionLanguage, readonly string[]> = {
  ar: [
    'إيراد الشهر ده كام مقارنة بالشهر اللي فات؟',
    'مين داخل النهارده؟',
    'نسبة الإشغال الأسبوع اللي فات',
    'الفواتير المتأخرة أكتر من 30 يوم',
    'أعلى 5 نزلاء السنة دي',
    'المصاريف حسب البند الشهر ده',
    'الحجوزات جاية منين الشهر ده؟',
    'صافي الربح من أول السنة',
  ],
  en: [
    'What is the revenue this month compared to last month?',
    'Who is arriving today?',
    'What was the occupancy rate last week?',
    'Invoices overdue by more than 30 days',
    'Top 5 guests this year',
    'Expenses by category this month',
    'Where did this month’s bookings come from?',
    'Net result year to date',
  ],
}
