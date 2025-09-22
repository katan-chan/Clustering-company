
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Download, Search, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Plotly from 'plotly.js-dist';
import { ratingApi, type RatingConfig, type TierResponse, type TierAllResponse, type CompanyDetail, type Tier } from "@/lib/rating-api";

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
  const plotRef = useRef<HTMLDivElement>(null);
  
  // State for API configuration
  const [ratingConfig, setRatingConfig] = useState<RatingConfig>({
    endpoint: ""
  });
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  const [debugMode, setDebugMode] = useState<boolean>(false);
  
  // State for controls
  const [indicators, setIndicators] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("A");
  const [selectedGroupLabel, setSelectedGroupLabel] = useState<number>(0);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState<string>("");
  
  // State for data
  const [tierDataList, setTierDataList] = useState<TierResponse[]>([]);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetail[]>([]);
  const [loading, setLoading] = useState(false);
  
  // API Configuration Form
  const apiForm = useForm<z.infer<typeof apiSchema>>({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      endpoint: "",
    },
  });
  
  // Load tier data when parameters change
  useEffect(() => {
    if (selectedIndicators.length > 0 && selectedSector && ratingConfig.endpoint) {
      loadTierData();
    }
  }, [selectedIndicators, selectedSector, selectedSector === "All" ? null : selectedGroupLabel, ratingConfig.endpoint]);

  // Update charts when tier data changes
  useEffect(() => {
    console.log("📈 tierDataList changed, updating charts:", tierDataList);
    if (tierDataList && tierDataList.length > 0) {
      updateCharts(tierDataList);
    }
  }, [tierDataList]);

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
  
  const testApiFormat = async () => {
    if (!ratingConfig.endpoint) {
      toast({
        title: "No API Endpoint",
        description: "Please enter an API endpoint first",
        variant: "destructive",
      });
      return;
    }

    try {
      const testUrl = `${ratingConfig.endpoint}/indicator`;
      console.log("🧪 Testing API format:", testUrl);
      
      const response = await fetch(testUrl, {
        method: "GET",
        mode: "cors",
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });

      const rawData = await response.json();
      
      console.log("🧪 Raw API response:", rawData);
      console.log("🧪 Response type:", typeof rawData);
      console.log("🧪 Is array:", Array.isArray(rawData));
      
      if (typeof rawData === 'object' && !Array.isArray(rawData)) {
        console.log("🧪 Object keys:", Object.keys(rawData));
        if (rawData.indicators && typeof rawData.indicators === 'object') {
          const indicatorEntries = Object.entries(rawData.indicators);
          console.log("🧪 Indicators found:", indicatorEntries.length);
          console.log("🧪 Sample indicators:", indicatorEntries.slice(0, 3));
        }
      }
      
      let statusMessage = `Response type: ${typeof rawData}\nIs array: ${Array.isArray(rawData)}`;
      if (rawData.indicators && typeof rawData.indicators === 'object') {
        const count = Object.keys(rawData.indicators).length;
        statusMessage += `\nIndicators found: ${count}\nFormat: ✅ Compatible`;
      } else {
        statusMessage += `\nFormat: ❌ Needs adjustment`;
      }
      
      toast({
        title: "API Format Test",
        description: `${statusMessage}\nCheck console for details`,
        variant: rawData.indicators ? "default" : "destructive",
      });
    } catch (error) {
      console.error("🧪 API test failed:", error);
      toast({
        title: "API Test Failed",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const testTiersApi = async () => {
    if (!ratingConfig.endpoint) {
      toast({
        title: "No API Endpoint",
        description: "Please enter an API endpoint first",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🧪 Testing /tiers/cluster API...");
      
      // Test with different parameter formats
      const testRequests = [
        {
          sector: "A",
          group_label: 1,
          indicator: "STD_RTD13"
        },
        {
          sector: "A", 
          cluster_label: 1,
          indicator: "STD_RTD13"
        },
        {
          sector: "A",
          group_label: 1,
          cluster_label: 1,
          indicator: "STD_RTD13"
        }
      ];

      for (let i = 0; i < testRequests.length; i++) {
        const testPayload = testRequests[i];
        console.log(`🧪 Test ${i + 1}/3 - Payload:`, testPayload);
        
        try {
          const response = await fetch(`${ratingConfig.endpoint}/tiers/cluster`, {
            method: "POST",
            mode: "cors",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify(testPayload),
          });

          const responseText = await response.text();
          console.log(`🧪 Test ${i + 1} Response:`, { 
            status: response.status, 
            statusText: response.statusText,
            body: responseText 
          });

          if (response.ok) {
            const data = JSON.parse(responseText);
            toast({
              title: `Test ${i + 1} Success`,
              description: `Found working format with ${Object.keys(testPayload).join(', ')}`,
              variant: "default",
            });
            console.log(`✅ Test ${i + 1} succeeded with data:`, data);
            return; // Stop on first success
          }
        } catch (error) {
          console.error(`❌ Test ${i + 1} failed:`, error);
        }
      }
      
      toast({
        title: "All Tier API Tests Failed",
        description: "None of the parameter formats worked. Check console for details.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("🧪 Tier API test failed:", error);
      toast({
        title: "Tier API Test Failed",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
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
      setSelectedSector(mockTierData.sector);
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
      
      const indicatorList = await ratingApi.getIndicators(ratingConfig);
      
      console.log("📊 Raw indicators response:", indicatorList);
      console.log("📊 Response type:", typeof indicatorList);
      console.log("📊 Is array:", Array.isArray(indicatorList));
      
      if (!Array.isArray(indicatorList)) {
        console.error("❌ Invalid indicators format:", {
          type: typeof indicatorList,
          isArray: Array.isArray(indicatorList),
          value: indicatorList
        });
        throw new Error(`Invalid indicators format: expected array, got ${typeof indicatorList}. Response: ${JSON.stringify(indicatorList)}`);
      }
      
      if (indicatorList.length === 0) {
        console.warn("⚠️ API returned empty indicators list");
        toast({
          title: "No Indicators Available", 
          description: "The API returned an empty list of indicators. Contact the API provider.",
          variant: "destructive",
        });
      }
      
      setIndicators(indicatorList);
      if (indicatorList.length > 0) {
        setSelectedIndicators([indicatorList[0]]);
        console.log(`✅ Loaded ${indicatorList.length} indicators, selected: ${indicatorList[0]}`);
      }
    } catch (error) {
      console.error("❌ Failed to load indicators:", error);
      setIndicators([]);
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
          "• API should return array of strings",
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
    if (selectedIndicators.length === 0) {
      console.warn("⚠️ No indicators selected for tier data loading");
      setTierDataList([]);
      return;
    }

    console.log("🔄 Loading tier data for:", {
      indicators: selectedIndicators,
      sector: selectedSector,
      groupLabel: selectedGroupLabel,
      endpoint: ratingConfig.endpoint
    });

    setLoading(true);
    try {
      if (selectedSector === "All") {
        // Use /tiers/all API for All Sectors
        console.log("🌍 Loading tier data for All Sectors");
        const tierResponses = await Promise.all(
          selectedIndicators.map(async (indicator) => {
            console.log(`📊 Fetching tier data for all sectors, indicator: ${indicator}`);
            const response = await ratingApi.getTiersAll({
              indicator: indicator,
            }, ratingConfig);
            console.log(`✅ Tier All data received for ${indicator}:`, response);
            
            // Convert TierAllResponse to TierResponse format for consistency
            const normalizedResponse: TierResponse = {
              group_label: -1, // Special value to indicate "All Sectors"
              indicator: response.indicator,
              method: response.method,
              sector: "All",
              tiers: response.tiers
            };
            
            return normalizedResponse;
          })
        );
        
        console.log("🎯 All tier responses received (All Sectors):", tierResponses);
        setTierDataList(tierResponses);
      } else {
        // Use existing /tiers/cluster API for specific sector
        console.log(`🏢 Loading tier data for specific sector: ${selectedSector}`);
        const tierResponses = await Promise.all(
          selectedIndicators.map(async (indicator) => {
            console.log(`📊 Fetching tier data for indicator: ${indicator}`);
            const response = await ratingApi.getTiers({
              sector: selectedSector,
              group_label: selectedGroupLabel,
              indicator: indicator,
            }, ratingConfig);
            console.log(`✅ Tier data received for ${indicator}:`, response);
            return response;
          })
        );
        
        console.log("🎯 All tier responses received:", tierResponses);
        
        // Validate tier responses
        tierResponses.forEach((response, index) => {
          console.log(`🔍 Validating response ${index}:`, {
            indicator: response.indicator,
            sector: response.sector,
            groupLabel: response.group_label,
            method: response.method,
            tiersCount: response.tiers?.length || 0,
            sampleTier: response.tiers?.[0]
          });
        });
        
        setTierDataList(tierResponses);
      }
      // updateCharts will be called automatically by useEffect when tierDataList changes
    } catch (error) {
      console.error("❌ Failed to load tier data:", error);
      
      // Clear tier data on error
      setTierDataList([]);
      
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
  
  const updateCharts = (tierDataList: TierResponse[]) => {
    console.log("📈 Starting chart update with data:", tierDataList);
    console.log("📈 plotRef.current:", plotRef.current);
    console.log("📈 Plotly available:", typeof Plotly !== 'undefined');
    
    if (!plotRef.current) {
      console.error("❌ Plot container not found");
      return;
    }
    
    if (typeof Plotly === 'undefined') {
      console.error("❌ Plotly not available");
      plotRef.current.innerHTML = '<div class="flex items-center justify-center h-full text-red-500">Plotly library not loaded</div>';
      return;
    }
    
    if (!tierDataList || tierDataList.length === 0) {
      console.warn("⚠️ No tier data to display");
      plotRef.current.innerHTML = '<div class="flex items-center justify-center h-full text-muted-foreground">No tier data available. Select indicators and load data.</div>';
      return;
    }
    
    // Clear previous plots
    plotRef.current.innerHTML = '';
    console.log("🧹 Cleared previous plots");
    
    tierDataList.forEach((tierData, index) => {
      console.log(`📊 Creating chart ${index} for indicator:`, tierData.indicator);
      console.log(`📊 Tier data structure:`, {
        indicator: tierData.indicator,
        sector: tierData.sector,
        group_label: tierData.group_label,
        method: tierData.method,
        tiersCount: tierData.tiers?.length,
        tiers: tierData.tiers
      });
      
      if (!tierData.tiers || tierData.tiers.length === 0) {
        console.warn(`⚠️ No tiers data for ${tierData.indicator}`);
        return;
      }
      
      // Create a div for each chart
      const chartDiv = document.createElement('div');
      chartDiv.id = `chart-${index}`;
      chartDiv.style.height = '500px';
      chartDiv.style.marginBottom = '20px';
      chartDiv.style.width = '100%';
      plotRef.current!.appendChild(chartDiv);
      console.log(`📊 Chart div created:`, chartDiv.id);
      
      // Helper function to format range values
      const formatRange = (range: [number | string, number | string]) => {
        const [min, max] = range;
        
        if (min === '-inf' && max === 'inf') {
          return 'All values';
        } else if (min === '-inf') {
          const maxVal = typeof max === 'number' ? max.toExponential(2) : max;
          return `≤ ${maxVal}`;
        } else if (max === 'inf') {
          const minVal = typeof min === 'number' ? min.toExponential(2) : min;
          return `≥ ${minVal}`;
        } else {
          const minVal = typeof min === 'number' ? min.toExponential(2) : min;
          const maxVal = typeof max === 'number' ? max.toExponential(2) : max;
          return `${minVal} - ${maxVal}`;
        }
      };
      
      // Create labels with tier and range information
      const tierLabels = tierData.tiers.map(t => {
        const rangeText = formatRange(t.range);
        return `${t.tier}<br><span style="font-size: 10px; color: #666;">${rangeText}</span>`;
      });
      
      const tierCounts = tierData.tiers.map(t => t.count);
      
      console.log(`📊 Chart data for ${tierData.indicator}:`, {
        labels: tierLabels,
        counts: tierCounts,
        method: tierData.method,
        totalTiers: tierLabels.length
      });
      
      // Enhanced color scheme: T1 (best) = emerald green, gradually to T8 (worst) = red
      const tierColors = [
        '#10b981', // T1 - Emerald 500 (best)
        '#22c55e', // T2 - Green 500  
        '#84cc16', // T3 - Lime 500
        '#eab308', // T4 - Yellow 500
        '#f59e0b', // T5 - Amber 500
        '#f97316', // T6 - Orange 500
        '#ef4444', // T7 - Red 500
        '#dc2626'  // T8 - Red 600 (worst)
      ];
      
      const trace = {
        x: tierLabels,
        y: tierCounts,
        type: 'bar' as const,
        marker: {
          color: tierColors.slice(0, tierLabels.length),
          line: { color: '#374151', width: 1 }
        },
        text: tierCounts.map(count => `${count} companies`),
        textposition: 'auto' as const,
        hovertemplate: tierData.tiers.map((tier, idx) => {
          const rangeText = formatRange(tier.range);
          return `<b>${tier.tier}</b><br>Range: ${rangeText}<br>Companies: ${tier.count}<br>Sector: ${tierData.sector}<extra></extra>`;
        }),
        customdata: tierData.tiers.map(tier => ({
          tier: tier.tier,
          range: formatRange(tier.range),
          count: tier.count
        }))
      };
      
      const layout = {
        title: {
          text: tierData.sector === "All" 
            ? `${tierData.indicator}: ${ratingApi.getIndicatorDescription(tierData.indicator)}<br><sub>TẤT CẢ CÁC DOANH NGHIỆP TOÀN BỘ SECTORS</sub><br><sub>Method: ${tierData.method.label} (${tierData.method.mode})</sub>`
            : `${tierData.indicator}: ${ratingApi.getIndicatorDescription(tierData.indicator)}<br><sub>CÁC DOANH NGHIỆP: (${tierData.sector}) ${sectorNames[tierData.sector] || `Sector ${tierData.sector}`}</sub><br><sub>Group: ${tierData.group_label} | Method: ${tierData.method.label} (${tierData.method.mode})</sub>`,
          font: { size: 16 }
        },
        xaxis: { 
          title: 'Rating Tiers with Score Ranges (T1=Best → T8=Worst)', 
          tickfont: { size: 10 },
          tickangle: 0,
          automargin: true
        },
        yaxis: { title: 'Number of Companies', tickfont: { size: 12 } },
        margin: { t: 160, r: 50, b: 120, l: 60 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif' }
      };
      
      const config = {
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        responsive: true
      };
      
      try {
        console.log(`📈 Creating Plotly chart for ${tierData.indicator}...`);
        console.log(`📈 Trace data:`, trace);
        console.log(`📈 Layout data:`, layout);
        console.log(`📈 Chart div:`, chartDiv);
        
        // Use a timeout to ensure DOM is ready
        setTimeout(() => {
          Plotly.newPlot(chartDiv, [trace], layout, config)
            .then(() => {
              console.log(`✅ Chart created successfully for ${tierData.indicator}`);
              
              // Add click handler after chart is created
              chartDiv.on('plotly_click', (clickData: any) => {
                if (clickData.points && clickData.points[0]) {
                  const tierIndex = clickData.points[0].pointIndex;
                  const tierInfo = tierData.tiers[tierIndex];
                  const rangeText = formatRange(tierInfo.range);
                  
                  toast({
                    title: `${tierData.indicator} - Tier ${tierInfo.tier}`,
                    description: `Sector: ${selectedSector} | Range: ${rangeText} | Companies: ${tierInfo.count}`,
                    variant: "default",
                  });
                }
              });
            })
            .catch((plotError) => {
              console.error(`❌ Failed to create chart for ${tierData.indicator}:`, plotError);
              chartDiv.innerHTML = `<div class="flex items-center justify-center h-full text-red-500">
                <div class="text-center">
                  <p>Failed to create chart for ${tierData.indicator}</p>
                  <p class="text-sm mt-2">Error: ${plotError.message || 'Unknown error'}</p>
                </div>
              </div>`;
            });
        }, 100);
        
      } catch (plotError) {
        console.error(`❌ Failed to create chart for ${tierData.indicator}:`, plotError);
        chartDiv.innerHTML = `<div class="flex items-center justify-center h-full text-red-500">
          <div class="text-center">
            <p>Failed to create chart for ${tierData.indicator}</p>
            <p class="text-sm mt-2">Error: ${plotError instanceof Error ? plotError.message : 'Unknown error'}</p>
          </div>
        </div>`;
      }
    });
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
                
                {/* Test API Format Button */}
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={testApiFormat}
                >
                  🧪 Test API Format
                </Button>
                
                {/* Test Tiers API Button */}
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={testTiersApi}
                >
                  🔬 Test Tiers API
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
                            <label htmlFor={`indicator-${indicator}`} className="text-sm font-mono cursor-pointer block">
                              {indicator}
                            </label>
                            <p className="text-xs text-muted-foreground truncate" title={ratingApi.getIndicatorDescription(indicator)}>
                              {ratingApi.getIndicatorDescription(indicator)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Selected count */}
                    <p className="text-xs text-muted-foreground">
                      {selectedIndicators.length} of {indicators.length} indicators selected
                    </p>
                  </div>
                )}
              </div>
              
              {/* Sector Selection */}
              <div className="space-y-2">
                <Label>Industry Sector</Label>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Sectors</SelectItem>
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
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading tier data...</p>
                    </div>
                  </div>
                ) : tierDataList && tierDataList.length > 0 ? (
                  <div ref={plotRef} className="w-full h-full min-h-[500px]" />
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
                          {tierData.sector === "All" 
                            ? `${tierData.indicator}: ${ratingApi.getIndicatorDescription(tierData.indicator)} - TẤT CẢ CÁC DOANH NGHIỆP TOÀN BỘ SECTORS`
                            : `${tierData.indicator}: ${ratingApi.getIndicatorDescription(tierData.indicator)} - CÁC DOANH NGHIỆP: (${tierData.sector}) ${sectorNames[tierData.sector] || `Sector ${tierData.sector}`}`
                          }
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {tierData.sector === "All" 
                            ? `Method: ${tierData.method.label} (${tierData.method.mode})`
                            : `Group: ${tierData.group_label} | Method: ${tierData.method.label} (${tierData.method.mode})`
                          }
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
