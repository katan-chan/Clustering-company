/**
 * Custom hook for managing Plotly chart lifecycle
 * Giải quyết memory leak issues bằng cách:
 * 1. Proper cleanup của Plotly instances
 * 2. Removal của event listeners
 * 3. DOM cleanup khi unmount
 * 4. Memoization để tránh unnecessary re-renders
 */

import { useEffect, useRef, useCallback } from 'react';
import Plotly from 'plotly.js-dist';
import type { TierResponse } from "@/lib/rating-api";

interface PlotlyChartInstance {
  id: string;
  element: HTMLDivElement;
  isInitialized: boolean;
}

interface UseChartManagerOptions {
  onChartClick?: (data: any) => void;
}

export const useChartManager = ({ onChartClick }: UseChartManagerOptions = {}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartsRef = useRef<Map<string, PlotlyChartInstance>>(new Map());
  const isDestroyingRef = useRef(false);

  /**
   * Cleanup function để destroy tất cả chart instances
   * Tuân theo Single Responsibility Principle
   */
  const destroyAllCharts = useCallback(async () => {
    if (isDestroyingRef.current) return;
    isDestroyingRef.current = true;

    console.log("🧹 Starting cleanup of all chart instances...");

    const charts = Array.from(chartsRef.current.values());
    
    // Cleanup từng chart instance
    const cleanupPromises = charts.map(async (chart) => {
      try {
        if (chart.isInitialized && chart.element) {
          console.log(`🗑️ Destroying chart: ${chart.id}`);
          
          // Remove event listeners trước khi destroy
          if ((chart.element as any).removeAllListeners) {
            (chart.element as any).removeAllListeners();
          }
          
          // Destroy Plotly instance
          await Plotly.purge(chart.element);
          
          // Remove from DOM if still attached
          if (chart.element.parentNode) {
            chart.element.parentNode.removeChild(chart.element);
          }
        }
      } catch (error) {
        console.error(`❌ Error destroying chart ${chart.id}:`, error);
      }
    });

    await Promise.all(cleanupPromises);
    
    // Clear charts map
    chartsRef.current.clear();
    
    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    isDestroyingRef.current = false;
    console.log("✅ All charts cleaned up successfully");
  }, []);

  /**
   * Create individual chart với proper error handling
   * Tuân theo Open/Closed Principle - có thể extend cho chart types khác
   */
  const createChart = useCallback(async (
    tierData: TierResponse,
    index: number,
    formatters: {
      getIndicatorDescription: (indicator: string) => string;
      identifyIndicatorGroup: (indicators: string[]) => string | null;
      getGroupDisplayName: (indicators: string[]) => string;
      sectorNames: Record<string, string>;
    }
  ) => {
    if (!containerRef.current || isDestroyingRef.current) {
      console.warn("⚠️ Container not available or destroying in progress");
      return;
    }

    const chartId = `chart-${index}-${Date.now()}`;
    
    try {
      console.log(`📊 Creating chart ${chartId} for indicator:`, tierData.indicator);

      // Create chart container element
      const chartDiv = document.createElement('div');
      chartDiv.id = chartId;
      chartDiv.style.height = '500px';
      chartDiv.style.marginBottom = '20px';
      chartDiv.style.width = '100%';
      chartDiv.className = 'plotly-chart-container';

      containerRef.current.appendChild(chartDiv);

      // Prepare chart data
      const chartData = prepareChartData(tierData, formatters);
      const { trace, layout, config } = chartData;

      // Create Plotly chart
      await Plotly.newPlot(chartDiv, [trace], layout, config);

      // Add event listener with proper cleanup tracking
      const clickHandler = (clickData: any) => {
        if (onChartClick && clickData.points && clickData.points[0]) {
          const tierIndex = clickData.points[0].pointIndex;
          const tierInfo = tierData.tiers[tierIndex];
          onChartClick({
            indicator: tierData.indicator,
            tier: tierInfo,
            sector: 'sector' in tierData ? tierData.sector : "All"
          });
        }
      };

      chartDiv.addEventListener('plotly_click', clickHandler);

      // Store chart instance reference
      chartsRef.current.set(chartId, {
        id: chartId,
        element: chartDiv,
        isInitialized: true
      });

      console.log(`✅ Chart ${chartId} created successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to create chart ${chartId}:`, error);
      
      // Cleanup failed chart
      const failedElement = document.getElementById(chartId);
      if (failedElement && failedElement.parentNode) {
        failedElement.parentNode.removeChild(failedElement);
      }
      
      // Create error placeholder
      if (containerRef.current) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'flex items-center justify-center h-full text-red-500 p-8';
        errorDiv.innerHTML = `
          <div class="text-center">
            <p class="font-medium">Failed to create chart for ${tierData.indicator}</p>
            <p class="text-sm mt-2">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        `;
        containerRef.current.appendChild(errorDiv);
      }
    }
  }, [onChartClick]);

  /**
   * Render multiple charts với proper sequencing
   * Tuân theo Dependency Inversion Principle - phụ thuộc vào interfaces
   */
  const renderCharts = useCallback(async (
    tierDataList: TierResponse[],
    formatters: {
      getIndicatorDescription: (indicator: string) => string;
      identifyIndicatorGroup: (indicators: string[]) => string | null;
      getGroupDisplayName: (indicators: string[]) => string;
      sectorNames: Record<string, string>;
    }
  ) => {
    if (!containerRef.current || isDestroyingRef.current) return;

    console.log("📈 Starting chart rendering process...", tierDataList.length, "charts");

    // Destroy existing charts first
    await destroyAllCharts();

    if (!tierDataList || tierDataList.length === 0) {
      containerRef.current.innerHTML = `
        <div class="flex items-center justify-center h-full text-muted-foreground min-h-[400px]">
          <div class="text-center max-w-md">
            <div class="mb-4">📊</div>
            <h3 class="text-lg font-medium mb-2">No tier data available</h3>
            <p>Select indicators and load data to view tier distribution charts.</p>
          </div>
        </div>
      `;
      return;
    }

    // Create charts sequentially để tránh DOM conflicts
    for (let index = 0; index < tierDataList.length; index++) {
      const tierData = tierDataList[index];
      
      if (!tierData.tiers || tierData.tiers.length === 0) {
        console.warn(`⚠️ No tiers data for ${tierData.indicator}`);
        continue;
      }

      await createChart(tierData, index, formatters);
    }

    console.log("✅ All charts rendered successfully");
  }, [createChart, destroyAllCharts]);

  /**
   * Cleanup effect khi component unmount
   * Đảm bảo không có memory leak
   */
  useEffect(() => {
    return () => {
      console.log("🔄 Component unmounting, cleaning up charts...");
      destroyAllCharts();
    };
  }, [destroyAllCharts]);

  return {
    containerRef,
    renderCharts,
    destroyAllCharts,
    chartCount: chartsRef.current.size
  };
};

