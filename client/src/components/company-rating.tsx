
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Download, Search, Wifi, WifiOff, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Plotly from 'plotly.js-dist';
import { ratingApi, type RatingConfig, type TierResponse, type TierAllResponse, type TierGroupResponse, type CompanyDetail, type Tier, type NewTierResponse, type TierMetadata, type TierLabel } from "@/lib/rating-api";
import IndicatorGroupSelector from "@/components/indicator-group-selector";
import { INDICATOR_GROUPS, getGroupName } from "@/constants/field-mapping";
import { useChartManager } from "@/hooks/use-chart-manager";

const apiSchema = z.object({
  endpoint: z.string().url("Please enter a valid URL"),
});

// Mapping các sector với tên ngành từ file name.txt
const sectorNames: Record<string, string> = {
  'A': 'NÔNG NGHIỆP, LÂM NGHIỆP VÀ THUỶ SẢN',
  'B': 'KHAI KHOÁNG',
  'C': 'CÔNG NGHIỆP CHẾ BIẾN, CHẾ TẠO',
  'D': 'SẢN XUẤT VÀ PHÂN PHỐI ĐIỆN, KHÍ ĐỐT, NƯỚC NÓNG, HƠI NƯỚC VÀ ĐIỀU HOÀ KHÔNG KHÍ',
  'E': 'CUNG CẤP NƯỚC; HOẠT ĐỘNG QUẢN LÝ VÀ XỬ LÝ RÁC THẢI, NƯỚC THẢI',
  'F': 'XÂY DỰNG',
  'G': 'BÁN BUÔN VÀ BÁN LẺ; SỬA CHỮA Ô TÔ, MÔ TÔ, XE MÁY VÀ XE CÓ ĐỘNG CƠ KHÁC',
  'H': 'VẬN TẢI KHO BÃI',
  'I': 'DỊCH VỤ LƯU TRÚ VÀ ĂN UỐNG',
  'J': 'THÔNG TIN VÀ TRUYỀN THÔNG',
  'K': 'HOẠT ĐỘNG TÀI CHÍNH, NGÂN HÀNG VÀ BẢO HIỂM',
  'L': 'HOẠT ĐỘNG KINH DOANH BẤT ĐỘNG SẢN',
  'M': 'HOẠT ĐỘNG CHUYÊN MÔN, KHOA HỌC VÀ CÔNG NGHỆ',
  'N': 'HOẠT ĐỘNG HÀNH CHÍNH VÀ DỊCH VỤ HỖ TRỢ',
  'O': 'HOẠT ĐỘNG CỦA ĐẢNG CỘNG SẢN, TỔ CHỨC CHÍNH TRỊ - XÃ HỘI, QUẢN LÝ NHÀ NƯỚC, AN NINH QUỐC PHÒNG; BẢO ĐẢM XÃ HỘI BẮT BUỘC',
  'P': 'GIÁO DỤC VÀ ĐÀO TẠO',
  'Q': 'Y TẾ VÀ HOẠT ĐỘNG TRỢ GIÚP XÃ HỘI',
  'R': 'NGHỆ THUẬT, VUI CHƠI VÀ GIẢI TRÍ',
  'S': 'HOẠT ĐỘNG DỊCH VỤ KHÁC',
  'T': 'HOẠT ĐỘNG LÀM THUÊ CÁC CÔNG VIỆC TRONG CÁC HỘ GIA ĐÌNH, SẢN XUẤT SẢN PHẨM VẬT CHẤT VÀ DỊCH VỤ TỰ TIÊU DÙNG CỦA HỘ GIA ĐÌNH'
};



