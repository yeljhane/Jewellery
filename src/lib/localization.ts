export const INTERFACE_LANGUAGES = ["AZ", "RU", "AR", "EN"] as const;
export type InterfaceLanguage = (typeof INTERFACE_LANGUAGES)[number];

export function normalizeLanguage(value?: string | null): InterfaceLanguage {
  const language = String(value || "EN").toUpperCase();
  return INTERFACE_LANGUAGES.includes(language as InterfaceLanguage)
    ? (language as InterfaceLanguage)
    : "EN";
}

export function languageTag(language: InterfaceLanguage) {
  return language === "AZ" ? "az" : language === "RU" ? "ru" : language === "AR" ? "ar" : "en";
}

export function languageDirection(language: InterfaceLanguage) {
  return language === "AR" ? "rtl" : "ltr";
}

const NAV: Record<InterfaceLanguage, Record<string, string>> = {
  EN: {
    Dashboard: "Dashboard", Analytics: "AI Analytics", Stock: "Finished Stock", Serials: "Serials",
    Security: "Inv. Security", Materials: "Raw Materials", Manufacturing: "Manufacturing", POS: "POS",
    Sales: "Sales", Repairs: "Repairs", Appraisals: "Appraisals", Purchases: "Purchases",
    Customers: "Customers", Service: "Customer Service", VAT: "Tourist VAT Refunds", Marketing: "Marketing",
    Suppliers: "Suppliers", Karigars: "Karigars", Rates: "Metal Rates", Expenses: "Expenses",
    Commissions: "Commissions", Accounting: "Accounting", Staff: "Staff", Settings: "Settings", SignOut: "Sign out",
  },
  AZ: {
    Dashboard: "İdarə paneli", Analytics: "AI analitikası", Stock: "Hazır məhsullar", Serials: "Seriya nömrələri",
    Security: "Anbar təhlükəsizliyi", Materials: "Xammal", Manufacturing: "İstehsal", POS: "Satış nöqtəsi",
    Sales: "Satışlar", Repairs: "Təmir", Appraisals: "Qiymətləndirmə", Purchases: "Satınalmalar",
    Customers: "Müştərilər", Service: "Müştəri xidməti", VAT: "Turist ƏDV qaytarılması", Marketing: "Marketinq",
    Suppliers: "Təchizatçılar", Karigars: "Ustalar", Rates: "Metal qiymətləri", Expenses: "Xərclər",
    Commissions: "Komissiyalar", Accounting: "Mühasibat", Staff: "Əməkdaşlar", Settings: "Parametrlər", SignOut: "Çıxış",
  },
  RU: {
    Dashboard: "Панель управления", Analytics: "ИИ-аналитика", Stock: "Готовые изделия", Serials: "Серийные номера",
    Security: "Безопасность склада", Materials: "Сырьё", Manufacturing: "Производство", POS: "Касса",
    Sales: "Продажи", Repairs: "Ремонт", Appraisals: "Оценка", Purchases: "Закупки",
    Customers: "Клиенты", Service: "Обслуживание клиентов", VAT: "Возврат НДС туристам", Marketing: "Маркетинг",
    Suppliers: "Поставщики", Karigars: "Мастера", Rates: "Цены на металлы", Expenses: "Расходы",
    Commissions: "Комиссии", Accounting: "Бухгалтерия", Staff: "Персонал", Settings: "Настройки", SignOut: "Выйти",
  },
  AR: {
    Dashboard: "لوحة التحكم", Analytics: "تحليلات الذكاء الاصطناعي", Stock: "المجوهرات الجاهزة", Serials: "الأرقام التسلسلية",
    Security: "أمن المخزون", Materials: "المواد الخام", Manufacturing: "التصنيع", POS: "نقطة البيع",
    Sales: "المبيعات", Repairs: "الإصلاحات", Appraisals: "التقييمات", Purchases: "المشتريات",
    Customers: "العملاء", Service: "خدمة العملاء", VAT: "استرداد ضريبة السياح", Marketing: "التسويق",
    Suppliers: "الموردون", Karigars: "الحرفيون", Rates: "أسعار المعادن", Expenses: "المصروفات",
    Commissions: "العمولات", Accounting: "المحاسبة", Staff: "الموظفون", Settings: "الإعدادات", SignOut: "تسجيل الخروج",
  },
};

export function navLabel(language: InterfaceLanguage, key: string) {
  return NAV[language][key] || NAV.EN[key] || key;
}

export const LANGUAGE_OPTIONS = [
  { value: "AZ", label: "Azərbaycanca" },
  { value: "RU", label: "Русский" },
  { value: "AR", label: "العربية" },
  { value: "EN", label: "English" },
] as const;
