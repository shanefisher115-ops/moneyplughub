import { useState, useEffect, useCallback } from 'react';

export interface LocationInfo {
  ip: string;
  country_code: string;
  country_name: string;
  detected_via: string;
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  exchange_rate: number;
}

export interface PPPInfo {
  has_discount: boolean;
  ppp_factor: number;
  discount_percent: number;
  banner_message: string;
}

export interface CountryOption {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  ppp_discount_percent: number;
  region: string;
}

export interface LocalizedPlan {
  id: string;
  name: string;
  slug: string;
  features: string[];
  price_cents_monthly_usd: number;
  price_cents_annual_usd: number;
  local_currency: string;
  local_symbol: string;
  original_local_monthly: number;
  original_local_monthly_formatted: string;
  ppp_local_monthly: number;
  ppp_local_monthly_formatted: string;
  original_local_annual: number;
  original_local_annual_formatted: string;
  ppp_local_annual: number;
  ppp_local_annual_formatted: string;
  ppp_local_annual_monthly_formatted: string;
  ppp_discount_percent: number;
}

export interface GeoPricingResponse {
  location: LocationInfo;
  currency: CurrencyInfo;
  ppp: PPPInfo;
  supported_countries: CountryOption[];
  plans: LocalizedPlan[];
}

export function useGeoPricing() {
  const [data, setData] = useState<GeoPricingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  const fetchGeoPricing = useCallback(async (countryCode?: string) => {
    try {
      setLoading(true);
      setError(null);

      const url = countryCode
        ? `/api/billing/geo-pricing?country=${encodeURIComponent(countryCode)}`
        : '/api/billing/geo-pricing';

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch geo pricing: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.success) {
        setData(json);
        setSelectedCountry(json.location.country_code);
      } else {
        throw new Error(json.error || 'Failed to load geo pricing');
      }
    } catch (err: any) {
      console.error('useGeoPricing error:', err);
      setError(err.message || 'Error loading geo pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGeoPricing();
  }, [fetchGeoPricing]);

  const changeCountry = useCallback((countryCode: string) => {
    setSelectedCountry(countryCode);
    fetchGeoPricing(countryCode);
  }, [fetchGeoPricing]);

  return {
    data,
    loading,
    error,
    selectedCountry,
    changeCountry,
    refetch: fetchGeoPricing,
  };
}
