import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Calculator, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getScoring, ratingApi, type RatingConfig, type ScoringRequest, type ScoringResponse, type ScoringCompany, type ScoredCompany } from "@/lib/rating-api";

const apiSchema = z.object({
  endpoint: z.string().url("Please enter a valid URL"),
});

const scoringSchema = z.object({
  taxcode: z.string().min(1, "Tax code is required"),
  sector_unique_id: z.string().optional(),
  cluster_label: z.string().optional(),
});

export default function CompanyScoring() {
  const { toast } = useToast();
  
  // State for API configuration
  const [ratingConfig, setRatingConfig] = useState<RatingConfig>({
    endpoint: ""
  });
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  const [indicators, setIndicators] = useState<string[]>([]);
  
  // Add missing state variables for features and results
  const [features, setFeatures] = useState<{ [key: string]: string }>({});
  
  // State for CSV import feature
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<ScoringCompany[]>([]);
  const [csvResults, setCsvResults] = useState<ScoredCompany[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [showCsvResults, setShowCsvResults] = useState(false);
  
  // State for scoring form - simplified to match new API
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [indicatorWeights, setIndicatorWeights] = useState<{ [key: string]: number }>({});
  const [indicatorValues, setIndicatorValues] = useState<{ [key: string]: string }>({});
  const [scoringResults, setScoringResults] = useState<ScoredCompany[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Scoring Form - updated to match new API
  const scoringForm = useForm<z.infer<typeof scoringSchema>>({
    resolver: zodResolver(scoringSchema),
    defaultValues: {
      taxcode: "0100100008",
      sector_unique_id: "G",
      cluster_label: "",
    },
  });

  // API Configuration Form
  const apiForm = useForm<{ endpoint: string }>({
    defaultValues: {
      endpoint: ""
    }
  });

  // Add missing state variables
  const [renderError, setRenderError] = useState<string>("");
  
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
      const indicatorList = await ratingApi.getIndicators(ratingConfig);
      
      if (!Array.isArray(indicatorList)) {
        throw new Error(`Invalid indicators format: expected array, got ${typeof indicatorList}`);
      }
      
      setIndicators(indicatorList);
      if (indicatorList.length > 0) {
        console.log(`✅ Loaded ${indicatorList.length} indicators`);
      }
    } catch (error) {
      console.error("❌ Failed to load indicators:", error);
      setIndicators([]);
      throw error;
    }
  };
  
  const addFeature = (indicator: string = "") => {
    const key = indicator || `STD_RTD${Object.keys(features).length + 1}`;
    if (!features[key]) {
      setFeatures({ ...features, [key]: "" });
    }
  };
  
  const removeFeature = (key: string) => {
    const newFeatures = { ...features };
    delete newFeatures[key];
    setFeatures(newFeatures);
  };
  
  const updateFeatureKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !newKey.trim()) return;
    
    const newFeatures = { ...features };
    const value = newFeatures[oldKey];
    delete newFeatures[oldKey];
    newFeatures[newKey] = value;
    setFeatures(newFeatures);
  };
  
  const updateFeatureValue = (key: string, value: string) => {
    setFeatures({ ...features, [key]: value });
  };
  
  const loadSampleData = () => {
    const sampleFeatures = {
      "STD_RTD1": "1.4298459294882604",
      "STD_RTD11": "-0.163450134615411",
      "STD_RTD118": "1.1123457018541",
      "STD_RTD13": "8543000995892.0",
      "STD_RTD14": "5974770301965.0",
      "STD_RTD146": "0.1781383557744278",
      "STD_RTD147": "0.8497527575929522",
      "STD_RTD148": "4.87141453245363",
      "STD_RTD26": "0.3161463520193703",
      "STD_RTD28": "0.0597972745346027",
      "STD_RTD31": "1375057176046.0",
      "STD_RTD60": "434719310025.0",
      "STD_RTD61": "2092192374319.0005",
      "STD_RTD64": "7.464660888589531",
      "STD_RTD71": "0.3741207161764617",
      "STD_RTD72": "0.153540383685473",
      "STD_RTD74": "4.483261327033508",
      "STD_RTD75": "5.442856549159517",
      "STD_RTD76": "0.7823628601465016",
      "STD_RTD77": "0.0512084770374026",
      "STD_RTD78": "0.1619771245510531",
      "STD_RTD8": "0.0305950947928251",
      "STD_RTD81": "91.8669083051704",
      "STD_RTD82": "0.0421495190747473",
      "STD_RTD83": "0.2364644639126792",
      "STD_RTD84": "-0.1362858178122266",
      "STD_RTD85": "-0.0132155006995811",
      "STD_RTD86": "0.1888852816570525",
      "STD_RTD87": "-0.0601674462330797",
      "STD_RTD88": "0.0127545665745962",
      "STD_RTD89": "-0.0206688898443121",
      "STD_RTD9": "0.043016865056978",
      "STD_RTD92": "2.540435089698045",
      "STD_RTD93": "2.209298116944523",
      "STD_RTD94": "0.1531385651299867",
      "STD_RTD95": "-0.9756153148702518",
      "STD_RTD96": "4.596509725650529",
      "STD_RTD97": "6.6864117420939735",
      "STD_RTD98": "-0.2108779249659391",
      "STD_RTD99": "-2.8824090067144565",
      "empl_qtty": "6132.0"
    };
    
    setFeatures(sampleFeatures);
    
    // Update form values - only valid schema fields
    scoringForm.setValue("taxcode", "0100100008");
    scoringForm.setValue("sector_unique_id", "G");
    scoringForm.setValue("cluster_label", "");
    
    toast({
      title: "Sample Data Loaded",
      description: "Sample feature data has been loaded into the form",
      variant: "default",
    });
  };
  
  const loadMockScoringResults = () => {
    const mockResults: ScoredCompany[] = [
      {
        taxcode: "0100100008",
        sector: "G",
        cluster_label: 1,
        scores: [
          { indicator: "STD_RTD1", tier: "T2" },
          { indicator: "STD_RTD11", tier: "T3" },
          { indicator: "STD_RTD13", tier: "T1" },
          { indicator: "STD_RTD14", tier: "T1" },
          { indicator: "STD_RTD146", tier: "T2" },
          { indicator: "STD_RTD147", tier: "T4" },
          { indicator: "STD_RTD148", tier: "T5" },
          { indicator: "STD_RTD26", tier: "T2" },
          { indicator: "STD_RTD28", tier: "T6" }
        ],
        // Legacy fields for backward compatibility
        composite_score: 75.5,
        rating: "BBB",
        indicator_scores: {
          "STD_RTD1": 0.85,
          "STD_RTD11": 0.62,
          "STD_RTD13": 0.94,
          "STD_RTD14": 0.91,
          "STD_RTD146": 0.88,
          "STD_RTD147": 0.55,
          "STD_RTD148": 0.45,
          "STD_RTD26": 0.89,
          "STD_RTD28": 0.42
        }
      }
    ];
      
    console.log("🎭 Loading mock scoring results:", mockResults);
    setScoringResults(mockResults);
    
    toast({
      title: "Mock Results Loaded",
      description: "Sample scoring results loaded for testing",
      variant: "default",
    });
  };
  
  const onScoringSubmit = async (data: z.infer<typeof scoringSchema>) => {
    if (Object.keys(features).length === 0) {
      toast({
        title: "No Features",
        description: "Please add at least one feature before scoring",
        variant: "destructive",
      });
      return;
    }
    
    // Validate API endpoint
    if (!ratingConfig.endpoint) {
      toast({
        title: "No API Endpoint",
        description: "Please configure API endpoint first",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      // Convert features to numbers with validation
      const numericFeatures: { [key: string]: number } = {};
      const invalidFeatures: string[] = [];
      
      for (const [key, value] of Object.entries(features)) {
        if (!key.trim()) {
          invalidFeatures.push(`Empty indicator name`);
          continue;
        }
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          invalidFeatures.push(`${key}: "${value}" is not a valid number`);
          continue;
        }
        numericFeatures[key] = numValue;
      }
      
      if (invalidFeatures.length > 0) {
        throw new Error(`Invalid features:\n${invalidFeatures.join('\n')}`);
      }
      
      if (Object.keys(numericFeatures).length === 0) {
        throw new Error("No valid numeric features found");
      }
      
      // Build request in the correct format - separate request for each indicator
      const request = Object.keys(numericFeatures).map(indicator => ({
        taxcode: data.taxcode,
        sector: data.sector_unique_id || null,
        cluster_label: data.cluster_label ? parseInt(data.cluster_label) : null,
        indicators: [indicator], // Single indicator per request
        weights: [1.0], // Single weight for single indicator
        [indicator]: numericFeatures[indicator] // Only include this specific indicator
      }));
      
      console.log("📤 Submitting scoring request (separate indicators):", request);
      console.log(`📊 Total requests: ${request.length} (one per indicator)`);
      
      const response = await fetch(`${ratingConfig.endpoint}/score`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Scoring API response:", result);
      console.log("🔍 API response companies:", result?.companies);
      console.log("🔍 First company scores:", result?.companies?.[0]?.scores);
      
      // Handle the new response format with multiple indicator results
      if (result?.companies?.length > 0) {
        // Combine all scores from all indicator responses into one company result
        const allScores: Array<{ indicator: string; tier: string }> = [];
        
        result.companies.forEach((company: any) => {
          if (company.scores && Array.isArray(company.scores)) {
            allScores.push(...company.scores);
          }
        });
        
        // Create a single consolidated result
        const consolidatedResult = {
          taxcode: data.taxcode,
          sector: data.sector_unique_id || null,
          cluster_label: data.cluster_label ? parseInt(data.cluster_label) : null,
          scores: allScores,
          // Legacy fields for compatibility
          composite_score: 0,
          rating: "N/A",
          indicator_scores: {}
        };
        
        setScoringResults([consolidatedResult]);
        setShowCsvResults(false); // Ensure we show single results, not CSV results
        
        // Debug logging
        console.log("🔍 Consolidated scores from all indicators:", allScores);
        console.log("🔍 Final consolidated result:", consolidatedResult);
        
        // Force immediate feedback for testing
        setTimeout(() => {
          console.log("🔍 scoringResults state after timeout:", scoringResults.length);
        }, 100);
        
        toast({
          title: "Scoring Successful",
          description: `Company ${data.taxcode} scored successfully with ${allScores.length} indicator results`,
        });
        
      } else {
        throw new Error("No scoring results returned from API");
      }
      
      console.log("✅ Scoring completed:", result);
    } catch (error) {
      console.error("❌ Scoring failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Clear any previous results on error
      setScoringResults([]);
      
      toast({
        title: "Scoring Failed",
        description: `Failed to score company: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const getTierColor = (tier: string): "default" | "secondary" | "destructive" => {
    if (tier.match(/^T[12]$/)) return "default"; // T1, T2 - Good
    if (tier.match(/^T[345]$/)) return "secondary"; // T3, T4, T5 - Medium
    if (tier.match(/^T[678]$/)) return "destructive"; // T6, T7, T8 - Bad
    return "secondary";
  };

  // Export single company results to CSV
  const exportSingleToCsv = (useTabs = false) => {
    if (!scoringResults.length) return;
    
    const separator = useTabs ? '\t' : ',';
    
    // Create CSV header
    const basicColumns = ['taxcode', 'sector', 'cluster_label'];
    
    // Get all unique indicators from results
    const allIndicators = new Set<string>();
    scoringResults.forEach(result => {
      result.scores?.forEach(score => {
        allIndicators.add(score.indicator);
      });
    });
    const indicatorColumns = Array.from(allIndicators).sort();
    
    const allColumns = [...basicColumns, ...indicatorColumns];
    const header = allColumns.join(separator);
    
    // Create CSV rows
    const rows = scoringResults.map(result => {
      const row: string[] = [];
      
      // Fill basic info
      row.push(result.taxcode);
      row.push(result.sector || '');
      row.push(result.cluster_label?.toString() || '');
      
      // Create indicator -> tier mapping
      const indicatorTiers: { [key: string]: string } = {};
      result.scores?.forEach(score => {
        indicatorTiers[score.indicator] = score.tier;
      });
      
      // Fill indicator tiers
      indicatorColumns.forEach(indicator => {
        const tier = indicatorTiers[indicator];
        row.push(tier || '');
      });
      
      // Handle values that might contain separators
      return row.map(value => {
        const strValue = value.toString();
        if (separator === ',' && (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n'))) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(separator);
    });
    
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const fileExtension = useTabs ? '_tab.csv' : '.csv';
    link.setAttribute('download', `single_company_scoring_${new Date().getTime()}${fileExtension}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Complete",
      description: `Single company CSV file has been downloaded (${useTabs ? 'tab' : 'comma'} separated)`,
      variant: "default",
    });
  };

  // Export single company results to Excel
  const exportSingleToExcel = () => {
    if (!scoringResults.length) return;
    
    // Create worksheet data
    const wsData = [];
    
    // Create header
    const basicColumns = ['taxcode', 'sector', 'cluster_label'];
    
    // Get all unique indicators
    const allIndicators = new Set<string>();
    scoringResults.forEach(result => {
      result.scores?.forEach(score => {
        allIndicators.add(score.indicator);
      });
    });
    const indicatorColumns = Array.from(allIndicators).sort();
    
    // Header row
    wsData.push([...basicColumns, ...indicatorColumns]);
    
    // Data rows
    scoringResults.forEach(result => {
      const row = [];
      
      // Fill basic info
      row.push(result.taxcode);
      row.push(result.sector || '');
      row.push(result.cluster_label || '');
      
      // Create indicator -> tier mapping
      const indicatorTiers: { [key: string]: string } = {};
      result.scores?.forEach(score => {
        indicatorTiers[score.indicator] = score.tier;
      });
      
      // Fill tier scores for each indicator
      indicatorColumns.forEach(indicator => {
        row.push(indicatorTiers[indicator] || '');
      });
      
      wsData.push(row);
    });
    
    // Convert to CSV format (simple Excel compatible)
    const csvContent = wsData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `single_company_scoring_${new Date().getTime()}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Complete", 
      description: "Single company Excel file has been downloaded",
      variant: "default",
    });
  };

  // CSV column definitions - updated format with cluster_label, indicators, weights
  const csvColumns = [
    "taxcode", "sector", "cluster_label", "indicators", "weights",
    "STD_RTD146", "STD_RTD71", "STD_RTD96", "STD_RTD97", "STD_RTD98", "STD_RTD99",
    "STD_RTD1", "STD_RTD72", "STD_RTD148", "STD_RTD74", "STD_RTD76", "STD_RTD77",
    "STD_RTD78", "STD_RTD81", "STD_RTD64", "STD_RTD75", "STD_RTD13", "STD_RTD14",
    "STD_RTD31", "empl_qtty", "STD_RTD26", "STD_RTD8", "STD_RTD82", "STD_RTD83",
    "STD_RTD84", "STD_RTD85", "STD_RTD86", "STD_RTD9", "STD_RTD11", "STD_RTD28",
    "STD_RTD87", "STD_RTD88", "STD_RTD89", "STD_RTD118", "STD_RTD92", "STD_RTD93",
    "STD_RTD94", "STD_RTD95", "STD_RTD147"
  ];

  // Parse CSV text to companies array - support both old and new formats
  const parseCsvToCompanies = (csvText: string): ScoringCompany[] => {
    const lines = csvText.trim().split('\n');
    const companies: ScoringCompany[] = [];
    
    if (lines.length < 2) {
      throw new Error("CSV file must have at least a header row and one data row");
    }
    
    // Detect separator by checking first line (header)
    const headerLine = lines[0];
    let separator = ',';
    
    // Count commas vs tabs to determine separator
    const commaCount = (headerLine.match(/,/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    
    if (tabCount > commaCount) {
      separator = '\t';
      console.log("📊 Detected tab-separated CSV");
    } else {
      console.log("📊 Detected comma-separated CSV");
    }
    
    // Parse CSV with automatic separator detection
    const parseCsvLine = (line: string): string[] => {
      if (separator === '\t') {
        // Tab-separated: simple split
        return line.split('\t').map(v => v.trim().replace(/"/g, ''));
      } else {
        // Comma-separated: handle quoted values
        const values: string[] = [];
        let currentValue = '';
        let insideQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        // Add the last value
        values.push(currentValue.trim());
        return values;
      }
    };
    
    // Parse header to get column mapping
    const headerValues = parseCsvLine(headerLine);
    const columnMapping: { [key: string]: number } = {};
    headerValues.forEach((header, index) => {
      columnMapping[header.trim()] = index;
    });
    
    console.log("📋 CSV Header mapping:", columnMapping);
    
    // Detect CSV format by checking for key columns
    const hasNewFormat = columnMapping.hasOwnProperty('indicators') && columnMapping.hasOwnProperty('weights');
    const hasOldFormat = columnMapping.hasOwnProperty('taxcode') && Object.keys(columnMapping).some(key => key.includes('features.') || key.startsWith('STD_RTD'));
    
    console.log(`📋 CSV Format detected: ${hasNewFormat ? 'New format (with indicators/weights)' : hasOldFormat ? 'Old format (features columns)' : 'Unknown format'}`);
    
    // Skip header row, process data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      const values = parseCsvLine(line);
      
      if (values.length < 3) {
        console.warn(`⚠️ Skipping row ${i}: insufficient columns (${values.length})`);
        continue;
      }
      
      let company: ScoringCompany;
      
      if (hasNewFormat) {
        // NEW FORMAT: with indicators and weights columns
        // Extract basic company info
        const taxcode = values[columnMapping['taxcode']] || '';
        const sector = values[columnMapping['sector']] || null;
        const clusterLabelStr = values[columnMapping['cluster_label']] || '';
        const cluster_label = clusterLabelStr && clusterLabelStr !== '' ? parseInt(clusterLabelStr) : null;
        
        // Parse indicators and weights
        const indicatorsStr = values[columnMapping['indicators']] || '';
        const weightsStr = values[columnMapping['weights']] || '';
        
        let indicators: string[] = [];
        let weights: number[] = [];
        
        if (indicatorsStr && indicatorsStr !== '') {
          indicators = indicatorsStr.split(',').map(s => s.trim()).filter(s => s !== '');
        }
        
        if (weightsStr && weightsStr !== '') {
          weights = weightsStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        }
        
        // If no weights specified, default to 1.0 for all indicators
        if (indicators.length > 0 && weights.length === 0) {
          weights = indicators.map(() => 1.0);
        }
        
        // Extract indicator values based on indicators list
        const indicatorValues: { [key: string]: number } = {};
        
        indicators.forEach(indicator => {
          if (columnMapping[indicator] !== undefined) {
            const value = values[columnMapping[indicator]];
            if (value && value !== '' && value !== 'null' && value !== 'N/A') {
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                indicatorValues[indicator] = numValue;
              }
            }
          }
        });
        
        // Create company object in new format
        company = {
          taxcode: taxcode,
          sector: sector,
          cluster_label: cluster_label,
          indicators: indicators,
          weights: weights,
          // Add indicator values as flat properties
          ...indicatorValues
        };
        
      } else {
        // OLD FORMAT: features as individual columns
        const taxcode = values[columnMapping['taxcode']] || '';
        const sector = values[columnMapping['sector']] || values[columnMapping['sector_unique_id']] || null;
        const cluster_label = null; // Old format doesn't have cluster_label
        
        // Extract all feature columns (those with features. prefix or STD_RTD prefix)
        const indicatorValues: { [key: string]: number } = {};
        const indicators: string[] = [];
        
        Object.entries(columnMapping).forEach(([header, index]) => {
          // Handle both "features.STD_RTD1" and "STD_RTD1" formats
          let indicatorName = '';
          if (header.startsWith('features.')) {
            indicatorName = header.replace('features.', '');
          } else if (header.startsWith('STD_RTD') || header === 'empl_qtty') {
            indicatorName = header;
          }
          
          if (indicatorName && index < values.length) {
            const value = values[index];
            if (value && value !== '' && value !== 'null' && value !== 'N/A') {
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                indicatorValues[indicatorName] = numValue;
                indicators.push(indicatorName);
              }
            }
          }
        });
        
        // Create company object in old format - convert to new format structure
        company = {
          taxcode: taxcode,
          sector: sector,
          cluster_label: cluster_label,
          indicators: indicators,
          weights: indicators.map(() => 1.0), // Default equal weights
          // Add indicator values as flat properties
          ...indicatorValues
        };
      }
      
      if (company.taxcode && company.indicators.length > 0) {
        companies.push(company);
        console.log(`✅ Parsed company ${company.taxcode} with indicators: ${company.indicators.join(', ')}`);
      } else {
        console.warn(`⚠️ Skipping invalid company data at row ${i}:`, {
          taxcode: company.taxcode,
          indicators: company.indicators.length,
          sector: company.sector
        });
      }
    }
    
    return companies;
  };

  // Handle CSV file upload with format detection
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    console.log("📁 Real file upload detected:", file.name);
    
    // Clear previous results when uploading new file
    setCsvResults([]);
    setCsvFile(file);
    
    try {
      const text = await file.text();
      
      // Detect format before parsing
      const firstLine = text.split('\n')[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const detectedFormat = tabCount > commaCount ? 'Tab-separated' : 'Comma-separated';
      
      const companies = parseCsvToCompanies(text);
      setCsvData(companies);
      
      toast({
        title: "CSV Loaded Successfully",
        description: `${detectedFormat} format detected. Parsed ${companies.length} companies from CSV`,
        variant: "default",
      });
      
      console.log("📊 CSV parsed companies:", companies);
      console.log(`📋 Format: ${detectedFormat}, Companies: ${companies.length}`);
    } catch (error) {
      console.error("❌ CSV parsing error:", error);
      toast({
        title: "CSV Parsing Error",
        description: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setCsvData([]);
      setCsvFile(null);
    }
  };

  // Process CSV companies through API
  const processCsvScoring = async () => {
    if (!csvData.length) {
      toast({
        title: "No CSV Data",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    if (!ratingConfig.endpoint) {
      toast({
        title: "No API Endpoint",
        description: "Please configure API endpoint first",
        variant: "destructive",
      });
      return;
    }

    setCsvProcessing(true);
    try {
      // Convert CSV data to separate indicator requests (like single company scoring)
      const allRequests: ScoringRequest = [];
      
      csvData.forEach(company => {
        // Get all indicator values from company object (exclude basic fields)
        const indicatorValues: { [key: string]: number } = {};
        Object.entries(company).forEach(([key, value]) => {
          if (!['taxcode', 'sector', 'cluster_label', 'indicators', 'weights'].includes(key)) {
            const numValue = typeof value === 'number' ? value : parseFloat(value as string);
            if (!isNaN(numValue)) {
              indicatorValues[key] = numValue;
            }
          }
        });
        
        // Create separate request for each indicator
        Object.entries(indicatorValues).forEach(([indicator, value]) => {
          allRequests.push({
            taxcode: company.taxcode,
            sector: company.sector || null,
            cluster_label: company.cluster_label || null,
            indicators: [indicator], // Single indicator per request
            weights: [1.0], // Single weight for single indicator
            [indicator]: value // Only include this specific indicator value
          });
        });
      });
      
      console.log("🔄 Processing CSV scoring request (separate indicators):", allRequests);
      console.log(`📊 Total requests: ${allRequests.length} (${csvData.length} companies × multiple indicators)`);
      
      const response = await fetch(`${ratingConfig.endpoint}/score`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(allRequests),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ CSV Scoring results received:", result);
      
      if (!result?.companies || !Array.isArray(result.companies)) {
        throw new Error(`Expected response with companies array, got ${typeof result}`);
      }
      
      // Group results by company taxcode and consolidate scores (like single company scoring)
      const companyResultsMap = new Map<string, ScoredCompany>();
      
      result.companies.forEach((company: any) => {
        const taxcode = company.taxcode;
        
        if (!companyResultsMap.has(taxcode)) {
          companyResultsMap.set(taxcode, {
            taxcode: taxcode,
            sector: company.sector,
            cluster_label: company.cluster_label,
            scores: [],
            composite_score: 0,
            rating: "N/A",
            indicator_scores: {}
          });
        }
        
        const existingCompany = companyResultsMap.get(taxcode)!;
        if (company.scores && Array.isArray(company.scores)) {
          existingCompany.scores.push(...company.scores);
        }
      });
      
      const consolidatedResults = Array.from(companyResultsMap.values());
      console.log("🔄 Consolidated CSV results from separate indicator requests:", consolidatedResults);
      
      setCsvResults(consolidatedResults);
      setShowCsvResults(true);
      
      toast({
        title: "CSV Scoring Complete",
        description: `Successfully scored ${csvData.length} companies with ${allRequests.length} separate indicator requests and got ${consolidatedResults.length} consolidated result(s)`,
        variant: "default",
      });
      
    } catch (error) {
      console.error("❌ CSV Scoring failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      setCsvResults([]);
      
      toast({
        title: "CSV Scoring Failed",
        description: `Failed to score CSV companies: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setCsvProcessing(false);
    }
  };

  // Export results to CSV with separator option
  const exportToCsv = (useTabs = false) => {
    if (!csvResults.length) return;
    
    const separator = useTabs ? '\t' : ',';
    
    // Create CSV header based on new response format
    const basicColumns = ['taxcode', 'sector', 'cluster_label'];
    
    // Get all unique indicators from results
    const allIndicators = new Set<string>();
    csvResults.forEach(result => {
      result.scores?.forEach(score => {
        allIndicators.add(score.indicator);
      });
    });
    const indicatorColumns = Array.from(allIndicators).sort();
    
    const allColumns = [...basicColumns, ...indicatorColumns];
    const header = allColumns.join(separator);
    
    // Create CSV rows
    const rows = csvResults.map(result => {
      const row: string[] = [];
      
      // Fill basic info
      row.push(result.taxcode);
      row.push(result.sector || '');
      row.push(result.cluster_label?.toString() || '');
      
      // Create indicator -> tier mapping
      const indicatorTiers: { [key: string]: string } = {};
      result.scores?.forEach(score => {
        indicatorTiers[score.indicator] = score.tier;
      });
      
      // Fill indicator tiers
      indicatorColumns.forEach(indicator => {
        const tier = indicatorTiers[indicator];
        row.push(tier || '');
      });
      
      // Handle values that might contain separators
      return row.map(value => {
        const strValue = value.toString();
        if (separator === ',' && (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n'))) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(separator);
    });
    
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const fileExtension = useTabs ? '_tab.csv' : '.csv';
    link.setAttribute('download', `company_scoring_results_${new Date().getTime()}${fileExtension}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Complete",
      description: `CSV file has been downloaded (${useTabs ? 'tab' : 'comma'} separated)`,
      variant: "default",
    });
  };

  // Export results to Excel format
  const exportToExcel = () => {
    if (!csvResults.length) return;
    
    // Create worksheet data
    const wsData = [];
    
    // Create header based on actual results structure
    const basicColumns = ['taxcode', 'sector', 'cluster_label'];
    
    // Get all unique indicators
    const allIndicators = new Set<string>();
    csvResults.forEach(result => {
      result.scores?.forEach(score => {
        allIndicators.add(score.indicator);
      });
    });
    const indicatorColumns = Array.from(allIndicators).sort();
    
    // Header row
    wsData.push([...basicColumns, ...indicatorColumns]);
    
    // Data rows
    csvResults.forEach(result => {
      const row = [];
      
      // Fill basic info
      row.push(result.taxcode);
      row.push(result.sector || '');
      row.push(result.cluster_label || '');
      
      // Create indicator -> tier mapping
      const indicatorTiers: { [key: string]: string } = {};
      result.scores?.forEach(score => {
        indicatorTiers[score.indicator] = score.tier;
      });
      
      // Fill tier scores for each indicator
      indicatorColumns.forEach(indicator => {
        row.push(indicatorTiers[indicator] || '');
      });
      
      wsData.push(row);
    });
    
    // Convert to CSV format (simple Excel compatible)
    const csvContent = wsData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `company_scoring_results_${new Date().getTime()}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Complete", 
      description: "Excel file has been downloaded",
      variant: "default",
    });
  };
  
  // Render CSV scoring results table
  const renderCsvResults = () => {
    if (!csvResults.length) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center">
            <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Bulk Company Scoring</h3>
            <p className="text-muted-foreground mb-4">
              Upload CSV file with company data to score multiple companies at once.
            </p>
            <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <p className="font-medium mb-2">📋 Supported CSV Formats:</p>
              <div className="text-left space-y-1">
                <p>• <strong>New Format</strong>: taxcode, sector, cluster_label, indicators, weights, [values...]</p>
                <p>• <strong>Legacy Format</strong>: taxcode, sector, features.STD_RTD146, features.STD_RTD71, ...</p>
                <p>• <strong>Auto-Detection</strong>: Format detected automatically during upload</p>
                <p>• <strong>Processing</strong>: Upload → Parse → Score → Export</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Export buttons */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{csvResults.length} companies scored</Badge>
            <span className="text-sm text-muted-foreground">
              Total indicators: {csvResults[0]?.scores?.length || 0}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => exportToCsv(false)}>
                📄 CSV (Comma)
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToCsv(true)}>
                📄 CSV (Tab)
              </Button>
            </div>
          </div>
        </div>

        {/* Results table */}
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="min-w-[100px] text-xs">TaxCode</TableHead>
                <TableHead className="min-w-[100px] text-xs">Sector</TableHead>
                <TableHead className="min-w-[100px] text-xs">Cluster</TableHead>
                <TableHead className="min-w-[100px] text-xs">Scores</TableHead>
                {/* Dynamic columns for each unique indicator found in results */}
                {(() => {
                  const allIndicators = new Set<string>();
                  csvResults.forEach(result => {
                    result.scores?.forEach(score => {
                      allIndicators.add(score.indicator);
                    });
                  });
                  return Array.from(allIndicators).sort().map(indicator => (
                    <TableHead key={indicator} className="min-w-[100px] text-xs">
                      {indicator}
                    </TableHead>
                  ));
                })()}
              </TableRow>
            </TableHeader>
            <TableBody>
              {csvResults.map((result, index) => {
                // Get all unique indicators for this table
                const allIndicators = new Set<string>();
                csvResults.forEach(r => {
                  r.scores?.forEach(score => {
                    allIndicators.add(score.indicator);
                  });
                });
                const indicatorList = Array.from(allIndicators).sort();
                
                // Create a map of indicator -> tier for this result
                const indicatorTiers: { [key: string]: string } = {};
                result.scores?.forEach(score => {
                  indicatorTiers[score.indicator] = score.tier;
                });
                
                return (
                  <TableRow key={index}>
                    <TableCell className="text-xs font-medium">{result.taxcode}</TableCell>
                    <TableCell className="text-xs">{result.sector || '-'}</TableCell>
                    <TableCell className="text-xs">{result.cluster_label || '-'}</TableCell>
                    <TableCell className="text-xs font-medium">
                      {result.scores?.length || 0} scores
                    </TableCell>
                    {/* Display tier for each indicator */}
                    {indicatorList.map(indicator => (
                      <TableCell key={indicator} className="text-xs">
                        {indicatorTiers[indicator] ? (
                          <Badge 
                            variant={getTierColor(indicatorTiers[indicator])} 
                            className="text-xs"
                          >
                            {indicatorTiers[indicator]}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {(() => {
            const allTiers: string[] = [];
            csvResults.forEach(result => {
              result.scores.forEach(({ tier }) => {
                allTiers.push(tier);
              });
            });
            
            const tierCounts: { [key: string]: number } = {};
            allTiers.forEach(tier => {
              tierCounts[tier] = (tierCounts[tier] || 0) + 1;
            });
            
            return Object.entries(tierCounts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tier, count]) => (
                <div key={tier} className="text-center p-3 border rounded-lg">
                  <Badge variant={getTierColor(tier)} className="mb-2">
                    {tier}
                  </Badge>
                  <p className="text-sm font-medium">{count} scores</p>
                  <p className="text-xs text-muted-foreground">
                    {((count / allTiers.length) * 100).toFixed(1)}%
                  </p>
                </div>
              ));
          })()}
        </div>
      </div>
    );
  };

  const renderScoringResults = () => {
    try {
      if (scoringResults.length === 0) {
        return (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Company Scoring System</h3>
              <p className="text-muted-foreground mb-4">
                Enter company information and financial features to get tier scores for each indicator.
              </p>
              <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                <p className="font-medium mb-2">📋 How it works:</p>
                <div className="text-left space-y-1">
                  <p>• <strong>Connect API</strong>: Configure scoring endpoint</p>
                  <p>• <strong>Company Info</strong>: Enter tax code, sector, cluster (0-4)</p>
                  <p>• <strong>Financial Features</strong>: Add indicator values</p>
                  <p>• <strong>Calculate Score</strong>: Get tier classification (T1-T8)</p>
                  <p>• <strong>Export Results</strong>: Download CSV or Excel files</p>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <div className="space-y-6">
          {scoringResults.map((result, resultIndex) => {
            // Calculate tier distribution from scores array
            const tierCounts: { [key: string]: number } = {};
            result.scores.forEach(({ tier }) => {
              tierCounts[tier] = (tierCounts[tier] || 0) + 1;
            });
            
            const totalIndicators = result.scores.length;
            
            return (
              <div key={resultIndex} className="space-y-4">
                {/* Summary Card with Export Buttons */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Company: {result.taxcode} | Sector: {result.sector || 'N/A'}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{totalIndicators} indicators</Badge>
                        
                        {/* Export buttons for single company */}
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => exportSingleToCsv(false)}>
                            📄 CSV
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportSingleToCsv(true)}>
                            📄 Tab
                          </Button>
                          <Button variant="outline" size="sm" onClick={exportSingleToExcel}>
                            📊 Excel
                          </Button>
                        </div>
                      </div>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cluster: {result.cluster_label || 'N/A'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {Object.entries(tierCounts)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([tier, count]) => (
                          <div key={tier} className="text-center">
                            <Badge variant={getTierColor(tier)} className="mb-2">
                              {tier}
                            </Badge>
                            <p className="text-sm font-medium">{count} indicators</p>
                            <p className="text-xs text-muted-foreground">
                              {((count / totalIndicators) * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))
                      }
                    </div>
                  </CardContent>
                </Card>
                
                {/* Detailed Results Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detailed Tier Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Indicator</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Tier Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.scores
                          .sort((a, b) => a.indicator.localeCompare(b.indicator))
                          .map(({ indicator, tier }) => (
                            <TableRow key={indicator}>
                              <TableCell className="font-mono text-sm">{indicator}</TableCell>
                              <TableCell className="text-sm">
                                {ratingApi.getIndicatorDescription(indicator)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={getTierColor(tier)}>
                                  {tier}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        }
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      );
    } catch (error) {
      console.error("❌ Error rendering scoring results:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown render error";
      
      // Don't setState in render - just return error UI
      return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center">
            <div className="text-red-500 mb-4">❌ Render Error</div>
            <p className="text-muted-foreground mb-4">
              Failed to render scoring results: {errorMsg}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setRenderError("");
                setScoringResults([]);
              }}
            >
              Clear Results
            </Button>
          </div>
        </div>
      );
    }
  };
  
  return (
    <div className="app-container-custom flex flex-col lg:flex-row overflow-auto bg-background">
      {/* Left Sidebar - Controls */}
      <div className="w-full lg:w-80 lg:min-w-[320px] lg:max-w-[400px] xl:w-96 bg-card border-r border-border flex flex-col sidebar-flex">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Company Scoring
          </h1>
          <p className="text-sm text-muted-foreground">
            Score individual companies using financial indicators
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
              {/* CSV Bulk Import Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Bulk CSV Import</h3>
                
                <div className="space-y-3">
                  <div className="p-3 border-2 border-dashed border-muted rounded-lg">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                    >
                      <div className="text-2xl">📁</div>
                      <div className="text-sm text-center">
                        <p className="font-medium">Upload CSV File</p>
                        <p className="text-muted-foreground">Click to select CSV file</p>
                      </div>
                    </label>
                  </div>
                  
                  {csvFile && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-xs font-medium">{csvFile.name}</span>
                      <Badge variant="secondary">{csvData.length} companies</Badge>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Expected CSV formats (auto-detected):</p>
                    <p className="mb-1">📋 Separators: Comma (,) or Tab (\t) - auto-detected</p>
                    
                    <div className="mt-2 space-y-2">
                      <div className="border-l-2 border-blue-200 pl-2">
                        <p className="font-medium text-blue-700">Format 1 (New): </p>
                        <p>📋 Columns: taxcode, sector, cluster_label, indicators, weights, [indicator values...]</p>
                        <p>📋 Indicators: comma-separated list (e.g. "STD_RTD97,STD_RTD71")</p>
                        <p>📋 Weights: comma-separated numbers (e.g. "0.7,0.3") or empty for equal weights</p>
                      </div>
                      
                      <div className="border-l-2 border-green-200 pl-2">
                        <p className="font-medium text-green-700">Format 2 (Legacy): </p>
                        <p>📋 Columns: taxcode, sector, sector_unique_id, yearreport, length_report, features.empl_qtty, features.STD_RTD146, ...</p>
                        <p>📋 Features: individual columns with "features." prefix or direct indicator names</p>
                        <p>📋 Auto-converts: removes "features." prefix and creates equal weights</p>
                      </div>
                    </div>
                    
                    <p className="mt-2 text-xs opacity-75">Your CSV format will be auto-detected and processed accordingly.</p>
                  </div>
                  
                  {csvData.length > 0 && (
                    <>
                      <Button
                        onClick={processCsvScoring}
                        disabled={csvProcessing || !ratingConfig.endpoint}
                        className="w-full"
                        variant="default"
                      >
                        {csvProcessing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            Processing {csvData.length} companies...
                          </>
                        ) : (
                          <>
                            📊 Score {csvData.length} Companies
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => {
                          // Load mock CSV data for testing - new format with indicators and weights
                          console.log("🎭 Loading mock CSV data...");
                          
                          // Reset file input first to avoid conflicts
                          const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
                          if (fileInput) {
                            fileInput.value = '';
                          }
                          
                          const mockCsvCompanies: ScoringCompany[] = [
                            {
                              taxcode: "0100100001",
                              sector: null,
                              cluster_label: null,
                              indicators: ["STD_RTD97", "STD_RTD71"],
                              weights: [0.7, 0.3],
                              "STD_RTD97": 0.42,
                              "STD_RTD71": 0.35
                            },
                            {
                              taxcode: "0100100002", 
                              sector: "G",
                              cluster_label: null,
                              indicators: ["STD_RTD97"],
                              weights: [1.0],
                              "STD_RTD97": 0.78
                            },
                            {
                              taxcode: "0100100003",
                              sector: "A", 
                              cluster_label: 2,
                              indicators: ["STD_RTD71", "STD_RTD1"],
                              weights: [1.0, 1.0],
                              "STD_RTD71": 0.12,
                              "STD_RTD1": 1.25
                            }
                          ];
                          
                          // Clear previous results when loading mock data
                          setCsvResults([]);
                          setCsvData(mockCsvCompanies);
                          setCsvFile(new File(["mock"], "mock_companies.csv"));
                          
                          toast({
                            title: "Mock CSV Data Loaded",
                            description: `Loaded ${mockCsvCompanies.length} sample companies with new format`,
                            variant: "default",
                          });
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        🎭 Load Mock CSV
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <Separator />
              
              {/* Single Company Scoring Form */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Single Company Scoring</h3>
                
                <Form {...scoringForm}>
                  <form onSubmit={scoringForm.handleSubmit(onScoringSubmit)} className="space-y-4">
                    <FormField
                      control={scoringForm.control}
                      name="taxcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Code</FormLabel>
                          <FormControl>
                            <Input placeholder="0100100008" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={scoringForm.control}
                      name="sector_unique_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sector</FormLabel>
                          <FormControl>
                            <Input placeholder="G" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={scoringForm.control}
                      name="cluster_label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cluster Label (0-4)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max="4" 
                              placeholder="0, 1, 2, 3, or 4" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Features Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Financial Features</h4>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={loadSampleData}
                          >
                            📊 Load Sample
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={loadMockScoringResults}
                          >
                            🎭 Test Results
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addFeature()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Add Indicator Section */}
                      {indicators.length > 0 && (
                        <div className="mb-2">
                          <Select onValueChange={(value) => {
                            if (value && !features[value]) {
                              addFeature(value);
                            }
                          }}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select indicator to add..." />
                            </SelectTrigger>
                            <SelectContent>
                              {indicators
                                .filter(indicator => !features[indicator])
                                .map(indicator => (
                                  <SelectItem key={indicator} value={indicator}>
                                    {indicator} - {ratingApi.getIndicatorDescription(indicator)}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {/* Features List */}
                      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                        {Object.entries(features).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Input
                              placeholder="Indicator"
                              value={key}
                              onChange={(e) => updateFeatureKey(key, e.target.value)}
                              className="flex-1 text-xs"
                            />
                            <Input
                              placeholder="Value"
                              value={value}
                              onChange={(e) => updateFeatureValue(key, e.target.value)}
                              className="flex-1 text-xs"
                              type="number"
                              step="any"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFeature(key)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        
                        {Object.keys(features).length === 0 && (
                          <div className="text-center text-muted-foreground py-4">
                            No features added. Click + to add features or load sample data.
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        {Object.keys(features).length} features added
                      </p>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading || Object.keys(features).length === 0}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Scoring...
                        </>
                      ) : (
                        <>
                          <Calculator className="h-4 w-4 mr-2" />
                          Calculate Score
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {connectionStatus === "connected" ? (
          <div className="flex-1 m-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {showCsvResults ? (
                    <>
                      📊 Bulk Scoring Results
                      {csvResults.length > 0 && (
                        <Badge variant="secondary">{csvResults.length} companies</Badge>
                      )}
                    </>
                  ) : (
                    <>
                      📊 Company Scoring Results
                      {scoringResults.length > 0 && (
                        <Badge variant="secondary">{scoringResults.length} result(s)</Badge>
                      )}
                    </>
                  )}
                  
                  {/* View Toggle buttons */}
                  <div className="ml-auto flex gap-2">
                    {csvResults.length > 0 && (
                      <Button
                        size="sm"
                        variant={showCsvResults ? "default" : "outline"}
                        onClick={() => setShowCsvResults(true)}
                      >
                        Bulk Results
                      </Button>
                    )}
                    {scoringResults.length > 0 && (
                      <Button
                        size="sm"
                        variant={!showCsvResults ? "default" : "outline"}
                        onClick={() => setShowCsvResults(false)}
                      >
                        Single Results
                      </Button>
                    )}
                    {(scoringResults.length > 0 || csvResults.length > 0) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          console.log("🧹 Clearing results");
                          if (showCsvResults) {
                            setCsvResults([]);
                            setCsvData([]);
                            setCsvFile(null);
                          } else {
                            setScoringResults([]);
                          }
                        }}
                      >
                        Clear Results
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {/* Debug info */}
                {!showCsvResults && (
                  <div className="mb-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                    <p>🔍 Results Length: {scoringResults.length}</p>
                    <p>🎨 Render Error: {renderError || "None"}</p>
                    {scoringResults.length > 0 && (
                      <details>
                        <summary className="cursor-pointer">🔍 Raw Results Data</summary>
                        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto max-h-32">
                          {JSON.stringify(scoringResults, null, 2)}
                        </pre>
                      </details>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={loadMockScoringResults}
                    >
                      Load Mock Data
                    </Button>
                  </div>
                )}
                
                {/* Render appropriate results */}
                {showCsvResults ? renderCsvResults() : renderScoringResults()}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No API Connection</h3>
              <p className="text-muted-foreground mb-4">
                Please configure and connect to the Rating API in the sidebar to start scoring companies.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