/**
 * Helper function để prepare chart data
 * Tách biệt logic data preparation khỏi rendering logic
 */
function prepareChartData(
  tierData: TierResponse,
  formatters: {
    getIndicatorDescription: (indicator: string) => string;
    identifyIndicatorGroup: (indicators: string[]) => string | null;
    getGroupDisplayName: (indicators: string[]) => string;
    sectorNames: Record<string, string>;
  }
) {
  // Helper function để format range values
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

  // Enhanced color scheme
  const tierColors = [
    '#10b981', '#22c55e', '#84cc16', '#eab308',
    '#f59e0b', '#f97316', '#ef4444', '#dc2626'
  ];

  const trace = {
    x: tierLabels,
    y: tierCounts,
    type: 'bar' as const,
    marker: {
      color: tierColors.slice(0, tierLabels.length),
      line: { color: '#374151', width: 1 }
    },
    text: tierCounts.map(count => `${count}`),
    textposition: 'auto' as const,
    hovertemplate: tierData.tiers.map((tier, idx) => {
      const rangeText = formatRange(tier.range);
      return `<b>${tier.tier}</b><br>Range: ${rangeText}<br>Companies: ${tier.count}<br>Sector: ${'sector' in tierData ? tierData.sector : "All"}<extra></extra>`;
    }),
    customdata: tierData.tiers.map(tier => ({
      tier: tier.tier,
      range: formatRange(tier.range),
      count: tier.count
    }))
  };

  // Create chart title
  let chartTitle = "";
  const description = formatters.getIndicatorDescription(tierData.indicator);
  const isGroupIndicator = tierData.indicator.includes('+');
  
  if (isGroupIndicator) {
    const components = tierData.indicator.split('+').map(comp => comp.trim());
    const groupName = formatters.getGroupDisplayName(components);
    const displayName = formatters.identifyIndicatorGroup(components) ? groupName : `Custom Group: ${groupName}`;
    
    const sector = 'sector' in tierData ? tierData.sector : "All";
    chartTitle = sector === "All" 
      ? `${displayName}<br><sub>TẤT CẢ CÁC DOANH NGHIỆP TOÀN BỘ SECTORS</sub><br><sub>Method: ${tierData.method.label} (${tierData.method.mode})</sub>`
      : `${displayName}<br><sub>CÁC DOANH NGHIỆP: (${sector}) ${(sector && formatters.sectorNames[sector]) || `Sector ${sector}`}</sub><br><sub>Group: ${('group_label' in tierData) ? tierData.group_label : 'N/A'} | Method: ${tierData.method.label} (${tierData.method.mode})</sub>`;
  } else {
    const displayTitle = description ? `${tierData.indicator} – ${description}` : tierData.indicator;
    const sector = 'sector' in tierData ? tierData.sector : "All";
    chartTitle = sector === "All" 
      ? `${displayTitle}<br><sub>TẤT CẢ CÁC DOANH NGHIỆP TOÀN BỘ SECTORS</sub><br><sub>Method: ${tierData.method.label} (${tierData.method.mode})</sub>`
      : `${displayTitle}<br><sub>CÁC DOANH NGHIỆP: (${sector}) ${(sector && formatters.sectorNames[sector]) || `Sector ${sector}`}</sub><br><sub>Group: ${('group_label' in tierData) ? tierData.group_label : 'N/A'} | Method: ${tierData.method.label} (${tierData.method.mode})</sub>`;
  }

  const layout = {
    title: {
      text: chartTitle,
      font: { size: 14 }
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

  return { trace, layout, config };
}