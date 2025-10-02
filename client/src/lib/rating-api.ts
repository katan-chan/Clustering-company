interface RatingConfig {
  endpoint: string;
}

interface IndicatorInfo {
  code: string;
  description: string;
}

interface IndicatorsResponse {
  indicators: { [key: string]: string };
}

// Updated interfaces for new API format
interface TierRequest {
  sector: string;
  indicators: string[]; // Array of indicator names
  weights?: number[]; // Optional weights for each indicator
  cluster_label?: number;
  k?: number;
  algorithm?: string; // Clustering algorithm
}

interface TierAllRequest {
  indicators: string[]; // Array of indicator names
  weights?: number[]; // Optional weights for each indicator
  k?: number;
  algorithm?: string; // Clustering algorithm
}

interface Tier {
  tier: string;
  range: [number | string, number | string];
  count: number;
}

// New API response format interfaces
interface TierCompanyInfo {
  indicator: string;
  indicator_label: string;
  sector_unique_id: string;
  yearreport: number;
  [indicatorName: string]: any; // For dynamic indicator values like "STD_RTD97_STD_RTD71": -4.140240798461966
}

interface TierLabelInfo {
  count: number;
  tiers_companies: TierCompanyInfo[];
}

interface TierLabel {
  [tierName: string]: TierLabelInfo;
}

interface TierMetadata {
  algorithm: string;
  boundaries: Array<[number | string, number | string]>;
  cache_key: string;
  cluster_label: number;
  data_shape: [number, number];
  indicators: string[];
  k: number;
  mode: string;
  result_file: string;
  sector: string;
  tier_labels: string[];
  timestamp: string;
  weights: number[];
}

interface NewTierResponse {
  algorithm: string;
  boundaries: Array<[number | string, number | string]>;
  cluster_label: number;
  indicators: string[];
  k: number;
  metadata: TierMetadata;
  sector: string;
  success: boolean;
  tier_labels: TierLabel[];
  weights: number[];
}

// Response for single indicator
interface TierResponse {
  group_label?: number;
  indicator: string;
  method: {
    label: string;
    mode: string;
  };
  sector?: string;
  tiers: Tier[];
}

// Response for single indicator (all data)
interface TierAllResponse {
  indicator: string;
  method: {
    label: string;
    mode: string;
  };
  tiers: Tier[];
}

