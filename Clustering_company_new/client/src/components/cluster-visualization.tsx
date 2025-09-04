import React, { useEffect, useRef, useState } from 'react';
import { ClusterResult } from '../../../shared/schema';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Download, FileImage } from "lucide-react";
import { Maximize } from "lucide-react";

interface ClusterVisualizationProps {
  clusterResult: ClusterResult;
  width?: number;
  height?: number;
}

interface DataPoint {
  x: number;
  y: number;
  cluster: number;
  size: number;
  index: number;
  companyInfo?: {
    name: string;
    taxcode: string;
    sector_name: string;
    sector_unique_id: string | number;
    empl_qtty: number;
    yearreport: number;
    s_DT_TTM: number;
    s_EMPL: number;
    s_TTS: number;
    s_VCSH: number;
    [key: string]: any; // For STD_RTD fields
  };
}

export default function ClusterVisualization({ 
  clusterResult, 
  width = 800, 
  // increase default height so page lengthens and becomes scrollable
  height = 1000 
}: ClusterVisualizationProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [plotReady, setPlotReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Add timestamp to verify code reload
  console.log("🚀 ClusterVisualization component loaded at:", new Date().toLocaleTimeString());

  useEffect(() => {
    console.log("🔍 Processing cluster result:", clusterResult);
    console.log("🔄 useEffect triggered - checking for duplicates");
    
    // Handle new API response format with companies array
    if (clusterResult.companies && Array.isArray(clusterResult.companies)) {
      console.log("📊 Found companies array with", clusterResult.companies.length, "companies");
      const points: DataPoint[] = [];
      let pointIndex = 0;
      
      // Clear existing data to prevent duplicates
      setData([]);
      
      clusterResult.companies.forEach((company: any, companyIndex: number) => {
        console.log(`🏢 Processing company ${companyIndex}:`, company);
        const enterpriseCount = company.enterprise?.length || 0;
        console.log(`📊 Company has ${enterpriseCount} enterprises`);
        if (enterpriseCount > 1) {
          console.log(`⚠️ Multiple enterprises found in company ${companyIndex}:`, 
            company.enterprise.map((e: any) => e.name || e.taxcode || `Enterprise ${e.id || 'unknown'}`));
        }
        if (company.enterprise && Array.isArray(company.enterprise)) {
          company.enterprise.forEach((enterprise: any, enterpriseIndex: number) => {
            console.log(`🏭 Processing enterprise ${enterpriseIndex}:`, {
              name: enterprise.name,
              cluster: enterprise.cluster,
              embedding: enterprise.embedding,
              s_DT_TTM: enterprise.s_DT_TTM,
              s_EMPL: enterprise.s_EMPL
            });
            
            const clusterLabel = enterprise.cluster || enterprise.Label || 0;
            const pcaX = enterprise.pca2_x || (enterprise.embedding ? enterprise.embedding[0] : 0);
            const pcaY = enterprise.pca2_y || (enterprise.embedding ? enterprise.embedding[1] : 0);
            
            // Calculate size as length of embedding vector excluding last 4 elements
            let calculatedSize = 0.1; // default minimum size
            if (enterprise.embedding && Array.isArray(enterprise.embedding) && enterprise.embedding.length > 4) {
              const embeddingSubset = enterprise.embedding.slice(0, -4); // exclude last 4 elements
              calculatedSize = Math.sqrt(embeddingSubset.reduce((sum: number, val: number) => sum + val * val, 0)); // vector length
              calculatedSize = Math.max(0.1, calculatedSize); // ensure minimum size
            }
            
            console.log(`📏 Calculated size for ${enterprise.name}:`, calculatedSize);
            
            points.push({
              x: pcaX,
              y: pcaY,
              cluster: clusterLabel,
              size: calculatedSize,
              index: pointIndex,
              companyInfo: {
                name: enterprise.name || 'Unknown Company',
                taxcode: enterprise.taxcode || '',
                sector_name: enterprise.sector_name || '',
                sector_unique_id: enterprise.sector_unique_id || company.sector_unique_id || '',
                empl_qtty: enterprise.empl_qtty || 0,
                yearreport: enterprise.yearreport || 2024,
                s_DT_TTM: enterprise.s_DT_TTM || 0,
                s_EMPL: enterprise.s_EMPL || 0,
                s_TTS: enterprise.s_TTS || 0,
                s_VCSH: enterprise.s_VCSH || 0,
                // Include all STD_RTD fields
                ...Object.keys(enterprise)
                  .filter(key => key.startsWith('STD_RTD'))
                  .reduce((acc, key) => ({ ...acc, [key]: enterprise[key] }), {})
              }
            });
            pointIndex++;
          });
        }
      });
      
      console.log("✅ Final processed points:", points.length, points);
      
      // Remove duplicates based on coordinates and company info
      console.log("🔍 Removing duplicate points:");
      const uniquePoints: DataPoint[] = [];
      const seenKeys = new Set<string>();
      
      points.forEach((point, index) => {
        const uniqueKey = `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.companyInfo?.taxcode || point.companyInfo?.name || index}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          uniquePoints.push(point);
        } else {
          console.log(`⚠️ Removing duplicate point:`, {
            coordinates: `(${point.x}, ${point.y})`,
            name: point.companyInfo?.name,
            taxcode: point.companyInfo?.taxcode
          });
        }
      });
      
      console.log(`📊 Removed ${points.length - uniquePoints.length} duplicates. Final points: ${uniquePoints.length}`);
      
      // Debug: Check if points have valid coordinates
      const validPoints = uniquePoints.filter(p => p.x !== undefined && p.y !== undefined && !isNaN(p.x) && !isNaN(p.y));
      console.log(`🔢 Valid points with coordinates: ${validPoints.length} out of ${uniquePoints.length}`);
      
      setData(uniquePoints);
    } else if (clusterResult.embedding && clusterResult.size && clusterResult.labels) {
      console.log("📊 Using legacy format");
      // Fallback: Use legacy format
      const labels = clusterResult.labels;
      const points: DataPoint[] = clusterResult.embedding.map((coords: number[], i: number) => ({
        x: coords[0],
        y: coords[1],
        cluster: labels[i] || 0,
        size: clusterResult.size![i] || 0,
        index: i
      }));
      console.log("✅ Legacy points:", points);
      setData(points);
    } else {
      console.warn("⚠️ No valid data format found in cluster result");
    }
  }, [clusterResult]);

  useEffect(() => {
    if (!data.length || !plotRef.current) {
      console.log("⚠️ No data or plotRef:", { dataLength: data.length, plotRef: !!plotRef.current });
      return;
    }

    console.log("🎨 Creating visualization with", data.length, "data points");

    // Get unique clusters and define colors
    const clusters = Array.from(new Set(data.map((d: DataPoint) => d.cluster))).sort();
    console.log("🎯 Found clusters:", clusters);
    
    const colors = [
      '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
      '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107'
    ];

    // Create one 3D scatter trace per cluster
    const traces = clusters.map((clusterId, clusterIndex) => {
      const clusterPoints = data.filter((d: DataPoint) => d.cluster === clusterId);
      const clusterColor = colors[clusterIndex % colors.length];

      // Create detailed hover text for each point in the cluster
      const hoverTexts = clusterPoints.map((point: DataPoint) => {
        let text = `<b>${point.companyInfo?.name || 'N/A'}</b><br>`;
        text += `Tax Code: ${point.companyInfo?.taxcode || 'N/A'}<br>`;
        text += `Sector: ${point.companyInfo?.sector_name || 'N/A'}<br>`;
        text += `Employees: ${(point.companyInfo?.empl_qtty || 0).toLocaleString()}<br>`;
        text += `PCA X: ${point.x.toFixed(3)}<br>`;
        text += `PCA Y: ${point.y.toFixed(3)}<br>`;
        text += `Size (Z): ${point.size.toFixed(2)}`;
        return text;
      });

      return {
        type: 'scatter3d',
        mode: 'markers',
        x: clusterPoints.map((p: DataPoint) => p.x),
        y: clusterPoints.map((p: DataPoint) => p.y),
        z: clusterPoints.map((p: DataPoint) => p.size),
        name: `Cluster ${clusterId}`,
        text: hoverTexts,
        hoverinfo: 'text',
        marker: {
          color: clusterColor,
          size: 5,
          opacity: 0.8,
        },
      };
    });

  // compute layout size from actual container so Plotly fills available width and height
  const container = plotRef.current!.parentElement as HTMLElement | null;
  const computedWidth = container ? container.clientWidth : width;
  const computedHeight = container ? container.clientHeight : height;

  const layout = {
        title: {
        text: '3D Scatter Plot - Company Clustering Analysis',
        font: { size: 16 }
      },
      scene: {
        xaxis: {
          title: 'PCA Component 1',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        yaxis: {
          title: 'PCA Component 2',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        zaxis: {
          title: 'Scale (Embedding Size)',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        },
        // Enable full 3D interaction: orbit, zoom, pan
        dragmode: 'orbit'
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      margin: { l: 60, r: 200, t: 60, b: 60 },
      showlegend: true,
      legend: {
        x: 1.02,
        xanchor: 'left',
        y: 1,
        yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0.95)',
        bordercolor: 'rgba(0,0,0,0.15)',
        borderwidth: 1,
      },
      // size to container so CSS-driven height/width controls page scroll
      width: computedWidth,
      height: computedHeight,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      // Enable all 3D interactions
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      // allow scroll wheel zoom
      scrollZoom: true,
    };

  Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);
    });

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [data, width, height]);

  const downloadPlotAsPNG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1200,
        height: 800,
        filename: 'cluster-visualization'
      });
    }
  };

  const downloadPlotAsSVG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'svg',
        width: 1200,
        height: 800,
        filename: 'cluster-visualization'
      });
    }
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current || plotRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      // Give the browser a tick then resize the Plotly plot to fit fullscreen
      setTimeout(() => {
        if (plotRef.current && (Plotly as any).Plots && (Plotly as any).Plots.resize) {
          try { (Plotly as any).Plots.resize(plotRef.current); } catch (e) { /* noop */ }
        }
      }, 200);
    } catch (err) {
      // ignore fullscreen errors (user may block)
    }
  };

  useEffect(() => {
    const handler = () => {
      if (plotRef.current && (Plotly as any).Plots && (Plotly as any).Plots.resize) {
        try { (Plotly as any).Plots.resize(plotRef.current); } catch (e) { /* noop */ }
      }
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handler);
    window.addEventListener('resize', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  return (
    <div className="cluster-visualization relative" ref={containerRef}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cluster Visualization</h3>
          <p className="text-sm text-gray-600">
            3D Scatter Plot showing company metrics by cluster • Dataset: {clusterResult.dataset_id} • 
            Clusters: {clusterResult.best_k} • Companies: {data.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPlotAsPNG}
            title="Download as PNG"
            data-testid="download-cluster-png"
            disabled={!plotReady}
          >
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPlotAsSVG}
            title="Download as SVG"
            data-testid="download-cluster-svg"
            disabled={!plotReady}
          >
            <FileImage className="h-4 w-4 mr-1" />
            SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            data-testid="fullscreen-cluster"
          >
            <Maximize className="h-4 w-4 mr-1" />
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </Button>
        </div>
      </div>
      <div className="border border-gray-200 rounded overflow-hidden" style={{ width: '100%' }}>
        <div
          ref={plotRef}
          className="w-full h-full"
          style={{ width: '100%', height: `${height}px` }}
        />
      </div>
    </div>
  );
}
