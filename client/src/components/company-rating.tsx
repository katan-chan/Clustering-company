
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
import { ratingApi, type RatingConfig, type TierResponse, type TierAllResponse, type TierGroupResponse, type CompanyDetail, type Tier } from "@/lib/rating-api";
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

// Danh sách các chỉ số có nguy cơ cao gặp lỗi int64 serialization
const HIGH_RISK_INDICATORS = [
  'STD_RTD118', // Thanh khoản - Dòng tiền (số lớn)
  'STD_RTD1',   // Tổng tài sản/Vốn chủ sở hữu (số lớn)
  'STD_RTD13',  // Tổng tài sản (TTS) (số lớn)
  'STD_RTD11',  // Lợi nhuận sau thuế (YoY) (số lớn)
  'STD_RTD146', // FFO / Nợ vay (có thể chứa số lớn)
  'STD_RTD71',  // Các chỉ số tài chính khác có thể có số lớn
];

/**
 * Kiểm tra xem indicator có trong danh sách high risk hay không
 */
const isHighRiskIndicator = (indicator: string): boolean => {
  return HIGH_RISK_INDICATORS.includes(indicator);
};

/**
 * Lấy cảnh báo cho indicator nếu cần
 */
const getIndicatorWarning = (indicator: string): string | null => {
  if (isHighRiskIndicator(indicator)) {
    return `⚠️ Chỉ số này có thể gặp lỗi dữ liệu với "All Sectors"`;
  }
  return null;
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
  const [selectedSector, setSelectedSector] = useState<string>("A");
  const [selectedGroupLabel, setSelectedGroupLabel] = useState<number>(0);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState<string>("");
  
  // State for data - updated to handle both single and group responses
  const [tierDataList, setTierDataList] = useState<(TierResponse | TierAllResponse)[]>([]);
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
  }, [analysisMode, selectedIndicators, indicatorGroups, selectedSector, selectedSector === "All" ? null : selectedGroupLabel, ratingConfig.endpoint]);

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
        console.log("🔄 Testing connection to:", data.endpoint);
        const connected = await ratingApi.testConnection({ endpoint: data.endpoint });
        
        if (connected) {
          console.log("✅ Connection test successful");
          setConnectionStatus("connected");
          
          console.log("🔄 Loading indicators...");
          await loadIndicators();
          
          toast({
            title: "Connection Successful",
            description: "Successfully connected to Rating API and loaded indicators",
            variant: "default",
          });
        } else {
          throw new Error("Connection test failed - API endpoint not responding properly");
        }
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


  const loadMockTierData = () => {
    const mockTierData: TierResponse = {
      group_label: 1,
      indicator: "STD_RTD13",
      method: {
        label: "kmeans",
        mode: "high_good"
      },
      sector: "A",
      tiers: [
        {
          count: 16,
          range: [33675958055.407948, "inf"],
          tier: "T1"
        },
        {
          count: 6,
          range: [25563121895.098007, 33675958055.407948],
          tier: "T2"
        },
        {
          count: 9,
          range: [19741161823.207718, 25563121895.098007],
          tier: "T3"
        },
        {
          count: 10,
          range: [13038616362.42207, 19741161823.207718],
          tier: "T4"
        },
        {
          count: 22,
          range: [8048972489.603424, 13038616362.42207],
          tier: "T5"
        },
        {
          count: 21,
          range: [4324821799.931098, 8048972489.603424],
          tier: "T6"
        },
        {
          count: 32,
          range: [1855172563.8052316, 4324821799.931098],
          tier: "T7"
        },
        {
          count: 62,
          range: ["-inf", 1855172563.8052316],
          tier: "T8"
        }
      ]
    };

    console.log("🎭 Loading mock tier data:", mockTierData);
    
    // If no indicators are available, add the mock indicator to the list
    if (!indicators.includes(mockTierData.indicator)) {
      const updatedIndicators = [...indicators, mockTierData.indicator];
      setIndicators(updatedIndicators);
      console.log("📊 Added mock indicator to list:", updatedIndicators);
    }
    
    // Ensure the indicator is selected for proper display
    if (!selectedIndicators.includes(mockTierData.indicator)) {
      setSelectedIndicators([mockTierData.indicator]);
    }
    
    // Ensure sector matches
    if (selectedSector !== mockTierData.sector) {
      setSelectedSector(mockTierData.sector || "All");
    }
    
    // Update tier data and charts
    setTierDataList([mockTierData]);
    // updateCharts will be called automatically by useEffect when tierDataList changes
    
    toast({
      title: "Mock Tier Data Loaded",
      description: `Sample tier data loaded for ${mockTierData.indicator} with ${mockTierData.tiers.length} tiers (T1-T8)`,
      variant: "default",
    });
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
      if (selectedSector === "All") {
        // Use /tiers/all API for All Sectors
        console.log("🌍 Loading tier data for All Sectors");
        
        let indicator;
        if (analysisMode === "individual") {
          // For individual mode, send selected indicators as list
          indicator = selectedIndicators.length === 1 ? selectedIndicators[0] : selectedIndicators;
        } else {
          // For group mode, send indicator groups as list spec
          // Each group becomes an array in the indicator list
          indicator = indicatorGroups.map(group => {
            // If group has only 1 indicator, send as string
            // If group has multiple indicators, send as array
            return group.length === 1 ? group[0] : group;
          });
        }
        
        const response = await ratingApi.getTiersAll({
          indicator: indicator,
          k: 8
        }, ratingConfig);
        
        console.log("✅ Tier All data received:", response);
        
        // Handle both single and group responses
        if ('indicator' in response && typeof response.indicator === 'string') {
          // Single indicator response (TierAllResponse)
          const singleResponse = response as TierAllResponse;
          const normalizedResponse: TierResponse = {
            indicator: singleResponse.indicator,
            method: singleResponse.method,
            sector: "All",
            tiers: singleResponse.tiers
          };
          setTierDataList([normalizedResponse]);
        } else {
          // Group response (TierGroupResponse) - convert to array format
          const groupResponse = response as TierGroupResponse;
          const normalizedResponses: TierResponse[] = Object.entries(groupResponse).map(([label, data]) => ({
            group_label: -1,
            indicator: data.indicator,
            method: data.method,
            sector: "All",
            tiers: data.tiers,
            label: label // Add label for group identification
          }));
          setTierDataList(normalizedResponses);
        }
      } else {
        // Use existing /tiers/cluster API for specific sector
        console.log(`🏢 Loading tier data for specific sector: ${selectedSector}`);
        
        let indicator;
        if (analysisMode === "individual") {
          indicator = selectedIndicators.length === 1 ? selectedIndicators[0] : selectedIndicators;
        } else {
          // For group mode, send indicator groups as list spec
          // Each group becomes an array in the indicator list
          indicator = indicatorGroups.map(group => {
            // If group has only 1 indicator, send as string
            // If group has multiple indicators, send as array
            return group.length === 1 ? group[0] : group;
          });
        }
        
        const response = await ratingApi.getTiers({
          sector: selectedSector,
          cluster_label: selectedGroupLabel,
          indicator: indicator,
          k: 8
        }, ratingConfig);
        
        console.log("✅ Tier cluster data received:", response);
        
        // Handle both single and group responses
        if ('indicator' in response && 'tiers' in response) {
          // Single indicator response
          setTierDataList([response as TierResponse]);
        } else {
          // Group response - convert to array format
          const normalizedResponses: TierResponse[] = Object.entries(response as TierGroupResponse).map(([label, data]) => ({
            group_label: data.group_label || selectedGroupLabel,
            indicator: data.indicator,
            method: data.method,
            sector: data.sector || selectedSector,
            tiers: data.tiers,
            label: label // Add label for group identification
          }));
          setTierDataList(normalizedResponses);
        }
      }
      // updateCharts will be called automatically by useEffect when tierDataList changes
    } catch (error) {
      console.error("❌ Failed to load tier data:", error);
      
      // Clear tier data on error
      setTierDataList([]);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Handle specific int64 serialization error with detailed user message
      if (errorMessage.includes("Object of type int64 is not JSON serializable") || 
          errorMessage.includes("Backend Data Error")) {
        
        const indicatorList = Array.isArray(selectedIndicators) ? selectedIndicators.join(", ") : selectedIndicators;
        
        toast({
          title: "⚠️ Lỗi Dữ Liệu Backend",
          description: `Chỉ số "${indicatorList}" chứa dữ liệu không thể xử lý.\n\n` +
                      `🔧 Backend cần fix:\n` +
                      `• Convert int64 → int/string trước JSON serialize\n` +
                      `• Thêm .astype(int) hoặc .astype(str) trong pandas\n\n` +
                      `💡 Thử chọn chỉ số khác hoặc liên hệ API developer`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error loading tier data",
          description: `Failed to load tier analysis: ${errorMessage}`,
          variant: "destructive",
        });
      }
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
    setIndicatorGroups([...indicatorGroups, []]);
  };
  
  const removeIndicatorGroup = (groupIndex: number) => {
    setIndicatorGroups(indicatorGroups.filter((_, index) => index !== groupIndex));
  };
  
  const addIndicatorToGroup = (groupIndex: number, indicator: string) => {
    const updatedGroups = [...indicatorGroups];
    if (!updatedGroups[groupIndex].includes(indicator)) {
      updatedGroups[groupIndex] = [...updatedGroups[groupIndex], indicator];
      setIndicatorGroups(updatedGroups);
    }
  };
  
  const removeIndicatorFromGroup = (groupIndex: number, indicator: string) => {
    const updatedGroups = [...indicatorGroups];
    updatedGroups[groupIndex] = updatedGroups[groupIndex].filter(ind => ind !== indicator);
    setIndicatorGroups(updatedGroups);
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
                
                {/* Debug: Mock tier data for testing */}
                {connectionStatus === "connected" && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={loadMockTierData}
                  >
                    📊 Load Mock Tier Data
                  </Button>
                )}
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
                      {indicators.map(indicator => {
                        const warning = getIndicatorWarning(indicator);
                        const isHighRisk = isHighRiskIndicator(indicator);
                        
                        return (
                          <div key={indicator} className={`flex items-start space-x-2 p-2 hover:bg-muted/50 rounded ${isHighRisk ? 'bg-yellow-50 border border-yellow-200' : ''}`}>
                            <input
                              type="checkbox"
                              id={`indicator-${indicator}`}
                              checked={selectedIndicators.includes(indicator)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIndicators([...selectedIndicators, indicator]);
                                  
                                  // Show warning for high-risk indicators when selected with All Sectors
                                  if (isHighRisk && selectedSector === "All") {
                                    toast({
                                      title: "⚠️ Chỉ số có rủi ro cao",
                                      description: `${indicator} có thể gặp lỗi khi phân tích "All Sectors". Nếu gặp lỗi, hãy thử chọn sector cụ thể.`,
                                      variant: "default",
                                    });
                                  }
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
                                {isHighRisk && (
                                  <span className="text-yellow-600 text-xs" title={warning || ''}>⚠️</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate" title={getIndicatorDescription(indicator)}>
                                {getIndicatorDescription(indicator)}
                              </p>
                              {warning && selectedSector === "All" && (
                                <p className="text-xs text-yellow-600 mt-1 italic">
                                  {warning}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Selected count */}
                    <p className="text-xs text-muted-foreground">
                      {selectedIndicators.length} of {indicators.length} indicators selected
                    </p>
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
                                <div className="flex flex-wrap gap-1 mt-2">
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
                    
                    {/* Individual indicators for group mode */}
                    <div className="space-y-2">
                      <Label className="text-xs">Individual Indicators (also analyzed separately)</Label>
                      <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                        {indicators.map(indicator => (
                          <div key={indicator} className="flex items-start space-x-2 p-1 hover:bg-muted/50 rounded">
                            <input
                              type="checkbox"
                              id={`group-indicator-${indicator}`}
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
                              <label htmlFor={`group-indicator-${indicator}`} className="text-xs font-mono cursor-pointer block">
                                {indicator}
                              </label>
                              <p className="text-xs text-muted-foreground truncate" title={getIndicatorDescription(indicator)}>
                                {getIndicatorDescription(indicator)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedIndicators.length} individual indicators selected
                      </p>
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
                    
                    // Show warning when selecting "All Sectors" with high-risk indicators
                    if (value === "All") {
                      const highRiskSelected = selectedIndicators.filter(indicator => 
                        isHighRiskIndicator(indicator)
                      );
                      
                      if (highRiskSelected.length > 0) {
                        toast({
                          title: "⚠️ Cảnh báo: All Sectors + Chỉ số rủi ro cao",
                          description: `Các chỉ số: ${highRiskSelected.join(', ')} có thể gặp lỗi dữ liệu khi phân tích toàn bộ sectors.\n\n💡 Nếu gặp lỗi, hãy chọn sector cụ thể thay vì "All Sectors".`,
                          variant: "default",
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">
                      All Sectors
                      {selectedIndicators.some(indicator => isHighRiskIndicator(indicator)) && (
                        <span className="ml-2 text-yellow-600">⚠️</span>
                      )}
                    </SelectItem>
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"].map(sector => (
                      <SelectItem key={sector} value={sector}>
                        Sector {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* High-risk warning for All Sectors */}
                {selectedSector === "All" && selectedIndicators.some(indicator => isHighRiskIndicator(indicator)) && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <p className="text-yellow-700">
                      ⚠️ <strong>Cảnh báo:</strong> Một số chỉ số đã chọn có nguy cơ lỗi cao với "All Sectors"
                    </p>
                    <p className="text-yellow-600 mt-1">
                      Các chỉ số rủi ro: {selectedIndicators.filter(indicator => isHighRiskIndicator(indicator)).join(', ')}
                    </p>
                  </div>
                )}
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
              
              {/* Company Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Company Analysis</h3>
                
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter company tax code..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCompany()}
                  />
                  <Button onClick={addCompany} size="icon" variant="outline">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                
                {selectedCompanies.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Selected Companies:</Label>
                    <div className="flex flex-wrap gap-1">
                      {selectedCompanies.map(company => (
                        <Badge 
                          key={company} 
                          variant="secondary" 
                          className="cursor-pointer"
                          onClick={() => removeCompany(company)}
                        >
                          {company} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
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
                        Hoặc click <Badge variant="outline">📊 Load Mock Tier Data</Badge> để xem dữ liệu mẫu
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
                                ? "TẤT CẢ CÁC DOANH NGHIỆP TOÀN BỘ SECTORS"
                                : `CÁC DOANH NGHIỆP: (${sector}) ${(sector && sectorNames[sector]) || `Sector ${sector}`}`;
                              return `${displayName} - ${sectorText}`;
                            } else {
                              // For individual indicators
                              const displayTitle = description ? `${tierData.indicator}: ${description}` : tierData.indicator;
                              const sector = 'sector' in tierData ? tierData.sector : "All";
                              return sector === "All" 
                                ? `${displayTitle} - TẤT CẢ CÁC DOANH NGHIỆP TOÀN BỘ SECTORS`
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
                                <Badge variant={tier.tier <= "T4" ? "default" : "destructive"}>
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
              
              {/* Company Details Table */}
              {companyDetails.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selected Company Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tax Code</TableHead>
                          <TableHead>Company Name</TableHead>
                          <TableHead>Sector</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead>Risk Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyDetails.map((company) => (
                          <TableRow key={company.taxcode}>
                            <TableCell className="font-mono">{company.taxcode}</TableCell>
                            <TableCell>{company.name}</TableCell>
                            <TableCell>{company.sector}</TableCell>
                            <TableCell>{company.score.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={company.tier <= "T4" ? "default" : "destructive"}>
                                {company.tier}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={company.risk_level === "Low" ? "default" : "destructive"}>
                                {company.risk_level}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
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