// Response for list spec (multiple indicators/groups)
interface TierGroupResponse {
  [key: string]: {
    indicator: string;
    method: {
      label: string;
      mode: string;
    };
    sector?: string;
    group_label?: number;
    tiers: Tier[];
  };
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

// New scoring request format - single company object
interface ScoringCompany {
  taxcode: string;
  sector: string | null;
  cluster_label: number | null;
  indicators?: string[]; // Optional - will be generated dynamically when creating requests
  weights?: number[]; // Optional - will be generated dynamically when creating requests
  [indicator: string]: any; // Dynamic indicator values like "STD_RTD97": 0.42
}

// New scoring request format - array of companies directly
type ScoringRequest = ScoringCompany[];

// Updated response format to match the new API specification
interface ScoringResponse {
  total_companies: number;
  scored_companies: number;
  companies: Array<{
    taxcode: string;
    sector: string | null;
    cluster_label: number | null;
    scores: Array<{
      indicator: string;
      tier: string;
    }>;
  }>;
}

// Individual scored company type for easier usage
interface ScoredCompany {
  taxcode: string;
  sector: string | null;
  cluster_label: number | null;
  scores: Array<{
    indicator: string;
    tier: string;
  }>;
  // Legacy fields for backward compatibility
  composite_score?: number;
  rating?: string;
  indicator_scores?: { [indicator: string]: number };
}

class RatingApi {
  // Store indicator descriptions for UI usage
  private indicatorDescriptions: { [key: string]: string } = {};

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
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          "Access-Control-Allow-Origin": "*",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      console.log(`📊 Response headers:`, response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`API Error ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const indicators = await response.json();
      console.log(`✅ Indicators response:`, indicators);
      
      // Handle different response formats
      let indicatorArray: string[];
      
      if (Array.isArray(indicators)) {
        // Direct array format: ["indicator1", "indicator2", ...]
        indicatorArray = indicators;
        console.log(`📊 Format: Direct array`);
      } else if (indicators && typeof indicators === 'object') {
        // Check for indicators object with key-value pairs
        if (indicators.indicators && typeof indicators.indicators === 'object' && !Array.isArray(indicators.indicators)) {
          // Format: {indicators: {"STD_RTD1": "Description", "STD_RTD2": "Description"}}
          this.indicatorDescriptions = indicators.indicators;
          indicatorArray = Object.keys(indicators.indicators);
          console.log(`📊 Format: Object with indicators key-value pairs`);
          console.log(`📊 Found ${indicatorArray.length} indicators with descriptions`);
          console.log(`📊 Sample indicators:`, Object.entries(indicators.indicators).slice(0, 3));
        } else if (Array.isArray(indicators.indicators)) {
          // Format: {indicators: ["indicator1", "indicator2"]}
          indicatorArray = indicators.indicators;
          console.log(`📊 Format: Object with indicators array`);
        } else if (Array.isArray(indicators.data)) {
          indicatorArray = indicators.data;
          console.log(`📊 Format: Object with data array`);
        } else if (Array.isArray(indicators.result)) {
          indicatorArray = indicators.result;
          console.log(`📊 Format: Object with result array`);
        } else if (Array.isArray(indicators.items)) {
          indicatorArray = indicators.items;
          console.log(`📊 Format: Object with items array`);
        } else {
          // Try to extract array from object values
          const values = Object.values(indicators);
          const arrayValue = values.find(val => Array.isArray(val));
          if (arrayValue) {
            indicatorArray = arrayValue as string[];
            console.log(`📊 Format: Object with nested array`);
          } else {
            throw new Error(`Invalid indicators format: object contains no array property or indicators object. Response keys: ${Object.keys(indicators).join(', ')}`);
          }
        }
      } else {
        throw new Error(`Invalid indicators format: expected array or object, got ${typeof indicators}. Response: ${JSON.stringify(indicators)}`);
      }
      
      console.log(`✅ Processed indicators (${indicatorArray.length}):`, indicatorArray.slice(0, 5), '...');
      return indicatorArray;
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

  getIndicatorDescription(code: string): string {
    return this.indicatorDescriptions[code] || code;
  }

  getIndicatorDescriptions(): { [key: string]: string } {
    return { ...this.indicatorDescriptions };
  }

  async getTiers(
    request: TierRequest,
    config: RatingConfig,
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `${config.endpoint}/tiers/cluster`;
      console.log(`🔄 Calling Tiers API: ${url}`);
      
      // Format request according to new API spec
      const apiRequest = {
        sector: request.sector,
        indicators: request.indicators,
        weights: request.weights,
        cluster_label: request.cluster_label,
        k: request.k || 8,
        algorithm: request.algorithm || "kmeans"
      };
      
      console.log(`📋 Request payload:`, apiRequest);

      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(apiRequest),
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

  async getTiersAll(
    request: TierAllRequest,
    config: RatingConfig,
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `${config.endpoint}/tiers/all`;
      console.log(`🔄 Calling Tiers All API: ${url}`);
      
      // Format request according to new API spec
      const apiRequest = {
        indicators: request.indicators,
        weights: request.weights,
        k: request.k || 8,
        algorithm: request.algorithm || "kmeans"
      };
      
      console.log(`📋 Request payload:`, apiRequest);

      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(apiRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Tiers All API Error Response:`, errorText);
        
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const tierData = await response.json();
      console.log(`✅ Tier All data received:`, tierData);
      return tierData;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Timeout: Tiers All API không phản hồi sau 15 giây`);
        }
        if (
          error.message.includes("fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("TypeError")
        ) {
          throw new Error(
            `Không thể kết nối đến Tiers All API: ${config.endpoint}/tiers/all`,
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

  async getScoring(
    request: ScoringRequest,
    config: RatingConfig,
  ): Promise<ScoringResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `${config.endpoint}/score`;
      console.log(`🔄 Calling Scoring API: ${url}`);
      
      // Use request directly as it's already an array
      console.log(`📋 Request payload (array format):`, request);

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
        console.error(`❌ Scoring API Error Response:`, errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const responseText = await response.text();
      console.log(`✅ Raw scoring response:`, responseText);
      
      // Try to parse JSON
      let scoringData;
      try {
        scoringData = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ Failed to parse response JSON:`, parseError);
        throw new Error(`Invalid JSON response from API: ${responseText.substring(0, 200)}...`);
      }
      
      console.log(`✅ Parsed scoring data:`, scoringData);
      
      // Validate response structure
      if (!scoringData || typeof scoringData !== 'object') {
        throw new Error(`Expected object response, got ${typeof scoringData}`);
      }

      if (!scoringData.companies || !Array.isArray(scoringData.companies)) {
        throw new Error(`Expected companies array in response, got ${typeof scoringData.companies}`);
      }

      return scoringData as ScoringResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Timeout: Scoring API không phản hồi sau 15 giây`);
        }
        if (
          error.message.includes("fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("TypeError")
        ) {
          throw new Error(
            `Không thể kết nối đến Scoring API: ${config.endpoint}/score`,
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
      console.log("🔄 Testing connection to:", `${config.endpoint}/indicator`);
      
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
      
      console.log(`📡 Connection test response: ${response.status} ${response.statusText}`);
      console.log(`🌐 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        // Try to parse response to validate it's JSON
        const data = await response.json();
        console.log(`✅ Connection successful, response:`, data);
        return true;
      } else {
        console.warn(`⚠️ Connection test failed: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.error("⏰ Connection test timeout after 5 seconds");
        } else if (error.message.includes("NetworkError") || error.message.includes("Failed to fetch")) {
          console.error("🌐 Network error during connection test");
        } else if (error.message.includes("SyntaxError")) {
          console.error("📄 Response is not valid JSON");
        } else {
          console.error("❌ Connection test error:", error.message);
        }
      }
      
      return false;
    }
  }
}

export const ratingApi = new RatingApi();

// Export a simplified getScoring function
export const getScoring = (request: ScoringRequest, endpoint: string): Promise<ScoringResponse> => {
  return ratingApi.getScoring(request, { endpoint });
};

export type {
  RatingConfig,
  TierRequest,
  TierAllRequest,
  TierResponse,
  TierAllResponse,
  TierGroupResponse,
  CompanyDetail,
  CompanyDetailRequest,
  ScoringCompany,
  ScoringRequest,
  ScoringResponse,
  ScoredCompany,
  Tier,
  NewTierResponse,
  TierMetadata,
  TierLabel,
  TierLabelInfo,
  TierCompanyInfo,
};
