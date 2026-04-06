export const DEFAULT_CURRENCY_CODE = "GHS";

export const MAJOR_CURRENCY_OPTIONS = [
  { value: "GHS", label: "GHS / GHC - Ghana Cedi" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "NGN", label: "NGN - Nigerian Naira" },
  { value: "KES", label: "KES - Kenyan Shilling" },
  { value: "ZAR", label: "ZAR - South African Rand" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
  { value: "JPY", label: "JPY - Japanese Yen" },
] as const;

export const normalizeCurrencyCode = (value?: string | null) => {
  const candidate = (value || DEFAULT_CURRENCY_CODE).trim().toUpperCase();
  const code = candidate === "GHC" ? "GHS" : candidate || DEFAULT_CURRENCY_CODE;

  try {
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    });
    return code;
  } catch {
    return DEFAULT_CURRENCY_CODE;
  }
};

export const formatCurrency = (value: number, currencyCode?: string | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizeCurrencyCode(currencyCode),
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
