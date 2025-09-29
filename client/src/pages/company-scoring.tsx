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
import { ratingApi, type RatingConfig, type ScoringRequest, type ScoringResponse, type ScoringCompany } from "@/lib/rating-api";

const apiSchema = z.object({
  endpoint: z.string().url("Please enter a valid URL"),
});

const scoringSchema = z.object({
  cluster_label: z.number().min(0, "Cluster label must be >= 0"),
  length_report: z.number().min(1, "Length report must be >= 1"),
  sector: z.string().min(1, "Sector is required"),
  sector_unique_id: z.string().min(1, "Sector unique ID is required"),
  taxcode: z.string().min(1, "Tax code is required"),
  yearreport: z.number().min(2000, "Year report must be >= 2000").max(2030, "Year report must be <= 2030"),
});

export default function CompanyScoring() {
  const { toast } = useToast();
  
  // State for API configuration
  const [ratingConfig, setRatingConfig] = useState<RatingConfig>({
    endpoint: ""
  });
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  const [indicators, setIndicators] = useState<string[]>([]);
  
  // State for CSV import feature
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvResults, setCsvResults] = useState<ScoringResponse[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [showCsvResults, setShowCsvResults] = useState(false);
  
  // State for scoring form
  const [features, setFeatures] = useState<{ [key: string]: string }>({});
  const [scoringResults, setScoringResults] = useState<ScoringResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState<string>("");
  
  // Effect to log scoringResults changes
  useEffect(() => {
    console.log("📊 Scoring results updated:", {
      length: scoringResults.length,
      data: scoringResults
    });
  }, [scoringResults]);
  
  // API Configuration Form
  const apiForm = useForm<z.infer<typeof apiSchema>>({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      endpoint: "",
    },
  });
  
  // Scoring Form
  const scoringForm = useForm<z.infer<typeof scoringSchema>>({
    resolver: zodResolver(scoringSchema),
    defaultValues: {
      cluster_label: 0,
      length_report: 5,
      sector: "G",
      sector_unique_id: "46413",
      taxcode: "0100100008",
      yearreport: 2022,
    },
  });
  
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
  
  const testScoreApi = async () => {
    if (!ratingConfig.endpoint) {
      toast({
        title: "No API Endpoint",
        description: "Please enter an API endpoint first",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🧪 Testing /score API...");
      
      const testPayload = {
        companies: [
          {
            taxcode: "0100100008",
            sector_unique_id: "46413",
            features: {
              "STD_RTD13": 8543000995892.0,
              "STD_RTD1": 1.4298459294882604,
              "STD_RTD11": -0.163450134615411
            },
            yearreport: 2022,
            length_report: 5
          }
        ]
      };

      console.log(`🧪 Test payload (companies format):`, testPayload);
      
      const response = await fetch(`${ratingConfig.endpoint}/score`, {
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
      console.log(`🧪 Score API Response:`, { 
        status: response.status, 
        statusText: response.statusText,
        body: responseText 
      });

      if (response.ok) {
        const data = JSON.parse(responseText);
        const indicatorCount = data[0]?.scores?.length || 0;
        
        toast({
          title: "Score API Test Success",
          description: `Successfully scored with ${indicatorCount} indicators`,
          variant: "default",
        });
        console.log(`✅ Score API test succeeded with data:`, data);
      } else {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
    } catch (error) {
      console.error("🧪 Score API test failed:", error);
      toast({
        title: "Score API Test Failed",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
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
    
    // Update form values
    scoringForm.setValue("cluster_label", 0);
    scoringForm.setValue("length_report", 5);
    scoringForm.setValue("sector", "G");
    scoringForm.setValue("sector_unique_id", "46413");
    scoringForm.setValue("taxcode", "0100100008");
    scoringForm.setValue("yearreport", 2022);
    
    toast({
      title: "Sample Data Loaded",
      description: "Sample feature data has been loaded into the form",
      variant: "default",
    });
  };
  
  const loadMockScoringResults = () => {
    const mockResults: ScoringResponse[] = [
      {
        "cluster_label": 0,
        "length_report": 5,
        "scores": [
          {"indicator": "STD_RTD1", "tier": "T3"},
          {"indicator": "STD_RTD11", "tier": "T4"},
          {"indicator": "STD_RTD118", "tier": "T6"},
          {"indicator": "STD_RTD13", "tier": "T1"},
          {"indicator": "STD_RTD14", "tier": "T1"},
          {"indicator": "STD_RTD146", "tier": "T1"},
          {"indicator": "STD_RTD147", "tier": "T4"},
          {"indicator": "STD_RTD148", "tier": "T5"},
          {"indicator": "STD_RTD26", "tier": "T1"},
          {"indicator": "STD_RTD28", "tier": "T5"},
          {"indicator": "STD_RTD31", "tier": "T1"},
          {"indicator": "STD_RTD64", "tier": "T4"},
          {"indicator": "STD_RTD71", "tier": "T5"},
          {"indicator": "STD_RTD72", "tier": "T2"},
          {"indicator": "STD_RTD74", "tier": "T6"},
          {"indicator": "STD_RTD75", "tier": "T5"},
          {"indicator": "STD_RTD76", "tier": "T5"},
          {"indicator": "STD_RTD77", "tier": "T1"},
          {"indicator": "STD_RTD78", "tier": "T8"},
          {"indicator": "STD_RTD8", "tier": "T1"},
          {"indicator": "STD_RTD81", "tier": "T3"},
          {"indicator": "STD_RTD82", "tier": "T3"},
          {"indicator": "STD_RTD83", "tier": "T1"},
          {"indicator": "STD_RTD84", "tier": "T5"},
          {"indicator": "STD_RTD85", "tier": "T7"},
          {"indicator": "STD_RTD86", "tier": "T1"},
          {"indicator": "STD_RTD87", "tier": "T4"},
          {"indicator": "STD_RTD88", "tier": "T5"},
          {"indicator": "STD_RTD89", "tier": "T5"},
          {"indicator": "STD_RTD9", "tier": "T2"},
          {"indicator": "STD_RTD92", "tier": "T6"},
          {"indicator": "STD_RTD93", "tier": "T6"},
          {"indicator": "STD_RTD94", "tier": "T6"},
          {"indicator": "STD_RTD95", "tier": "T8"},
          {"indicator": "STD_RTD96", "tier": "T4"},
          {"indicator": "STD_RTD97", "tier": "T1"},
          {"indicator": "STD_RTD98", "tier": "T6"},
          {"indicator": "STD_RTD99", "tier": "T6"},
          {"indicator": "empl_qtty", "tier": "T1"}
        ],
        "sector": "G",
        "sector_unique_id": "46413",
        "taxcode": "0100100008",
        "yearreport": 2022
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
      
      const request: ScoringRequest = {
        companies: [
          {
            taxcode: data.taxcode,
            sector_unique_id: data.sector_unique_id,
            features: numericFeatures,
            yearreport: data.yearreport,
            length_report: data.length_report,
          }
          // TODO: Future - support multiple companies
          // Add more companies here if needed
        ]
      };
      
      console.log("🔄 Submitting scoring request:", request);
      console.log(`📊 Features count: ${Object.keys(numericFeatures).length}`);
      
      const results = await ratingApi.getScoring(request, ratingConfig);
      console.log("✅ Scoring results received:", results);
      console.log("✅ Results type:", typeof results, "Is array:", Array.isArray(results));
      console.log("✅ Results length:", results?.length);
      
      // Validate results format - but don't throw if empty
      if (!Array.isArray(results)) {
        throw new Error(`Expected array response, got ${typeof results}`);
      }
      
      // Allow empty results - just show message
      if (results.length === 0) {
        setScoringResults([]);
        toast({
          title: "No Results",
          description: "API returned no scoring results. This might be normal depending on your data.",
          variant: "default",
        });
        return;
      }
      
      setScoringResults(results);
      console.log("📊 Updated scoringResults state:", results);
      
      toast({
        title: "Scoring Complete",
        description: `Successfully scored company with ${Object.keys(numericFeatures).length} features and got ${results.length} result(s)`,
        variant: "default",
      });
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

  // CSV column definitions - order as specified
  const csvColumns = [
    "taxcode", "sector_unique_id", "empl_qtty", "yearreport", "length_report",
    "STD_RTD146", "STD_RTD71", "STD_RTD96", "STD_RTD97", "STD_RTD98", "STD_RTD99",
    "STD_RTD1", "STD_RTD72", "STD_RTD148", "STD_RTD74", "STD_RTD76", "STD_RTD77",
    "STD_RTD78", "STD_RTD81", "STD_RTD64", "STD_RTD75", "STD_RTD13", "STD_RTD14",
    "STD_RTD31", "empl_qtty.1", "STD_RTD26", "STD_RTD8", "STD_RTD82", "STD_RTD83",
    "STD_RTD84", "STD_RTD85", "STD_RTD86", "STD_RTD9", "STD_RTD11", "STD_RTD28",
    "STD_RTD87", "STD_RTD88", "STD_RTD89", "STD_RTD118", "STD_RTD92", "STD_RTD93",
    "STD_RTD94", "STD_RTD95", "STD_RTD147"
  ];

  // Parse CSV text to companies array - handle both comma and tab separators
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
    
    // Skip header row, process data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      const values = parseCsvLine(line);
      
      if (values.length < 5) {
        console.warn(`⚠️ Skipping row ${i}: insufficient columns (${values.length})`);
        continue;
      }
      
      const features: { [key: string]: number } = {};
      
      // Process feature columns (starting from index 2 for empl_qtty, then 5+ for other indicators)
      for (let j = 2; j < csvColumns.length && j < values.length; j++) {
        const column = csvColumns[j];
        const value = values[j];
        
        // Skip basic info columns
        if (['taxcode', 'sector_unique_id', 'yearreport', 'length_report'].includes(column)) {
          continue;
        }
        
        if (value && value !== '' && value !== 'null' && value !== 'N/A') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            // Handle duplicate empl_qtty columns - use the first valid one
            const featureKey = column === 'empl_qtty.1' ? 'empl_qtty' : column;
            if (!features.hasOwnProperty('empl_qtty') || column !== 'empl_qtty.1') {
              features[featureKey] = numValue;
            }
          }
        }
      }
      
      // Create company object
      const company: ScoringCompany = {
        taxcode: values[0] || '',
        sector_unique_id: values[1] || '',
        features: features,
        yearreport: values[3] ? parseInt(values[3]) : 2022,
        length_report: values[4] ? parseInt(values[4]) : 5
      };
      
      if (company.taxcode && company.sector_unique_id && Object.keys(features).length > 0) {
        companies.push(company);
        console.log(`✅ Parsed company ${company.taxcode} with ${Object.keys(features).length} features`);
      } else {
        console.warn(`⚠️ Skipping invalid company data at row ${i}:`, {
          taxcode: company.taxcode,
          sector_unique_id: company.sector_unique_id,
          features: Object.keys(features).length
        });
      }
    }
    
    return companies;
  };

  // Handle CSV file upload with format detection
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
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
      const request: ScoringRequest = {
        companies: csvData
      };
      
      console.log("🔄 Processing CSV scoring request:", request);
      console.log(`📊 Companies count: ${csvData.length}`);
      
      const results = await ratingApi.getScoring(request, ratingConfig);
      console.log("✅ CSV Scoring results received:", results);
      
      if (!Array.isArray(results)) {
        throw new Error(`Expected array response, got ${typeof results}`);
      }
      
      setCsvResults(results);
      setShowCsvResults(true);
      
      toast({
        title: "CSV Scoring Complete",
        description: `Successfully scored ${csvData.length} companies and got ${results.length} result(s)`,
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
    
    // Create CSV header
    const header = csvColumns.join(separator);
    
    // Create CSV rows
    const rows = csvResults.map(result => {
      const row = new Array(csvColumns.length).fill('');
      
      // Fill basic info
      row[0] = result.taxcode;
      row[1] = result.sector_unique_id;
      row[3] = result.yearreport.toString();
      row[4] = result.length_report.toString();
      
      // Fill tier scores for each indicator
      result.scores.forEach(({ indicator, tier }) => {
        const columnIndex = csvColumns.indexOf(indicator);
        if (columnIndex >= 0) {
          row[columnIndex] = tier;
        }
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
    
    // Header row
    wsData.push(csvColumns);
    
    // Data rows
    csvResults.forEach(result => {
      const row = new Array(csvColumns.length).fill('');
      
      // Fill basic info
      row[0] = result.taxcode;
      row[1] = result.sector_unique_id;
      row[3] = result.yearreport;
      row[4] = result.length_report;
      
      // Fill tier scores for each indicator
      result.scores.forEach(({ indicator, tier }) => {
        const columnIndex = csvColumns.indexOf(indicator);
        if (columnIndex >= 0) {
          row[columnIndex] = tier;
        }
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
              <p className="font-medium mb-2">📋 CSV Format:</p>
              <div className="text-left space-y-1">
                <p>• <strong>Columns</strong>: taxcode, sector_unique_id, empl_qtty, yearreport, length_report, [indicators...]</p>
                <p>• <strong>Order</strong>: STD_RTD146, STD_RTD71, STD_RTD96, etc.</p>
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
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              📊 Export Excel
            </Button>
          </div>
        </div>

        {/* Results table */}
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                {csvColumns.map(column => (
                  <TableHead key={column} className="min-w-[100px] text-xs">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {csvResults.map((result, index) => {
                // Create a map of indicator -> tier for quick lookup
                const tierMap: { [key: string]: string } = {};
                result.scores.forEach(({ indicator, tier }) => {
                  tierMap[indicator] = tier;
                });

                return (
                  <TableRow key={index}>
                    {csvColumns.map(column => {
                      let cellValue = '';
                      let isIndicator = false;

                      // Determine cell value based on column type
                      if (column === 'taxcode') {
                        cellValue = result.taxcode;
                      } else if (column === 'sector_unique_id') {
                        cellValue = result.sector_unique_id;
                      } else if (column === 'yearreport') {
                        cellValue = result.yearreport.toString();
                      } else if (column === 'length_report') {
                        cellValue = result.length_report.toString();
                      } else {
                        // This is an indicator column
                        isIndicator = true;
                        cellValue = tierMap[column] || '';
                      }

                      return (
                        <TableCell key={column} className="text-xs">
                          {isIndicator && cellValue ? (
                            <Badge variant={getTierColor(cellValue)} className="text-xs">
                              {cellValue}
                            </Badge>
                          ) : (
                            cellValue
                          )}
                        </TableCell>
                      );
                    })}
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
                  <p>• <strong>Company Info</strong>: Enter tax code, sector, year, etc.</p>
                  <p>• <strong>Financial Features</strong>: Add indicator values</p>
                  <p>• <strong>Calculate Score</strong>: Get tier classification (T1-T8)</p>
                  <p>• <strong>Results Table</strong>: View tier scores for each indicator</p>
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
                {/* Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Company: {result.taxcode} | Sector: {result.sector} | Year: {result.yearreport}</span>
                      <Badge variant="outline">{totalIndicators} indicators</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cluster: {result.cluster_label} | Length Report: {result.length_report} | Sector ID: {result.sector_unique_id}
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
                
                {/* Test Score API Button */}
                {connectionStatus === "connected" && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={testScoreApi}
                  >
                    🧪 Test Score API
                  </Button>
                )}
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
                    <p className="font-medium mb-1">Expected CSV format:</p>
                    <p className="mb-1">📋 Separators: Comma (,) or Tab (\t) - auto-detected</p>
                    <p>📋 Columns: taxcode, sector_unique_id, empl_qtty, yearreport, length_report, [indicators...]</p>
                    <p className="mt-2 text-xs opacity-75">Missing indicators will be skipped. Quotes in comma-separated files are handled automatically.</p>
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
                          // Load mock CSV data for testing
                          const mockCsvCompanies: ScoringCompany[] = [
                            {
                              taxcode: "0100100008",
                              sector_unique_id: "46413",
                              features: {
                                "STD_RTD1": 1.4298459294882604,
                                "STD_RTD11": -0.163450134615411,
                                "STD_RTD118": 1.1123457018541,
                                "STD_RTD13": 8543000995892.0,
                                "STD_RTD14": 5974770301965.0,
                                "STD_RTD146": 0.1781383557744278,
                                "STD_RTD147": 0.8497527575929522,
                                "STD_RTD148": 4.87141453245363,
                                "STD_RTD26": 0.3161463520193703,
                                "STD_RTD28": 0.0597972745346027,
                                "STD_RTD31": 1375057176046.0,
                                "STD_RTD60": 434719310025.0,
                                "STD_RTD61": 2092192374319.0005,
                                "STD_RTD64": 7.464660888589531,
                                "STD_RTD71": 0.3741207161764617,
                                "STD_RTD72": 0.153540383685473,
                                "STD_RTD74": 4.483261327033508,
                                "STD_RTD75": 5.442856549159517,
                                "STD_RTD76": 0.7823628601465016,
                                "STD_RTD77": 0.0512084770374026,
                                "STD_RTD78": 0.1619771245510531,
                                "STD_RTD8": 0.0305950947928251,
                                "STD_RTD81": 91.8669083051704,
                                "STD_RTD82": 0.0421495190747473,
                                "STD_RTD83": 0.2364644639126792,
                                "STD_RTD84": -0.1362858178122266,
                                "STD_RTD85": -0.0132155006995811,
                                "STD_RTD86": 0.1888852816570525,
                                "STD_RTD87": -0.0601674462330797,
                                "STD_RTD88": 0.0127545665745962,
                                "STD_RTD89": -0.0206688898443121,
                                "STD_RTD9": 0.043016865056978,
                                "STD_RTD92": 2.540435089698045,
                                "STD_RTD93": 2.209298116944523,
                                "STD_RTD94": 0.1531385651299867,
                                "STD_RTD95": -0.9756153148702518,
                                "STD_RTD96": 4.596509725650529,
                                "STD_RTD97": 6.6864117420939735,
                                "STD_RTD98": -0.2108779249659391,
                                "STD_RTD99": -2.8824090067144565,
                                "empl_qtty": 6132.0
                              },
                              yearreport: 2022,
                              length_report: 5
                            },
                            {
                              taxcode: "0100100009", 
                              sector_unique_id: "46413",
                              features: {
                                "empl_qtty": 3500.0,
                                "STD_RTD146": 0.2,
                                "STD_RTD71": 0.5,
                                "STD_RTD1": 2.0,
                                "STD_RTD13": 5000000000000.0
                              },
                              yearreport: 2022,
                              length_report: 5
                            }
                          ];
                          
                          setCsvData(mockCsvCompanies);
                          setCsvFile(new File(["mock"], "mock_companies.csv"));
                          
                          toast({
                            title: "Mock CSV Data Loaded",
                            description: `Loaded ${mockCsvCompanies.length} sample companies`,
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
                      name="sector"
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
                      name="sector_unique_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sector Unique ID</FormLabel>
                          <FormControl>
                            <Input placeholder="46413" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={scoringForm.control}
                        name="cluster_label"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cluster Label</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={scoringForm.control}
                        name="length_report"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Length Report</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={scoringForm.control}
                      name="yearreport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year Report</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="2022"
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 2022)}
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
                            onClick={async () => {
                              if (Object.keys(features).length === 0) {
                                toast({
                                  title: "No Features",
                                  description: "Please load sample data first",
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              try {
                                // Get form values
                                const formData = scoringForm.getValues();
                                const numericFeatures: { [key: string]: number } = {};
                                
                                for (const [key, value] of Object.entries(features)) {
                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue)) {
                                    numericFeatures[key] = numValue;
                                  }
                                }
                                
                                const testRequest: ScoringRequest = {
                                  companies: [
                                    {
                                      taxcode: formData.taxcode,
                                      sector_unique_id: formData.sector_unique_id,
                                      features: numericFeatures,
                                      yearreport: formData.yearreport,
                                      length_report: formData.length_report,
                                    }
                                  ]
                                };
                                
                                console.log("🧪 Debug API call with payload:", testRequest);
                                
                                const results = await ratingApi.getScoring(testRequest, ratingConfig);
                                console.log("🧪 Debug results:", results);
                                
                                if (Array.isArray(results) && results.length > 0) {
                                  setScoringResults(results);
                                  toast({
                                    title: "Debug API Success",
                                    description: `Got ${results.length} result(s)`,
                                    variant: "default",
                                  });
                                } else {
                                  toast({
                                    title: "Debug API - No Results",
                                    description: "API returned empty array",
                                    variant: "default",
                                  });
                                }
                              } catch (error) {
                                console.error("🧪 Debug API failed:", error);
                                toast({
                                  title: "Debug API Failed",
                                  description: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            🧪 Debug API
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
