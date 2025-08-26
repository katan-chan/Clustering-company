import React, { useEffect, useRef, useState } from 'react';
import { ClusterResult } from '../../../shared/schema';

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
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);

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
    if (!data.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    const xExtent = d3.extent(data, d => d.x) as [number, number];
    const yExtent = d3.extent(data, d => d.y) as [number, number];
    const sizeExtent = d3.extent(data, d => d.size) as [number, number];

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([innerHeight, 0]);

    const sizeScale = d3.scaleLinear()
      .domain(sizeExtent)
      .range([3, 15]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create Voronoi diagram
    const voronoi = Delaunay
      .from(data, (d: DataPoint) => xScale(d.x), (d: DataPoint) => yScale(d.y))
      .voronoi([0, 0, innerWidth, innerHeight]);

    // Draw Voronoi cells grouped by cluster
    const clusterGroups = d3.group(data, d => d.cluster);
    
    clusterGroups.forEach((points, cluster) => {
      const clusterColor = colorScale(cluster.toString());
      
      points.forEach((point, i) => {
        const cell = voronoi.renderCell(point.index);
        if (cell) {
          g.append("path")
            .attr("d", cell)
            .attr("fill", clusterColor)
            .attr("fill-opacity", 0.1)
            .attr("stroke", clusterColor)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.3);
        }
      });
    });

    // Create size color scale for heat map
    const heatColorScale = d3.scaleSequential(d3.interpolateYlOrRd)
      .domain(sizeExtent);

    // Draw nodes with heat map coloring
    g.selectAll(".node")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", d => sizeScale(d.size))
      .attr("fill", d => heatColorScale(d.size))
      .attr("stroke", d => colorScale(d.cluster.toString()))
      .attr("stroke-width", 2)
      .attr("opacity", 0.8)
      .on("mouseover", function(event, d) {
        // Tooltip
        const tooltip = d3.select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0,0,0,0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000");

        tooltip.html(`
          <div>Company ${d.index}</div>
          <div>Cluster: ${d.cluster}</div>
          <div>Size: ${d.size.toFixed(2)}</div>
          <div>Position: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");

        // Highlight node
        d3.select(this)
          .attr("stroke-width", 4)
          .attr("opacity", 1);
      })
      .on("mouseout", function() {
        d3.selectAll(".tooltip").remove();
        d3.select(this)
          .attr("stroke-width", 2)
          .attr("opacity", 0.8);
      });

    // Add legend for clusters
    const legend = g.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${innerWidth - 120}, 20)`);

    const clusters = Array.from(new Set(data.map(d => d.cluster))).sort();
    
    legend.selectAll(".legend-item")
      .data(clusters)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`)
      .each(function(d) {
        const g = d3.select(this);
        g.append("circle")
          .attr("r", 6)
          .attr("fill", colorScale(d.toString()))
          .attr("stroke", "#333")
          .attr("stroke-width", 1);
        
        g.append("text")
          .attr("x", 12)
          .attr("y", 4)
          .text(`Cluster ${d}`)
          .attr("font-size", "12px")
          .attr("fill", "#333");
      });

    // Add size legend (heat map)
    const sizeLegend = g.append("g")
      .attr("class", "size-legend")
      .attr("transform", `translate(20, ${innerHeight - 80})`);

    sizeLegend.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .text("Company Size")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "#333");

    const legendScale = d3.scaleLinear()
      .domain(sizeExtent)
      .range([0, 100]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".1f"));

    // Create gradient for size legend
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "size-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    gradient.selectAll("stop")
      .data(d3.range(0, 1.1, 0.1))
      .enter()
      .append("stop")
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d => heatColorScale(sizeExtent[0] + d * (sizeExtent[1] - sizeExtent[0])));

    sizeLegend.append("rect")
      .attr("width", 100)
      .attr("height", 15)
      .attr("fill", "url(#size-gradient)")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);

    sizeLegend.append("g")
      .attr("transform", "translate(0, 15)")
      .call(legendAxis);

  }, [data, width, height]);

  return (
    <div className="cluster-visualization">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Cluster Visualization</h3>
        <p className="text-sm text-gray-600">
          Voronoi diagram with company size heat map • Dataset: {clusterResult.dataset_id} • 
          Clusters: {clusterResult.best_k} • Samples: {clusterResult.n_samples}
        </p>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-200 rounded"
      />
    </div>
  );
}
