import React, { useEffect, useRef, useState } from 'react';
import { ClusterResult } from '../../../shared/schema';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Download, FileImage } from "lucide-react";

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
}

export default function ClusterVisualization({ 
  clusterResult, 
  width = 800, 
  height = 600 
}: ClusterVisualizationProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [plotReady, setPlotReady] = useState(false);

  useEffect(() => {
    if (!clusterResult.embedding || !clusterResult.size || !clusterResult.labels) {
      return;
    }

    // Use labels array directly
    const labels = clusterResult.labels;

    // Prepare data points
    const points: DataPoint[] = clusterResult.embedding.map((coords: number[], i: number) => ({
      x: coords[0],
      y: coords[1],
      cluster: labels[i] || 0,
      size: clusterResult.size![i] || 0,
      index: i
    }));

    setData(points);
  }, [clusterResult]);

  useEffect(() => {
    if (!data.length || !plotRef.current) return;

    // Get unique clusters and define colors
    const clusters = Array.from(new Set(data.map(d => d.cluster))).sort();
    const colors = [
      '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
      '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107'
    ];

    // Create traces for each cluster
    const traces = clusters.map((clusterId, index) => {
      const clusterPoints = data.filter(d => d.cluster === clusterId);
      
      return {
        x: clusterPoints.map(d => d.x),
        y: clusterPoints.map(d => d.y),
        z: clusterPoints.map(d => d.size),
        mode: 'markers' as const,
        type: 'scatter3d' as const,
        name: `Cluster ${clusterId}`,
        marker: {
          color: colors[index % colors.length],
          size: 8,
          opacity: 0.8,
          line: {
            color: 'white',
            width: 1
          }
        },
        text: clusterPoints.map(d => 
          `Company ${d.index}<br>Cluster: ${d.cluster}<br>Size: ${d.size.toFixed(2)}<br>Position: (${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.size.toFixed(2)})`
        ),
        hovertemplate: '%{text}<extra></extra>',
      };
    });

    const layout = {
      title: {
        text: '3D Cluster Visualization with Company Size',
        font: { size: 16 }
      },
      scene: {
        xaxis: {
          title: 'Embedding X',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        yaxis: {
          title: 'Embedding Y',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        zaxis: {
          title: 'Size',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        }
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
      width: width,
      height: height
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
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

  return (
    <div className="cluster-visualization relative">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cluster Visualization</h3>
          <p className="text-sm text-gray-600">
            Voronoi diagram with company size heat map • Dataset: {clusterResult.dataset_id} • 
            Clusters: {clusterResult.best_k} • Samples: {clusterResult.n_samples}
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
        </div>
      </div>
      <div
        ref={plotRef}
        className="border border-gray-200 rounded"
        style={{ width, height }}
      />
    </div>
  );
}
