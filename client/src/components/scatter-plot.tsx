import { useEffect, useRef, useState } from "react";
import { useClusteringStore } from "@/lib/clustering-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Move, ZoomIn, Lasso, Maximize, ExternalLink } from "lucide-react";
import Plotly from "plotly.js-dist";

export default function ScatterPlot() {
  const { results, processing, selectedProjectionType } = useClusteringStore();
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
  const [activeTool, setActiveTool] = useState<"pan" | "zoom" | "lasso">("pan");

  // Check if we should show projection image
  const shouldShowProjectionImage = (results as any)?.projectionImages && 
    selectedProjectionType && 
    (results as any).projectionImages[selectedProjectionType];

  // Render projection image view
  const renderProjectionImage = () => (
    <div className="flex-1 flex flex-col bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {selectedProjectionType.toUpperCase()} Projection
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = (results as any).projectionImages[selectedProjectionType];
                link.download = `${selectedProjectionType}_projection.png`;
                link.click();
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="max-w-full max-h-full overflow-auto">
          <img 
            src={(results as any).projectionImages[selectedProjectionType]} 
            alt={`${selectedProjectionType} projection`}
            className="max-w-full max-h-full object-contain bg-white rounded-lg shadow-lg"
            onError={(e) => {
              console.error(`Failed to load ${selectedProjectionType} image:`, e);
            }}
          />
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!plotRef.current || !results?.dataPoints) return;

    const dataPoints = results.dataPoints;
    const clusters = Array.from(new Set(dataPoints.map(d => d.cluster).filter(Boolean))).sort();
    
    // Color palette for clusters
    const colors = [
      '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
      '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107'
    ];

    // Prepare data for each cluster
    const traces = clusters.map((clusterId, index) => {
      const clusterPoints = dataPoints.filter(d => d.cluster === clusterId);
      const showCluster = selectedClusters.length === 0 || selectedClusters.includes(clusterId!);
      
      return {
        x: clusterPoints.map(d => d.pca?.x || 0),
        y: clusterPoints.map(d => d.pca?.y || 0),
        mode: 'markers' as const,
        type: 'scatter' as const,
        name: `Cluster ${clusterId} (${clusterPoints.length})`,
        marker: {
          color: colors[index % colors.length],
          size: 6,
          opacity: showCluster ? 0.7 : 0.1,
        },
        text: clusterPoints.map(d => 
          `ID: ${d.id}<br>Cluster: ${d.cluster}<br>PCA: (${d.pca?.x.toFixed(2)}, ${d.pca?.y.toFixed(2)})`
        ),
        hovertemplate: '%{text}<extra></extra>',
        visible: showCluster,
      };
    });

    const layout = {
      title: {
        text: '',
        font: { size: 16 }
      },
      xaxis: {
        title: 'PCA Component 1 (34.2% variance)',
        showgrid: true,
        gridcolor: 'rgba(0,0,0,0.1)',
        showticklabels: true,
        tickformat: '.2f',
        zeroline: true,
        zerolinecolor: 'rgba(0,0,0,0.2)',
      },
      yaxis: {
        title: 'PCA Component 2 (22.8% variance)',
        showgrid: true,
        gridcolor: 'rgba(0,0,0,0.1)',
        showticklabels: true,
        tickformat: '.2f',
        zeroline: true,
        zerolinecolor: 'rgba(0,0,0,0.2)',
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      margin: { l: 80, r: 200, t: 50, b: 80 },
      showlegend: true,
      legend: {
        x: 1.02,
        xanchor: 'left',
        y: 1,
        yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0.95)',
        bordercolor: 'rgba(0,0,0,0.15)',
        borderwidth: 1,
        font: { size: 12 },
        itemsizing: 'constant',
        itemwidth: 30,
      },
    };

    const config = {
      responsive: true,
      displayModeBar: false, // We'll use our own toolbar
      doubleClick: 'reset',
    };

    Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);
    });

    // Set up tool interactions
    if (plotRef.current) {
      const plotDiv = plotRef.current as any;
      
      switch (activeTool) {
        case 'pan':
          Plotly.relayout(plotDiv, { dragmode: 'pan' });
          break;
        case 'zoom':
          Plotly.relayout(plotDiv, { dragmode: 'zoom' });
          break;
        case 'lasso':
          Plotly.relayout(plotDiv, { dragmode: 'lasso' });
          break;
      }
    }

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [results, selectedClusters, activeTool]);

  const handleClusterFilter = (value: string) => {
    if (value === "all") {
      setSelectedClusters([]);
    } else {
      const clusterId = parseInt(value);
      setSelectedClusters([clusterId]);
    }
  };

  const resetZoom = () => {
    if (plotRef.current && plotReady) {
      Plotly.relayout(plotRef.current, {
        'xaxis.autorange': true,
        'yaxis.autorange': true
      });
    }
  };

  // Render scatter plot view
  const renderScatterPlot = () => {
    if (processing) {
      return (
        <div className="flex-1 flex items-center justify-center bg-card">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Processing clustering...</p>
          </div>
        </div>
      );
    }

    if (!results || !results.dataPoints || results.dataPoints.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center bg-card">
          <div className="text-center text-muted-foreground">
            <div className="mb-3">📊</div>
            <p>No data to visualize</p>
            <p className="text-sm mt-2">Upload files and run clustering to see results</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-card">
        {/* Toolbar */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">PCA Scatter Plot</h2>
            
            <div className="flex items-center gap-2">
              {/* Cluster Filter */}
              <Select
                value={selectedClusters.length === 0 ? "all" : selectedClusters.join(",")}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedClusters([]);
                  } else {
                    setSelectedClusters(value.split(",").map(Number));
                  }
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clusters</SelectItem>
                  {Array.from(new Set(results.dataPoints.map(d => d.cluster).filter(Boolean))).sort().map(cluster => (
                    <SelectItem key={cluster} value={cluster!.toString()}>
                      Cluster {cluster}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tools */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant={activeTool === "pan" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("pan")}
              title="Pan"
              data-testid="tool-pan"
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "zoom" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("zoom")}
              title="Zoom"
              data-testid="tool-zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "lasso" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("lasso")}
              title="Lasso Select"
              data-testid="tool-lasso"
            >
              <Lasso className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              title="Reset Zoom"
              data-testid="tool-reset"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Plot Container */}
        <Card className="flex-1 p-4">
          <div
            ref={plotRef}
            className="w-full h-full"
            data-testid="scatter-plot"
          />
        </Card>
      </div>
    );
  };

  // Return appropriate view based on state
  if (shouldShowProjectionImage) {
    return renderProjectionImage();
  }

  return renderScatterPlot();
}
