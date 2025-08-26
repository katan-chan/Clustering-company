import React from 'react';
import { ClusterResult } from '../../../shared/schema';

interface SimpleClusterVisualizationProps {
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

export default function SimpleClusterVisualization({ 
  clusterResult, 
  width = 800, 
  height = 600 
}: SimpleClusterVisualizationProps) {
  if (!clusterResult.embedding || !clusterResult.size || !clusterResult.labels) {
    return (
      <div className="flex items-center justify-center h-64 border border-gray-200 rounded">
        <p className="text-gray-500">No visualization data available</p>
      </div>
    );
  }

  // Prepare data points
  const data: DataPoint[] = clusterResult.embedding.map((coords: number[], i: number) => ({
    x: coords[0],
    y: coords[1],
    cluster: clusterResult.labels![i] || 0,
    size: clusterResult.size![i] || 0,
    index: i
  }));

  // Calculate bounds
  const xValues = data.map(d => d.x);
  const yValues = data.map(d => d.y);
  const sizeValues = data.map(d => d.size);
  
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const sizeMin = Math.min(...sizeValues);
  const sizeMax = Math.max(...sizeValues);

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Scale functions
  const scaleX = (x: number) => ((x - xMin) / (xMax - xMin)) * innerWidth;
  const scaleY = (y: number) => innerHeight - ((y - yMin) / (yMax - yMin)) * innerHeight;
  const scaleSize = (size: number) => 3 + ((size - sizeMin) / (sizeMax - sizeMin)) * 12;
  
  // Color palette for clusters
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
  ];
  
  // Get cluster color
  const getClusterColor = (cluster: number) => {
    return colors[cluster % colors.length];
  };

  const clusters = Array.from(new Set(data.map(d => d.cluster))).sort();

  return (
    <div className="cluster-visualization">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Cluster Visualization</h3>
        <p className="text-sm text-gray-600">
          Node size = Company size • Node color = Cluster • Dataset: {clusterResult.dataset_id} • 
          Clusters: {clusterResult.best_k} • Samples: {clusterResult.n_samples}
        </p>
      </div>
      
      <div className="flex gap-4">
        <div className="relative">
          <svg
            width={width}
            height={height}
            className="border border-gray-200 rounded"
          >
            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Draw points */}
              {data.map((point, i) => (
                <circle
                  key={i}
                  cx={scaleX(point.x)}
                  cy={scaleY(point.y)}
                  r={scaleSize(point.size)}
                  fill={getClusterColor(point.cluster)}
                  stroke="#333"
                  strokeWidth="1"
                  opacity="0.8"
                  className="hover:opacity-100 cursor-pointer"
                >
                  <title>
                    Company {point.index} | Cluster: {point.cluster} | Size: {point.size.toFixed(2)} | Position: ({point.x.toFixed(2)}, {point.y.toFixed(2)})
                  </title>
                </circle>
              ))}
            </g>
          </svg>
        </div>
        
        {/* Legend */}
        <div className="flex flex-col gap-4">
          {/* Cluster Legend */}
          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-medium mb-2">Clusters</h4>
            <div className="space-y-1">
              {clusters.map(cluster => (
                <div key={cluster} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2"
                    style={{ 
                      backgroundColor: colors[cluster % colors.length],
                      borderColor: '#333'
                    }}
                  />
                  <span className="text-sm">Cluster {cluster}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Size Legend */}
          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-medium mb-2">Company Size</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 border border-gray-600" />
                <span className="text-xs">Small ({sizeMin.toFixed(1)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400 border border-gray-600" />
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400 border border-gray-600" />
                <span className="text-xs">Large ({sizeMax.toFixed(1)})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
