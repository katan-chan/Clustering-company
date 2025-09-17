
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
import { ratingApi, type RatingConfig, type TierResponse, type CompanyDetail, type Tier } from "@/lib/rating-api";

const apiSchema = z.object({
  endpoint: z.string().url("Please enter a valid URL"),
});

export default function CompanyRating() {
  const { toast } = useToast();
  const plotRef = useRef<HTMLDivElement>(null);
  
  // State for API configuration
  const [ratingConfig, setRatingConfig] = useState<RatingConfig>({
    endpoint: ""
  });
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  
  // State for controls
  const [indicators, setIndicators] = useState<string[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("A");
  const [selectedGroupLabel, setSelectedGroupLabel] = useState<number>(1);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState<string>("");
  
  // State for data
  const [tierData, setTierData] = useState<TierResponse | null>(null);
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
    if (selectedIndicator && selectedSector && ratingConfig.endpoint) {
      loadTierData();
    }
  }, [selectedIndicator, selectedSector, selectedGroupLabel, ratingConfig.endpoint]);

  // Load company details when companies are selected
  useEffect(() => {
    if (selectedCompanies.length > 0 && selectedIndicator && ratingConfig.endpoint) {
      loadCompanyDetails();
    } else {
      setCompanyDetails([]);
    }
  }, [selectedCompanies, selectedIndicator, ratingConfig.endpoint]);
  
  const onApiConfigSubmit = async (data: { endpoint: string }) => {
    setRatingConfig({ endpoint: data.endpoint });
    
    if (data.endpoint) {
      setConnectionStatus("checking");
      try {
        const connected = await ratingApi.testConnection({ endpoint: data.endpoint });
        if (connected) {
          setConnectionStatus("connected");
          await loadIndicators();
          toast({
            title: "Connection Successful",
            description: "Successfully connected to Rating API",
            variant: "default",
          });
        } else {
          throw new Error("Connection failed");
        }
      } catch (error) {
        console.error("Connection failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
        toast({
          title: "Connection Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setConnectionStatus("disconnected");
      }
    } else {
      setConnectionStatus("disconnected");
    }
  };
  
  const loadIndicators = async () => {
    try {
      const indicatorList = await ratingApi.getIndicators(ratingConfig);
      setIndicators(indicatorList);
      if (indicatorList.length > 0) {
        setSelectedIndicator(indicatorList[0]);
      }
    } catch (error) {
      console.error("Failed to load indicators:", error);
      toast({
        title: "Error loading indicators",
        description: "Failed to load indicator list",
        variant: "destructive",
      });
    }
  };
  
  const loadTierData = async () => {
    setLoading(true);
    try {
      const tierResponse = await ratingApi.getTiers({
        sector: selectedSector,
        group_label: selectedGroupLabel,
        indicator: selectedIndicator,
      }, ratingConfig);
      
      setTierData(tierResponse);
      updateChart(tierResponse);
    } catch (error) {
      console.error("Failed to load tier data:", error);
      toast({
        title: "Error loading tier data",
        description: "Failed to load tier analysis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const updateChart = (data: TierResponse) => {
    if (!plotRef.current) return;
    
    const tierLabels = data.tiers.map(t => t.tier);
    const tierCounts = data.tiers.map(t => t.count);
    
    // Color scheme: T1 (best) = green, gradually to T8 (worst) = red
    const tierColors = [
      '#10b981', // T1 - Green (best)
      '#22c55e', // T2 - Light green
      '#84cc16', // T3 - Lime green
      '#eab308', // T4 - Yellow
      '#f59e0b', // T5 - Amber
      '#f97316', // T6 - Orange
      '#ef4444', // T7 - Red
      '#dc2626'  // T8 - Dark red (worst)
    ];
    
    const trace = {
      x: tierLabels,
      y: tierCounts,
      type: 'bar' as const,
      marker: {
        color: tierColors.slice(0, tierLabels.length),
        line: {
          color: '#374151',
          width: 1
        }
      },
      text: tierCounts.map(count => `${count} companies`),
      textposition: 'auto' as const,
      hovertemplate: '<b>%{x}</b><br>Companies: %{y}<br>Sector: ' + data.sector + '<extra></extra>'
    };
    
    const layout = {
      title: {
        text: `Company Rating Distribution - Sector ${data.sector}<br><sub>Indicator: ${data.indicator} | Group: ${data.group_label} | Method: ${data.method.label} (${data.method.mode})</sub>`,
        font: { size: 16 }
      },
      xaxis: {
        title: 'Rating Tiers (T1=Best → T8=Worst)',
        tickfont: { size: 12 }
      },
      yaxis: {
        title: 'Number of Companies',
        tickfont: { size: 12 }
      },
      margin: { t: 100, r: 50, b: 80, l: 60 },
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
    
    Plotly.newPlot(plotRef.current, [trace], layout, config);
    
    // Add click handler
    (plotRef.current as any).on('plotly_click', (clickData: any) => {
      if (clickData.points && clickData.points[0]) {
        const tierIndex = clickData.points[0].pointIndex;
        const tier = tierLabels[tierIndex];
        const count = tierCounts[tierIndex];
        const tierInfo = data.tiers[tierIndex];
        
        let rangeText = '';
        if (tierInfo.range[0] === '-inf') {
          rangeText = `≤ ${tierInfo.range[1]}`;
        } else if (tierInfo.range[1] === 'inf') {
          rangeText = `≥ ${tierInfo.range[0]}`;
        } else {
          rangeText = `${tierInfo.range[0]} - ${tierInfo.range[1]}`;
        }
        
        toast({
          title: `Tier ${tier} Details`,
          description: `Sector: ${selectedSector} | Range: ${rangeText} | Companies: ${count}`,
          variant: "default",
        });
      }
    });
  };
  
  const loadCompanyDetails = async () => {
    if (selectedCompanies.length === 0) {
      setCompanyDetails([]);
      return;
    }
    
    try {
      const details = await ratingApi.getCompanyDetails({
        taxcodes: selectedCompanies,
        sector: selectedSector,
        indicator: selectedIndicator,
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
    if (!tierData) return;
    
    let csvContent = "Tier,Range_Min,Range_Max,Company_Count\n";
    
    tierData.tiers.forEach(tier => {
      const rangeMin = tier.range[0] === '-inf' ? 'Negative Infinity' : tier.range[0];
      const rangeMax = tier.range[1] === 'inf' ? 'Positive Infinity' : tier.range[1];
      csvContent += `${tier.tier},${rangeMin},${rangeMax},${tier.count}\n`;
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
    link.download = `company_rating_${selectedSector}_${selectedIndicator}.csv`;
    link.click();
    
    toast({
      title: "CSV Exported",
      description: "Company rating data has been exported successfully",
      variant: "default",
    });
  };
  
  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Left Sidebar - Controls */}
      <div className="w-full lg:w-80 lg:min-w-[280px] lg:max-w-[400px] xl:w-96 bg-card border-r border-border flex flex-col lg:h-screen">
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
              {/* Indicator Selection */}
              <div className="space-y-2">
                <Label>Financial Indicator</Label>
                <Select value={selectedIndicator} onValueChange={setSelectedIndicator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select indicator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {indicators.map(indicator => (
                      <SelectItem key={indicator} value={indicator}>
                        {indicator}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Sector Selection */}
              <div className="space-y-2">
                <Label>Industry Sector</Label>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"].map(sector => (
                      <SelectItem key={sector} value={sector}>
                        Sector {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Group Label */}
              <div className="space-y-2">
                <Label>Group Label</Label>
                <Select value={selectedGroupLabel.toString()} onValueChange={(value) => setSelectedGroupLabel(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(label => (
                      <SelectItem key={label} value={label.toString()}>
                        Group {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
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
                disabled={!tierData}
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
              <CardContent className="p-6 h-full">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading tier data...</p>
                    </div>
                  </div>
                ) : (
                  <div ref={plotRef} className="w-full h-full min-h-[400px]" />
                )}
              </CardContent>
            </Card>
            
            {/* Data Tables */}
            <div className="flex-1 m-4 mt-2 space-y-4">
              {/* Tier Summary Table */}
              {tierData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tier Distribution Summary</CardTitle>
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
                            rangeText = `≤ ${tier.range[1]}`;
                          } else if (tier.range[1] === 'inf') {
                            rangeText = `≥ ${tier.range[0]}`;
                          } else {
                            rangeText = `${tier.range[0]} - ${tier.range[1]}`;
                          }
                          
                          return (
                            <TableRow key={tier.tier}>
                              <TableCell>
                                <Badge variant={tier.tier <= "T4" ? "default" : "destructive"}>
                                  {tier.tier}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{rangeText}</TableCell>
                              <TableCell>{tier.count}</TableCell>
                              <TableCell>{percentage}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
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
