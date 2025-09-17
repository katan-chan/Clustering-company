interface RatingConfig {
  endpoint: string;
}

interface TierRequest {
  sector: string;
  group_label: number;
  indicator: string;
}

interface Tier {
  tier: string;
  range: [number, string] | [string, number];
  count: number;
}

interface TierResponse {
  group_label: number;
  indicator: string;
  method: {
    label: string;
    mode: string;
  };
  sector: string;
  tiers: Tier[];
}

interface CompanyDetailRequest {
  taxcodes: string[];
  sector: string;
  indicator: string;
}

interface CompanyDetail {
  taxcode: string;
  name: string;
  sector: string;
  score: number;
  tier: string;
  indicator: string;
  risk_level: string;
}

class RatingApi {
  async getIndicators(config: RatingConfig): Promise<string[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const url = `${config.endpoint}/indicator`;
      console.log(`🔄 Calling Rating API: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
      }

      const indicators = await response.json();
      console.log(`✅ Indicators loaded:`, indicators);
      return indicators;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            `Timeout: Rating API không phản hồi sau 10 giây. Kiểm tra ${config.endpoint}`,
          );
        }
        if (
          error.message.includes("fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("TypeError")
        ) {
          throw new Error(
            `Không thể kết nối đến Rating API: ${config.endpoint}/indicator`,
          );
        }
      }
      throw error;
    }
  }

  async getTiers(
    request: TierRequest,
    config: RatingConfig,
  ): Promise<TierResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `${config.endpoint}/tiers/cluster`;
      console.log(`🔄 Calling Tiers API: ${url}`);
      console.log(`📋 Request payload:`, request);

      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Tiers API Error Response:`, errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const tierData = await response.json();
      console.log(`✅ Tier data received:`, tierData);
      return tierData;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Timeout: Tiers API không phản hồi sau 15 giây`);
        }
        if (
          error.message.includes("fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("TypeError")
        ) {
          throw new Error(
            `Không thể kết nối đến Tiers API: ${config.endpoint}/tiers/cluster`,
          );
        }
      }
      throw error;
    }
  }

  async getCompanyDetails(
    request: CompanyDetailRequest,
    config: RatingConfig,
  ): Promise<CompanyDetail[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const url = `${config.endpoint}/company/details`;
      console.log(`🔄 Calling Company Details API: ${url}`);
      console.log(`📋 Request payload:`, request);

      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Company Details API Error Response:`, errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const companyDetails = await response.json();
      console.log(`✅ Company details received:`, companyDetails);
      return companyDetails;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            `Timeout: Company Details API không phản hồi sau 10 giây`,
          );
        }
        if (
          error.message.includes("fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("TypeError")
        ) {
          throw new Error(
            `Không thể kết nối đến Company Details API: ${config.endpoint}/company/details`,
          );
        }
      }
      throw error;
    }
  }

  async testConnection(config: RatingConfig): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const url = `${config.endpoint}/indicator`;
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      return false;
    }
  }
}

export const ratingApi = new RatingApi();
export type {
  RatingConfig,
  TierRequest,
  TierResponse,
  CompanyDetail,
  CompanyDetailRequest,
  Tier,
};