export default function CompanyRating() {
  const { toast } = useToast();
  
  // State for API configuration
  const [ratingConfig, setRatingConfig] = useState<RatingConfig>({
    endpoint: ""
  });
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  const [debugMode, setDebugMode] = useState<boolean>(false);
  
  // State for controls
  const [indicators, setIndicators] = useState<string[]>([]);
  const [indicatorDescriptions, setIndicatorDescriptions] = useState<{ [key: string]: string }>({});
  const [analysisMode, setAnalysisMode] = useState<"individual" | "group">("individual");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [indicatorGroups, setIndicatorGroups] = useState<string[][]>([]); // For group mode
  const [indicatorWeights, setIndicatorWeights] = useState<{ [key: string]: number }>({}); // Weights for indicators
  const [groupWeights, setGroupWeights] = useState<number[][]>([]); // Weights for each group
  const [selectedSector, setSelectedSector] = useState<string>("A");
  const [selectedGroupLabel, setSelectedGroupLabel] = useState<number>(0);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState<string>("");
  
  // Clustering configuration
  const [clusteringConfig, setClusteringConfig] = useState({
    algorithm: "kmeans" as "kmeans" | "dbscan" | "meanshift",
    k: 8
  });
  
  // State for data - updated to handle both single and group responses
  const [tierDataList, setTierDataList] = useState<(TierResponse | TierAllResponse)[]>([]);
  const [rawApiResponses, setRawApiResponses] = useState<{ [key: string]: any }>({});
  const [companyDetails, setCompanyDetails] = useState<CompanyDetail[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Chart management hook với proper cleanup
  const { containerRef, renderCharts, destroyAllCharts } = useChartManager({
    onChartClick: (data) => {
      const { indicator, tier, sector } = data;
      const rangeText = typeof tier.range[0] === 'number' && typeof tier.range[1] === 'number'
        ? `${tier.range[0].toLocaleString()} - ${tier.range[1].toLocaleString()}`
        : `${tier.range[0]} - ${tier.range[1]}`;
      
      toast({
        title: `${indicator} - Tier ${tier.tier}`,
        description: `Sector: ${sector} | Range: ${rangeText} | Companies: ${tier.count}`,
        variant: "default",
      });
    }
  });
  
  // API Configuration Form
  const apiForm = useForm<z.infer<typeof apiSchema>>({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      endpoint: "",
    },
  });
  
  // Load tier data when parameters change
  useEffect(() => {
    // Clear existing data immediately when parameters change
    setTierDataList([]);
    
    if (analysisMode === "individual" && selectedIndicators.length > 0 && selectedSector && ratingConfig.endpoint) {
      loadTierData();
    } else if (analysisMode === "group" && indicatorGroups.length > 0 && selectedSector && ratingConfig.endpoint) {
      loadTierData();
    }
  }, [analysisMode, selectedIndicators, indicatorGroups, selectedSector, selectedSector === "All" ? null : selectedGroupLabel, ratingConfig.endpoint, indicatorWeights, groupWeights, clusteringConfig]);

  // Update charts when tier data changes - với proper cleanup
  useEffect(() => {
    console.log("📈 tierDataList changed, updating charts:", tierDataList?.length);
    
    const updateChartsAsync = async () => {
      if (!tierDataList || tierDataList.length === 0) {
        await destroyAllCharts();
        return;
      }

      // Prepare formatters cho chart rendering
      const formatters = {
        getIndicatorDescription,
        identifyIndicatorGroup,
        getGroupDisplayName,
        sectorNames
      };

      await renderCharts(tierDataList, formatters);
    };

    updateChartsAsync();
  }, [tierDataList, renderCharts, destroyAllCharts]);

  // Load company details when companies are selected
  useEffect(() => {
    if (selectedCompanies.length > 0 && selectedIndicators.length > 0 && ratingConfig.endpoint) {
      loadCompanyDetails();
    } else {
      setCompanyDetails([]);
    }
  }, [selectedCompanies, selectedIndicators, ratingConfig.endpoint]);
  
  const onApiConfigSubmit = async (data: { endpoint: string }) => {
    setRatingConfig({ endpoint: data.endpoint });
    
    if (data.endpoint) {
      setConnectionStatus("checking");
      try {
        console.log("🔄 Connecting to API and loading indicators:", data.endpoint);
        // Chỉ cần gọi loadIndicators - nếu thành công thì API đã kết nối
        await loadIndicators();
        
        // Chỉ set connected khi loadIndicators thành công
        setConnectionStatus("connected");
        
        toast({
          title: "Connection Successful",
          description: "Successfully connected to Rating API and loaded indicators",
          variant: "default",
        });
      } catch (error) {
        console.error("❌ Connection/Loading failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
        toast({
          title: "Connection Failed",
          description: `${errorMessage}\n\nCheck: 1) URL format 2) API availability 3) CORS settings 4) Network connection`,
          variant: "destructive",
        });
        setConnectionStatus("disconnected");
        setIndicators([]); // Clear indicators on failure
      }
    } else {
      setConnectionStatus("disconnected");
      setIndicators([]);
    }
  };

  const loadIndicators = async () => {
    try {
      console.log("📡 Fetching indicators from API...");
      console.log("🔗 API Endpoint:", ratingConfig.endpoint);
      
      const indicatorResponse = await ratingApi.getIndicators(ratingConfig);
      
      console.log("📊 Raw indicators response:", indicatorResponse);
      console.log("📊 Response type:", typeof indicatorResponse);
      
      // Handle both old format (array) and new format (object with descriptions)
      if (typeof indicatorResponse === 'object' && indicatorResponse && 'indicators' in indicatorResponse) {
        // New format: { indicators: { "STD_RTD146": "FFO / Nợ vay", ... } }
        const descriptions = indicatorResponse.indicators as { [key: string]: string };
        const indicatorList = Object.keys(descriptions);
        
        setIndicators(indicatorList);
        setIndicatorDescriptions(descriptions);
        
        if (indicatorList.length > 0) {
          setSelectedIndicators([indicatorList[0]]);
          console.log(`✅ Loaded ${indicatorList.length} indicators with descriptions, selected: ${indicatorList[0]}`);
        }
      } else if (Array.isArray(indicatorResponse)) {
        // Old format: ["STD_RTD146", "STD_RTD71", ...]
        setIndicators(indicatorResponse);
        setIndicatorDescriptions({}); // No descriptions available
        
        if (indicatorResponse.length > 0) {
          setSelectedIndicators([indicatorResponse[0]]);
          console.log(`✅ Loaded ${indicatorResponse.length} indicators (old format), selected: ${indicatorResponse[0]}`);
        }
      } else {
        console.error("❌ Invalid indicators format:", {
          type: typeof indicatorResponse,
          isArray: Array.isArray(indicatorResponse),
          value: indicatorResponse
        });
        throw new Error(`Invalid indicators format: expected array or object with 'indicators' key, got ${typeof indicatorResponse}. Response: ${JSON.stringify(indicatorResponse)}`);
      }
      
      if (indicators.length === 0) {
        console.warn("⚠️ API returned empty indicators list");
        toast({
          title: "No Indicators Available", 
          description: "The API returned an empty list of indicators. Contact the API provider.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Failed to load indicators:", error);
      setIndicators([]);
      setIndicatorDescriptions({});
      setSelectedIndicators([]);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error loading indicators";
      
      // Detailed error analysis
      let userFriendlyMessage = "Unknown error occurred";
      let possibleCauses = ["Check browser console for details"];
      
      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        userFriendlyMessage = "API endpoint /indicator not found";
        possibleCauses = [
          "• API endpoint /indicator not implemented", 
          "• Wrong base URL (check your API documentation)",
          "• API server not running"
        ];
      } else if (errorMessage.includes("CORS")) {
        userFriendlyMessage = "CORS policy blocking the request";
        possibleCauses = [
          "• API server needs to allow CORS from your domain",
          "• Use a CORS proxy or configure server properly"
        ];
      } else if (errorMessage.includes("NetworkError") || errorMessage.includes("fetch")) {
        userFriendlyMessage = "Network connection failed";
        possibleCauses = [
          "• Check your internet connection",
          "• API server might be down",
          "• Wrong URL format"
        ];
      } else if (errorMessage.includes("Invalid indicators format")) {
        userFriendlyMessage = "API returned unexpected data format";
        possibleCauses = [
          "• API should return array of strings or object with 'indicators' key",
          "• Current response format not supported",
          "• Contact API provider for correct format"
        ];
      } else if (errorMessage.includes("Timeout")) {
        userFriendlyMessage = "API request timed out";
        possibleCauses = [
          "• API server responding too slowly",
          "• Network latency issues",
          "• Try again in a few moments"
        ];
      }
      
      toast({
        title: "Connection Failed",
        description: `${userFriendlyMessage}\n\nPossible causes:\n${possibleCauses.join('\n')}`,
        variant: "destructive",
      });
      
      // Rethrow to let onApiConfigSubmit handle it
      throw error;
    }
  };
  
  /**
   * Parse tier data from new API response format
   * @param response - Response from the new API format
   * @param algorithm - Clustering algorithm used
   * @returns Normalized TierResponse
   */
  const parseTierResponse = (response: any, algorithm: string): Tier[] => {
    // Get boundaries from metadata (preferred) or direct boundaries field
    const boundaries = response.metadata?.boundaries || response.boundaries || [];
    const tierLabels = response.tier_labels || [];
    
    console.log("🔍 Parsing tier response:", {
      boundariesLength: boundaries.length,
      tierLabelsLength: tierLabels.length,
      sampleBoundary: boundaries[0],
      sampleTierLabel: tierLabels[0]
    });
    
    // Create tier list with real count data
    // According to the sample data, both boundaries and tier_labels are in T8->T1 order
    const tiers = boundaries.map((boundary: any, index: number) => {
      // Boundaries and tier_labels both go from index 0 (T8) to index 7 (T1)  
      const tierName = `T${boundaries.length - index}`;
      
      // Find the tier info from tier_labels array
      const tierInfo = tierLabels.find((tl: any) => tl[tierName]);
      const count = tierInfo?.[tierName]?.count || 0;
      
      console.log(`📊 Tier ${tierName} (index ${index}):`, {
        boundary,
        count,
        found: !!tierInfo
      });
      
      return {
        tier: tierName,
        range: boundary,
        count: count
      };
    });
    
    // Sort tiers by tier number for consistent display (T1, T2, ..., T8)
    const sortedTiers = tiers.sort((a: Tier, b: Tier) => {
      const numA = parseInt(a.tier.substring(1));
      const numB = parseInt(b.tier.substring(1));
      return numA - numB;
    });
    
    return sortedTiers;
  };

  const loadTierData = async () => {
    if (analysisMode === "individual" && selectedIndicators.length === 0) {
      console.warn("⚠️ No indicators selected for tier data loading");
      setTierDataList([]);
      return;
    }
    
    if (analysisMode === "group" && indicatorGroups.length === 0) {
      console.warn("⚠️ No indicator groups defined for tier data loading");
      setTierDataList([]);
      return;
    }

    console.log("🔄 Loading tier data for:", {
      mode: analysisMode,
      indicators: analysisMode === "individual" ? selectedIndicators : "groups",
      groups: analysisMode === "group" ? indicatorGroups : undefined,
      sector: selectedSector,
      groupLabel: selectedGroupLabel,
      endpoint: ratingConfig.endpoint
    });

    setLoading(true);
    try {
      if (analysisMode === "individual") {
        // Individual mode: load each indicator separately
        console.log("📊 Individual mode: loading each indicator separately");
        const tierResponses: TierResponse[] = [];
        const rawResponses: { [key: string]: any } = {};
        
        for (const indicator of selectedIndicators) {
          console.log(`🔄 Loading tier data for indicator: ${indicator}`);
          
          const weight = indicatorWeights[indicator] || 1.0;
          
          if (selectedSector === "All") {
            // Use /tiers/all API for All Sectors
            const response = await ratingApi.getTiersAll({
              indicators: [indicator], // Single indicator
              weights: [weight],
              k: clusteringConfig.k,
              algorithm: clusteringConfig.algorithm
            }, ratingConfig);
            
            console.log(`✅ Tier All data received for ${indicator}:`, response);
            
            // Store raw response for CSV export
            rawResponses[indicator] = response;
            
            // Parse new API response format using helper function
            const tiers = parseTierResponse(response, clusteringConfig.algorithm);
            
            const normalizedResponse: TierResponse = {
              indicator: indicator,
              method: { 
                label: response.metadata?.algorithm || clusteringConfig.algorithm, 
                mode: response.metadata?.mode || "high_good" 
              },
              sector: "All",
              tiers: tiers
            };
            tierResponses.push(normalizedResponse);
          } else {
            // Use /tiers/cluster API for specific sector
            const response = await ratingApi.getTiers({
              sector: selectedSector,
              cluster_label: selectedGroupLabel,
              indicators: [indicator], // Single indicator
              weights: [weight],
              k: clusteringConfig.k,
              algorithm: clusteringConfig.algorithm
            }, ratingConfig);
            
            console.log(`✅ Tier cluster data received for ${indicator}:`, response);
            
            // Store raw response for CSV export
            rawResponses[indicator] = response;
            
            // Parse new API response format using helper function
            const tiers = parseTierResponse(response, clusteringConfig.algorithm);
            
            const normalizedResponse: TierResponse = {
              group_label: selectedGroupLabel,
              indicator: indicator,
              method: { 
                label: response.metadata?.algorithm || clusteringConfig.algorithm, 
                mode: response.metadata?.mode || "high_good" 
              },
              sector: selectedSector,
              tiers: tiers
            };
            tierResponses.push(normalizedResponse);
          }
        }
        
        setTierDataList(tierResponses);
        setRawApiResponses(rawResponses);
        
      } else {
        // Group mode: combine indicators within each group
        console.log("👥 Group mode: loading indicator groups");
        const tierResponses: TierResponse[] = [];
        const rawResponses: { [key: string]: any } = {};
        
        for (let groupIndex = 0; groupIndex < indicatorGroups.length; groupIndex++) {
          const group = indicatorGroups[groupIndex];
          if (group.length === 0) continue;
          
          console.log(`🔄 Loading tier data for group ${groupIndex + 1}:`, group);
          
          // Get weights for this group
          const groupWeightArray = groupWeights[groupIndex] || [];
          const weights = group.map((indicator, indicatorIndex) => 
            groupWeightArray[indicatorIndex] || 1.0
          );
          
          const groupKey = group.join(" + ");
          
          if (selectedSector === "All") {
            // Use /tiers/all API for All Sectors
            const response = await ratingApi.getTiersAll({
              indicators: group,
              weights: weights,
              k: clusteringConfig.k,
              algorithm: clusteringConfig.algorithm
            }, ratingConfig);
            
            console.log(`✅ Tier All data received for group ${groupIndex + 1}:`, response);
            
            // Store raw response for CSV export
            rawResponses[groupKey] = response;
            
            // Parse new API response format using helper function
            const tiers = parseTierResponse(response, clusteringConfig.algorithm);
            
            const normalizedResponse: TierResponse = {
              indicator: groupKey,
              method: { 
                label: response.metadata?.algorithm || clusteringConfig.algorithm, 
                mode: response.metadata?.mode || "high_good" 
              },
              sector: "All",
              tiers: tiers
            };
            tierResponses.push(normalizedResponse);
          } else {
            // Use /tiers/cluster API for specific sector
            const response = await ratingApi.getTiers({
              sector: selectedSector,
              cluster_label: selectedGroupLabel,
              indicators: group,
              weights: weights,
              k: clusteringConfig.k,
              algorithm: clusteringConfig.algorithm
            }, ratingConfig);
            
            console.log(`✅ Tier cluster data received for group ${groupIndex + 1}:`, response);
            
            // Store raw response for CSV export
            rawResponses[groupKey] = response;
            
            // Parse new API response format using helper function
            const tiers = parseTierResponse(response, clusteringConfig.algorithm);
            
            const normalizedResponse: TierResponse = {
              group_label: selectedGroupLabel,
              indicator: groupKey,
              method: { 
                label: response.metadata?.algorithm || clusteringConfig.algorithm, 
                mode: response.metadata?.mode || "high_good" 
              },
              sector: selectedSector,
              tiers: tiers
            };
            tierResponses.push(normalizedResponse);
          }
        }
        
        setTierDataList(tierResponses);
        setRawApiResponses(rawResponses);
      }
    } catch (error) {
      console.error("❌ Failed to load tier data:", error);
      
      // Clear tier data on error
      setTierDataList([]);
      setRawApiResponses({});
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      toast({
        title: "Error loading tier data",
        description: `Failed to load tier analysis: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const loadCompanyDetails = async () => {
    if (selectedCompanies.length === 0) {
      setCompanyDetails([]);
      return;
    }
    
    try {
      // Load details for the first selected indicator (for now)
      // In future, could be extended to handle multiple indicators
      const firstIndicator = selectedIndicators[0];
      if (!firstIndicator) return;
      
      const details = await ratingApi.getCompanyDetails({
        taxcodes: selectedCompanies,
        sector: selectedSector,
        indicator: firstIndicator,
      }, ratingConfig);
      
      setCompanyDetails(details);
    } catch (error) {
      console.error("Failed to load company details:", error);
      toast({
        title: "Error loading company details",
        description: "Failed to load company information",
        variant: "destructive",
      });
    }
  };
  
  const addCompany = () => {
    if (companySearch.trim() && !selectedCompanies.includes(companySearch.trim())) {
      setSelectedCompanies([...selectedCompanies, companySearch.trim()]);
      setCompanySearch("");
    }
  };
  
  const removeCompany = (taxcode: string) => {
    setSelectedCompanies(selectedCompanies.filter(c => c !== taxcode));
  };
  
  // Helper functions for indicator groups
  const addIndicatorGroup = () => {
    const newGroupIndex = indicatorGroups.length;
    setIndicatorGroups([...indicatorGroups, []]);
    // Initialize empty weights array for new group
    setGroupWeights(prev => [...prev, []]);
  };
  
  const removeIndicatorGroup = (groupIndex: number) => {
    setIndicatorGroups(indicatorGroups.filter((_, index) => index !== groupIndex));
    // Remove corresponding weights array
    setGroupWeights(prev => prev.filter((_, index) => index !== groupIndex));
  };
  
  const addIndicatorToGroup = (groupIndex: number, indicator: string) => {
    const updatedGroups = [...indicatorGroups];
    if (!updatedGroups[groupIndex].includes(indicator)) {
      updatedGroups[groupIndex] = [...updatedGroups[groupIndex], indicator];
      setIndicatorGroups(updatedGroups);
      
      // Add default weight (1.0) for new indicator
      const updatedWeights = [...groupWeights];
      if (!updatedWeights[groupIndex]) {
        updatedWeights[groupIndex] = [];
      }
      updatedWeights[groupIndex].push(1.0);
      setGroupWeights(updatedWeights);
      
      setTierDataList([]); // Clear data when groups change
    }
  };
  
  const removeIndicatorFromGroup = (groupIndex: number, indicator: string) => {
    const updatedGroups = [...indicatorGroups];
    const indicatorIndex = updatedGroups[groupIndex].indexOf(indicator);
    
    if (indicatorIndex > -1) {
      updatedGroups[groupIndex] = updatedGroups[groupIndex].filter(ind => ind !== indicator);
      setIndicatorGroups(updatedGroups);
      
      // Remove corresponding weight
      const updatedWeights = [...groupWeights];
      if (updatedWeights[groupIndex]) {
        updatedWeights[groupIndex].splice(indicatorIndex, 1);
      }
      setGroupWeights(updatedWeights);
      
      setTierDataList([]); // Clear data when groups change
    }
  };
  
  const updateGroupWeight = (groupIndex: number, indicatorIndex: number, weight: number) => {
    const updatedWeights = [...groupWeights];
    if (!updatedWeights[groupIndex]) {
      updatedWeights[groupIndex] = [];
    }
    updatedWeights[groupIndex][indicatorIndex] = weight;
    setGroupWeights(updatedWeights);
    setTierDataList([]); // Clear data when weights change
  };

  /**
   * Handler cho việc chọn nhóm chỉ số định sẵn
   * Tuân theo Single Responsibility: chỉ handle việc thêm group indicators
   * 
   * @param groupIndicators - Array các indicators trong nhóm được chọn
   */
  const handlePredefinedGroupSelect = (groupIndicators: string[]) => {
    if (groupIndicators.length === 0) {
      console.warn("⚠️ Empty group indicators provided");
      return;
    }

    // Validate indicators exist in available indicators list
    const validIndicators = groupIndicators.filter(indicator => 
      indicators.includes(indicator)
    );

    if (validIndicators.length === 0) {
      toast({
        title: "Không có chỉ số hợp lệ",
        description: "Các chỉ số trong nhóm không có sẵn trong hệ thống",
        variant: "destructive",
      });
      return;
    }

    // Add as a new group
    const newGroup = [...indicatorGroups, validIndicators];
    setIndicatorGroups(newGroup);

    // Log for debugging
    console.log("✅ Added predefined group:", {
      totalIndicators: groupIndicators.length,
      validIndicators: validIndicators.length,
      indicators: validIndicators
    });

    // Show success notification
    toast({
      title: "Nhóm chỉ số đã được thêm",
      description: `Đã thêm ${validIndicators.length} chỉ số vào nhóm mới`,
      variant: "default",
    });
  };

  /**
   * Handler cho việc xóa nhóm chỉ số (same as removeIndicatorGroup but with better naming for predefined groups)
   * 
   * @param groupIndex - Index của nhóm cần xóa
   */
  const handlePredefinedGroupRemove = (groupIndex: number) => {
    if (groupIndex < 0 || groupIndex >= indicatorGroups.length) {
      console.error("❌ Invalid group index for removal:", groupIndex);
      return;
    }

    const updatedGroups = indicatorGroups.filter((_, index) => index !== groupIndex);
    setIndicatorGroups(updatedGroups);

    // Show success notification
    toast({
      title: "Nhóm chỉ số đã được xóa",
      description: `Đã xóa nhóm ${groupIndex + 1}`,
      variant: "default",
    });
  };
  
  // Get indicator description with fallback
  const getIndicatorDescription = (indicator: string): string => {
    if (indicatorDescriptions[indicator]) {
      return indicatorDescriptions[indicator];
    }
    // Fallback to ratingApi method if available
    return ratingApi.getIndicatorDescription(indicator);
  };

  /**
   * Identify if a group of indicators matches a predefined group
   * Returns the group name if it matches, otherwise null
   */
  const identifyIndicatorGroup = (indicators: string[]): string | null => {
    if (!indicators || indicators.length === 0) return null;

    // Sort both arrays for comparison
    const sortedIndicators = [...indicators].sort();
    
    for (const group of INDICATOR_GROUPS) {
      const sortedGroupIndicators = [...group.indicators].sort();
      
      // Check if arrays are equal
      if (sortedIndicators.length === sortedGroupIndicators.length &&
          sortedIndicators.every((indicator, index) => indicator === sortedGroupIndicators[index])) {
        return group.name;
      }
    }
    
    return null; // No matching predefined group found
  };

  /**
   * Get display name for a group of indicators
   * Returns group name if it matches a predefined group, otherwise returns indicator list
   */
  const getGroupDisplayName = (indicators: string[]): string => {
    const groupName = identifyIndicatorGroup(indicators);
    if (groupName) {
      return groupName;
    }
    
    // Fallback to indicator list for custom groups
    return indicators.join(" + ");
  };
  
  // Format indicator display name
  const formatIndicatorDisplay = (indicator: string): string => {
    const description = getIndicatorDescription(indicator);
    return description ? `${indicator} – ${description}` : indicator;
  };
  
  // Format group display name
  const formatGroupDisplay = (group: string[], groupIndex: number): string => {
    if (group.length === 0) return `Group ${groupIndex + 1} (empty)`;
    const indicators = group.join(" + ");
    const descriptions = group.map(ind => getIndicatorDescription(ind)).filter(Boolean);
    
    if (descriptions.length > 0) {
      return `Group ${groupIndex + 1}: ${indicators}\n${descriptions.map(desc => `• ${desc}`).join('\n')}`;
    }
    return `Group ${groupIndex + 1}: ${indicators}`;
  };
  
  const exportToCSV = () => {
    if (!tierDataList || tierDataList.length === 0) return;
    
    let csvContent = "Indicator,Tier,Range_Min,Range_Max,Company_Count\n";
    
    tierDataList.forEach(tierData => {
      tierData.tiers.forEach(tier => {
        const rangeMin = tier.range[0] === '-inf' ? 'Negative Infinity' : tier.range[0];
        const rangeMax = tier.range[1] === 'inf' ? 'Positive Infinity' : tier.range[1];
        csvContent += `${tierData.indicator},${tier.tier},${rangeMin},${rangeMax},${tier.count}\n`;
      });
    });
    
    if (companyDetails.length > 0) {
      csvContent += "\n\nCompany_Details\n";
      csvContent += "Tax_Code,Company_Name,Sector,Score,Tier,Indicator,Risk_Level\n";
      companyDetails.forEach(company => {
        csvContent += `${company.taxcode},${company.name},${company.sector},${company.score.toFixed(2)},${company.tier},${company.indicator},${company.risk_level}\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `company_rating_${selectedSector}_${selectedIndicators.join('_')}.csv`;
    link.click();
    
    toast({
      title: "CSV Exported",
      description: "Company rating data has been exported successfully",
      variant: "default",
    });
  };

  /**
   * Export CSV for individual indicator with detailed company data
   * @param indicatorName - Name of the indicator to export
   * @param rawApiResponse - Raw API response containing tier_labels data
   */
  const exportIndicatorCSV = async (indicatorName: string, rawApiResponse?: any) => {
    if (!rawApiResponse || !rawApiResponse.tier_labels) {
      toast({
        title: "Export Failed",
        description: "No detailed company data available for this indicator",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("📊 Exporting CSV for indicator:", indicatorName);
      console.log("🔍 Raw API response:", rawApiResponse);

      // CSV header
      let csvContent = "taxcode,sector_unique_id,yearreport,indicator_label,value\n";
      
      // Extract companies from all tiers
      const allCompanies: any[] = [];
      
      rawApiResponse.tier_labels.forEach((tierObj: any) => {
        Object.entries(tierObj).forEach(([tierName, tierData]: [string, any]) => {
          if (tierData.tiers_companies && Array.isArray(tierData.tiers_companies)) {
            tierData.tiers_companies.forEach((company: any) => {
              allCompanies.push({
                taxcode: company.taxcode || '',
                sector_unique_id: company.sector_unique_id || '',
                yearreport: company.yearreport || '',
                indicator_label: tierName, // T1, T2, T3, etc.
                value: company[indicatorName] || 0 // Get the indicator value
              });
            });
          }
        });
      });

      console.log("📋 Extracted companies:", allCompanies.length);

      // Generate CSV rows
      allCompanies.forEach(company => {
        csvContent += `${company.taxcode},${company.sector_unique_id},${company.yearreport},${company.indicator_label},${company.value}\n`;
      });

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${indicatorName}_companies_${selectedSector}_${timestamp}.csv`;
      link.download = filename;
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "CSV Exported Successfully",
        description: `${allCompanies.length} companies exported for ${indicatorName}`,
        variant: "default",
      });

    } catch (error) {
      console.error("❌ Export failed:", error);
      toast({
        title: "Export Failed",
        description: `Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="app-container-custom flex flex-col lg:flex-row overflow-auto bg-background">
      {/* Left Sidebar - Controls */}
      <div className="w-full lg:w-80 lg:min-w-[280px] lg:max-w-[400px] xl:w-96 bg-card border-r border-border flex flex-col sidebar-flex">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Company Rating Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Analyze company risk ratings by sector and indicators
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* API Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Rating API Configuration</h3>
            
            <Form {...apiForm}>
              <form onSubmit={apiForm.handleSubmit(onApiConfigSubmit)} className="space-y-4">
                <FormField
                  control={apiForm.control}
                  name="endpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scoring URL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://api.rating-service.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Connection Status */}
                <div className="flex items-center space-x-2">
                  {connectionStatus === "connected" ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <Wifi className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Connected</span>
                    </>
                  ) : connectionStatus === "checking" ? (
                    <>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      <span className="text-sm text-yellow-600">Checking...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <WifiOff className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Disconnected</span>
                    </>
                  )}
                </div>
                
                <Button type="submit" className="w-full">
                  Connect to API
                </Button>
              </form>
            </Form>
          </div>
          
          <Separator />
          
          {connectionStatus === "connected" && (
            <>
              {/* Analysis Mode Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Analysis Mode</h3>
                
                <div className="flex space-x-2">
                  <Button
                    variant={analysisMode === "individual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setAnalysisMode("individual");
                      setTierDataList([]); // Clear existing data when switching modes
                    }}
                    className="flex-1"
                  >
                    📊 Individual Indicators
                  </Button>
                  <Button
                    variant={analysisMode === "group" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setAnalysisMode("group");
                      setTierDataList([]); // Clear existing data when switching modes
                    }}
                    className="flex-1"
                  >
                    📈 Indicator Groups
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                  {analysisMode === "individual" ? (
                    <p><strong>Individual Mode:</strong> Analyze each financial indicator separately. Select multiple indicators to compare their tier distributions.</p>
                  ) : (
                    <p><strong>Group Mode:</strong> Create groups of indicators for combined analysis. Each group will be treated as a composite indicator.</p>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Clustering Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Clustering Configuration</h3>
                
                <div className="space-y-3">
                  {/* Algorithm Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Clustering Algorithm</Label>
                    <Select 
                      value={clusteringConfig.algorithm} 
                      onValueChange={(value: "kmeans" | "dbscan" | "meanshift") => {
                        setClusteringConfig(prev => ({ ...prev, algorithm: value }));
                        setTierDataList([]); // Clear data when algorithm changes
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kmeans">K-Means (Recommended)</SelectItem>
                        <SelectItem value="dbscan">DBSCAN (Density-based)</SelectItem>
                        <SelectItem value="meanshift">Mean Shift (Mode-seeking)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {clusteringConfig.algorithm === "kmeans" && "Partitions data into k clusters using centroids"}
                      {clusteringConfig.algorithm === "dbscan" && "Groups densely packed points, handles noise well"}
                      {clusteringConfig.algorithm === "meanshift" && "Finds cluster centers by shifting towards density peaks"}
                    </p>
                  </div>
                  
                  {/* Number of Clusters (K) */}
                  <div className="space-y-2">
                    <Label className="text-xs">Number of Clusters (K)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="2"
                        max="15"
                        value={clusteringConfig.k}
                        onChange={(e) => {
                          const newK = parseInt(e.target.value) || 8;
                          setClusteringConfig(prev => ({ ...prev, k: newK }));
                          setTierDataList([]); // Clear data when k changes
                        }}
                        className="w-20 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">
                        tiers (T1-T{clusteringConfig.k})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Higher K = More granular tiers, Lower K = Broader categories
                    </p>
                  </div>
                  
                  {/* Configuration Summary */}
                  <div className="p-2 bg-muted/30 rounded text-xs">
                    <p className="font-medium mb-1">Current Configuration:</p>
                    <p>• Algorithm: <span className="font-mono">{clusteringConfig.algorithm}</span></p>
                    <p>• Clusters: <span className="font-mono">{clusteringConfig.k}</span> tiers</p>
                    <p>• Mode: <span className="font-mono">high_good</span> (higher score = better tier)</p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {analysisMode === "individual" ? (
                // Individual Indicator Selection
                <>
                  {/* Indicator Selection */}
                  <div className="space-y-2">
                    <Label>Financial Indicators (Multi-select)</Label>
                {indicators.length === 0 ? (
                  <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-md">
                    <p className="text-sm text-yellow-700">
                      ⚠️ No indicators available. 
                      {connectionStatus === "connected" 
                        ? "API connected but returned no indicators. Check if the API endpoint supports /indicator route."
                        : "Please connect to a valid Rating API first."
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* All/None buttons */}
                    <div className="flex space-x-2">
                      <Button 
                        type="button"
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedIndicators([...indicators])}
                      >
                        Select All
                      </Button>
                      <Button 
                        type="button"
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedIndicators([])}
                      >
                        Clear All
                      </Button>
                    </div>
                    
                    {/* Indicator checkboxes */}
                    <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">{/* Increased from max-h-40 to max-h-60 */}
                      {indicators.map(indicator => (
                        <div key={indicator} className="flex items-start space-x-2 p-2 hover:bg-muted/50 rounded">
                          <input
                            type="checkbox"
                            id={`indicator-${indicator}`}
                            checked={selectedIndicators.includes(indicator)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIndicators([...selectedIndicators, indicator]);
                              } else {
                                setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                              }
                            }}
                            className="rounded border-gray-300 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <label htmlFor={`indicator-${indicator}`} className="text-sm font-mono cursor-pointer block">
                                {indicator}
                              </label>
                            </div>
                            <p className="text-xs text-muted-foreground truncate" title={getIndicatorDescription(indicator)}>
                              {getIndicatorDescription(indicator)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Selected count */}
                    <p className="text-xs text-muted-foreground">
                      {selectedIndicators.length} of {indicators.length} indicators selected
                    </p>
                    
                    {/* Indicator Weights */}
                    {selectedIndicators.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <Label className="text-xs">Indicator Weights</Label>
                        <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {selectedIndicators.map(indicator => (
                            <div key={`weight-${indicator}`} className="flex items-center justify-between space-x-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-mono">{indicator}</span>
                                <p className="text-xs text-muted-foreground truncate">
                                  {getIndicatorDescription(indicator)}
                                </p>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Input
                                  type="number"
                                  min="0.1"
                                  max="5.0"
                                  step="0.1"
                                  value={indicatorWeights[indicator] || 1.0}
                                  onChange={(e) => {
                                    const weight = parseFloat(e.target.value) || 1.0;
                                    setIndicatorWeights(prev => ({
                                      ...prev,
                                      [indicator]: weight
                                    }));
                                    setTierDataList([]); // Clear data when weights change
                                  }}
                                  className="w-16 h-6 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">×</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded">
                          <p><strong>💡 Weight Guide:</strong></p>
                          <p>• 1.0 = Normal importance (default)</p>
                          <p>• {">"} 1.0 = Higher importance in clustering</p>
                          <p>• {"<"} 1.0 = Lower importance in clustering</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
                </>
              ) : (
                // Group Indicator Selection
                <>
                  {/* Indicator Groups */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Indicator Groups</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addIndicatorGroup}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Group
                      </Button>
                    </div>

                    {/* Predefined Groups Selector */}
                    <div className="mb-6">
                      <IndicatorGroupSelector
                        selectedIndicators={selectedIndicators}
                        indicatorGroups={indicatorGroups}
                        onGroupSelect={handlePredefinedGroupSelect}
                        onGroupRemove={handlePredefinedGroupRemove}
                        loading={loading}
                        disabled={indicators.length === 0}
                      />
                    </div>
                    
                    {indicators.length === 0 ? (
                      <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-md">
                        <p className="text-sm text-yellow-700">
                          ⚠️ No indicators available for grouping.
                        </p>
                      </div>
                    ) : indicatorGroups.length === 0 ? (
                      <div className="p-3 border border-gray-200 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700 text-center">
                          No indicator groups created yet.<br/>
                          <span className="text-xs">Click "Add Group" to create your first indicator group.</span>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {indicatorGroups.map((group, groupIndex) => (
                          <Card key={groupIndex} className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-sm font-medium">Group {groupIndex + 1}</h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeIndicatorGroup(groupIndex)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            {/* Indicator selection for this group */}
                            <div className="space-y-2">
                              <Select
                                value=""
                                onValueChange={(indicator) => addIndicatorToGroup(groupIndex, indicator)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Add indicator to group..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {indicators
                                    .filter(indicator => !group.includes(indicator))
                                    .map(indicator => (
                                      <SelectItem key={indicator} value={indicator}>
                                        <div className="text-left">
                                          <div className="font-mono text-xs">{indicator}</div>
                                          <div className="text-xs text-muted-foreground truncate">
                                            {getIndicatorDescription(indicator)}
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                              
                              {/* Show selected indicators in this group */}
                              {group.length > 0 && (
                                <div className="space-y-2 mt-2">
                                  <div className="flex flex-wrap gap-1">
                                    {group.map(indicator => (
                                      <Badge 
                                        key={indicator} 
                                        variant="secondary" 
                                        className="cursor-pointer text-xs"
                                        onClick={() => removeIndicatorFromGroup(groupIndex, indicator)}
                                        title={`${indicator} - ${getIndicatorDescription(indicator)}\nClick to remove`}
                                      >
                                        {indicator} ×
                                      </Badge>
                                    ))}
                                  </div>
                                  
                                  {/* Group Weights */}
                                  <div className="space-y-1">
                                    <Label className="text-xs">Indicator Weights in Group</Label>
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                      {group.map((indicator, indicatorIndex) => (
                                        <div key={`group-${groupIndex}-${indicator}`} className="flex items-center justify-between space-x-2 text-xs">
                                          <span className="font-mono flex-1 min-w-0 truncate" title={indicator}>
                                            {indicator}
                                          </span>
                                          <div className="flex items-center space-x-1">
                                            <Input
                                              type="number"
                                              min="0.1"
                                              max="5.0"
                                              step="0.1"
                                              value={groupWeights[groupIndex]?.[indicatorIndex] || 1.0}
                                              onChange={(e) => {
                                                const weight = parseFloat(e.target.value) || 1.0;
                                                updateGroupWeight(groupIndex, indicatorIndex, weight);
                                              }}
                                              className="w-14 h-5 text-xs"
                                            />
                                            <span className="text-muted-foreground">×</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="text-xs text-muted-foreground">
                                {group.length} indicators in this group
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                    
                    {/* Group summary */}
                    <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                      <p><strong>Groups Summary:</strong> {indicatorGroups.length} groups created</p>
                      <p><strong>Total Indicators:</strong> {indicatorGroups.flat().length} indicators assigned to groups</p>
                    </div>
                  </div>
                </>
              )}
              
              {/* Sector Selection */}
              <div className="space-y-2">
                <Label>Industry Sector</Label>
                <Select 
                  value={selectedSector} 
                  onValueChange={(value) => {
                    // Clear existing data immediately when sector changes
                    setTierDataList([]);
                    setSelectedSector(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">
                      All Sectors
                    </SelectItem>
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"].map(sector => (
                      <SelectItem key={sector} value={sector}>
                        Sector {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Group Label - Only show for specific sectors */}
              {selectedSector !== "All" && (
                <div className="space-y-2">
                  <Label>Group Label</Label>
                  <Select value={selectedGroupLabel.toString()} onValueChange={(value) => setSelectedGroupLabel(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Group 0</SelectItem>
                      {[1, 2, 3, 4].map(label => (
                        <SelectItem key={label} value={label.toString()}>
                          Group {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Separator />
              
              {/* Export */}
              <Button 
                onClick={exportToCSV} 
                className="w-full flex items-center gap-2"
                disabled={!tierDataList || tierDataList.length === 0}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {connectionStatus === "connected" ? (
          <>
            {/* Chart */}
            <Card className="flex-1 m-4 mb-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📊 Company Rating Distribution
                  {tierDataList && tierDataList.length > 0 && (
                    <Badge variant="secondary">{tierDataList.length} indicator(s)</Badge>
                  )}
                </CardTitle>
                
                {/* Chart Description */}
                {tierDataList && tierDataList.length > 0 && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                    <h4 className="text-sm font-semibold mb-2 text-foreground">📋 Hướng dẫn đọc biểu đồ:</h4>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p><strong>• Cấu trúc biểu đồ:</strong> Biểu đồ cột thể hiện phân bố doanh nghiệp theo các mức rating</p>
                          <p><strong>• Trục ngang (X):</strong> Các mức tier từ T1 đến T8 kèm score range tương ứng</p>
                          <p><strong>• Trục dọc (Y):</strong> Số lượng doanh nghiệp trong từng tier</p>
                        </div>
                        <div className="space-y-1">
                          <p><strong>• Thang đánh giá:</strong></p>
                          <div className="ml-4 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                              <span>T1-T2: Rủi ro thấp nhất (Tốt nhất)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                              <span>T3-T5: Rủi ro trung bình</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-500 rounded"></div>
                              <span>T6-T8: Rủi ro cao nhất (Cần cẩn trọng)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                        <p><strong>🔬 Phương pháp phân loại (Method):</strong></p>
                        <div className="ml-4 space-y-0.5">
                          <p><strong>• K-means clustering:</strong> Thuật toán phân cụm tự động chia doanh nghiệp thành các nhóm</p>
                          <p><strong>• High-good mode:</strong> Giá trị cao = Tốt → T1 có score cao nhất (ít rủi ro)</p>
                          <p><strong>• Low-good mode:</strong> Giá trị thấp = Tốt → T1 có score thấp nhất (ít rủi ro)</p>
                          <p className="text-xs italic">*Mode được xác định dựa trên bản chất của từng chỉ số tài chính</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                        <p><strong>🏢 Phạm vi phân tích:</strong></p>
                        <div className="ml-4 space-y-0.5">
                          <p><strong>• Sector cụ thể:</strong> Phân tích trong một ngành cụ thể với Group Label</p>
                          <p><strong>• All Sectors:</strong> Phân tích toàn bộ doanh nghiệp trên tất cả các ngành</p>
                          <p className="text-xs italic">*Chọn "All Sectors" để xem thang điểm tổng quan trên toàn bộ các doanh nghiệp (toàn thị trường)</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p><strong>💡 Cách sử dụng:</strong> Hover chuột lên các cột để xem chi tiết score range. </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-6 h-full">
                {loading ? (
                  <div className="flex items-center justify-center h-full min-h-[500px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading tier data...</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedSector === "All" ? "Analyzing all sectors..." : `Analyzing sector ${selectedSector}...`}
                      </p>
                    </div>
                  </div>
                ) : tierDataList && tierDataList.length > 0 ? (
                  <div ref={containerRef} className="w-full h-full min-h-[500px]" />
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center max-w-md">
                      <div className="mb-4">📊</div>
                      <h3 className="text-lg font-medium mb-2">Biểu đồ phân bố Rating doanh nghiệp</h3>
                      <p className="text-muted-foreground mb-4">
                        Chọn chỉ số tài chính và load dữ liệu để xem biểu đồ phân bố tier rating.
                      </p>
                      
                      <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/30 rounded-lg">
                        <p className="font-medium mb-2">📋 Biểu đồ sẽ hiển thị:</p>
                        <div className="text-left space-y-1">
                          <p>• <strong>8 cột màu</strong> đại diện cho các tier T1-T8</p>
                          <p>• <strong>Màu xanh → đỏ</strong> thể hiện mức độ rủi ro tăng dần</p>
                          <p>• <strong>Score range</strong> hiển thị trên trục ngang</p>
                          <p>• <strong>Số lượng doanh nghiệp</strong> trong từng tier</p>
                          <p>• <strong>T1 = Ít rủi ro nhất</strong>, T8 = Rủi ro cao nhất</p>
                          <p>• <strong>Method (K-means):</strong> Phân cụm tự động theo high-good/low-good</p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        Chọn chỉ số tài chính và load dữ liệu để xem biểu đồ phân bố tier rating.
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Data Tables */}
            <div className="flex-1 m-4 mt-2 space-y-4">
              {/* Tier Summary Tables */}
              {tierDataList && tierDataList.length > 0 ? (
                tierDataList.map((tierData, index) => {
                  console.log(`📋 Rendering table ${index} for:`, tierData.indicator, tierData.tiers?.length, "tiers");
                  return (
                    <Card key={`tier-${index}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {(() => {
                                const description = getIndicatorDescription(tierData.indicator);
                                const isGroupIndicator = tierData.indicator.includes('+');
                                
                                if (isGroupIndicator) {
                                  // For group indicators, use group name instead of indicator list
                                  const components = tierData.indicator.split('+').map(comp => comp.trim());
                                  const groupName = getGroupDisplayName(components);
                                  const displayName = identifyIndicatorGroup(components) ? groupName : `Custom Group: ${groupName}`;
                                  
                                  const sector = 'sector' in tierData ? tierData.sector : "All";
                                  const sectorText = sector === "All" 
                                    ? "TẤT CẢ CÁC DOANH NGHIỆP"
                                    : `CÁC DOANH NGHIỆP: (${sector}) ${(sector && sectorNames[sector]) || `Sector ${sector}`}`;
                                  return `${displayName} - ${sectorText}`;
                                } else {
                                  // For individual indicators
                                  const displayTitle = description ? `${tierData.indicator}: ${description}` : tierData.indicator;
                                  const sector = 'sector' in tierData ? tierData.sector : "All";
                                  return sector === "All" 
                                    ? `${displayTitle} - TẤT CẢ CÁC DOANH NGHIỆP`
                                    : `${displayTitle} - CÁC DOANH NGHIỆP: (${sector}) ${(sector && sectorNames[sector]) || `Sector ${sector}`}`;
                                }
                              })()}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {(() => {
                                const isGroupIndicator = tierData.indicator.includes('+');
                                
                                if (isGroupIndicator) {
                                  // For group indicators, show components breakdown
                                  const components = tierData.indicator.split('+');
                                  const componentDescriptions = components.map(comp => {
                                    const desc = getIndicatorDescription(comp.trim());
                                    return desc ? `${comp.trim()}: ${desc}` : comp.trim();
                                  }).join(' • ');
                                  
                                  const sector = 'sector' in tierData ? tierData.sector : "All";
                                  return sector === "All" 
                                    ? `Components: ${componentDescriptions} | Method: ${tierData.method.label} (${tierData.method.mode})`
                                    : `Components: ${componentDescriptions} | Group: ${('group_label' in tierData) ? tierData.group_label : 'N/A'} | Method: ${tierData.method.label} (${tierData.method.mode})`;
                                } else {
                                  // For individual indicators
                                  const sector = 'sector' in tierData ? tierData.sector : "All";
                                  return sector === "All" 
                                    ? `Method: ${tierData.method.label} (${tierData.method.mode})`
                                    : `Group: ${('group_label' in tierData) ? tierData.group_label : 'N/A'} | Method: ${tierData.method.label} (${tierData.method.mode})`;
                                }
                              })()}
                            </p>
                          </div>
                          
                          {/* Export CSV Button for individual indicator */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const rawResponse = rawApiResponses[tierData.indicator];
                              exportIndicatorCSV(tierData.indicator, rawResponse);
                            }}
                            className="flex items-center gap-2 ml-4"
                            disabled={!rawApiResponses[tierData.indicator]}
                            title={`Export detailed company data for ${tierData.indicator}`}
                          >
                            <Download className="h-4 w-4" />
                            Export CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tier</TableHead>
                          <TableHead>Score Range</TableHead>
                          <TableHead>Company Count</TableHead>
                          <TableHead>Percentage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tierData.tiers.map((tier) => {
                          const total = tierData.tiers.reduce((sum, t) => sum + t.count, 0);
                          const percentage = ((tier.count / total) * 100).toFixed(1);
                          
                          let rangeText = '';
                          if (tier.range[0] === '-inf') {
                            rangeText = `≤ ${tier.range[1].toLocaleString()}`;
                          } else if (tier.range[1] === 'inf') {
                            rangeText = `≥ ${tier.range[0].toLocaleString()}`;
                          } else {
                            rangeText = `${tier.range[0].toLocaleString()} - ${tier.range[1].toLocaleString()}`;
                          }
                          
                          return (
                            <TableRow key={tier.tier}>
                              <TableCell>
                                <Badge variant={parseInt(tier.tier.substring(1)) <= 4 ? "default" : "destructive"}>
                                  {tier.tier}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{rangeText}</TableCell>
                              <TableCell>{tier.count.toLocaleString()}</TableCell>
                              <TableCell>{percentage}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No tier data available. Select indicators and ensure API connection.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No API Connection</h3>
              <p className="text-muted-foreground mb-4">
                Please configure and connect to the Rating API in the sidebar to view company ratings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
