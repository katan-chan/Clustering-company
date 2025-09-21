// File: ScatterPlot.tsx  (thay thế file cũ)
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useClusteringStore } from "@/lib/clustering-store";
import { getAllIndustries } from "@/lib/industry-parser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Move, ZoomIn, Lasso, Maximize, Download, FileImage } from "lucide-react";
import Plotly from "plotly.js-dist";

/**
 * ScatterPlot (TSX)
 * - Full implementation: heatmap (surface), projection, droplines, 3D scatter
 * - Toggles: heatmap / projection / droplines
 * - Heatmap bins configurable (30 / 60 / 100)
 *
 * NOTE:
 * - Component expects `results` format similar file gốc (supports both new `clusterResult.companies` and legacy arrays).
 * - For Oz (quy mô DN) we look for normalized size fields; fallback to previous logic if not present.
 */

export default function ScatterPlot(): JSX.Element {
  const { results, isRunning, selectedProjectionType, parameters } = useClusteringStore();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
  const [activeTool, setActiveTool] = useState<"pan" | "zoom" | "lasso">("lasso");

  // Toggles & heatmap bins
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showProjection, setShowProjection] = useState(true);
  const [showDropLines, setShowDropLines] = useState(true);
  const [heatmapBins, setHeatmapBins] = useState<number>(60);

  // Helper: try to read normalized size from enterprise object
  const readNormalizedSize = (enterprise: any, fallbackCalculatedSize: number) => {
    // Common possible property names that may hold normalized size
    const keys = [
      "normalized_size",
      "size_normalized",
      "scale",
      "scaled_size",
      "normalizedScale",
      "size_norm",
      "size"
    ];
    for (const k of keys) {
      if (enterprise && enterprise[k] !== undefined && enterprise[k] !== null && !isNaN(Number(enterprise[k]))) {
        return Number(enterprise[k]);
      }
    }
    // legacy: maybe provided in enterprise.pca?.z etc
    if (enterprise && enterprise.pca && enterprise.pca.z !== undefined) {
      return Number(enterprise.pca.z);
    }
    return fallbackCalculatedSize;
  };

  // Process results into a normalized array of points for plotting
  const processedData = useMemo(() => {
    interface ScatterDataPoint {
      id: string;
      info: {
        name?: string;
        taxcode?: string;
        sector?: string;
        sector_unique_id?: string;
        employees?: number;
      };
      embedding: number[];
      pca: { x: number; y: number; z: number };
      cluster: number;
    }

    const out: ScatterDataPoint[] = [];
    if (!results) return out;

    console.log("🔍 ScatterPlot: Processing results", results);

    // Handle companies object format (key = taxcode)
    if (results?.clusterResult?.companies && typeof results.clusterResult.companies === 'object' && !Array.isArray(results.clusterResult.companies)) {
      console.log("✅ ScatterPlot: Found companies object, processing...");
      const companyEntries = Object.entries(results.clusterResult.companies);
      console.log("🏢 Companies count:", companyEntries.length);
      
      companyEntries.forEach(([taxcode, companyData]: [string, any], index) => {
        const clusterLabel = companyData.label || 0;
        const pcaX = companyData.pca_V?.[0] || 0;
        const pcaY = companyData.pca_V?.[1] || 0;
        const size = companyData.size || 1;
        
        out.push({
          id: `company-${index}`,
          info: {
            name: companyData.industryName || "Unknown Company",
            taxcode: taxcode,
            sector: companyData.industryName || "",
            sector_unique_id: companyData.sector_unique_id || "",
            employees: parseFloat(companyData.empl_qtty) || 0
          },
          embedding: [], // Not provided in this format
          pca: {
            x: pcaX,
            y: pcaY,
            z: size
          },
          cluster: Number(clusterLabel)
        });
      });
      
      console.log("✅ ScatterPlot: Created", out.length, "data points from companies object");
    } else if (results?.clusterResult?.companies && Array.isArray(results.clusterResult.companies)) {
      let pointIndex = 0;
      results.clusterResult.companies.forEach((company: any) => {
        if (company.enterprise && Array.isArray(company.enterprise)) {
          company.enterprise.forEach((enterprise: any) => {
            const clusterLabel = enterprise.cluster ?? enterprise.Label ?? 0;
            const embedding = Array.isArray(enterprise.embedding) ? enterprise.embedding : (enterprise.embedding && Array.from(enterprise.embedding)) || [];
            // try to compute fallback "calculatedSize" (if normalized size not provided)
            let fallbackCalculatedSize = 0;
            if (Array.isArray(enterprise.embedding) && enterprise.embedding.length > 4) {
              const four_size = enterprise.embedding.slice(0, -4);
              fallbackCalculatedSize = Math.sqrt(four_size.reduce((s: number, v: number) => s + v * v, 0));
              fallbackCalculatedSize = Math.max(0.1, fallbackCalculatedSize);
            } else if (enterprise.pca && typeof enterprise.pca.z === "number") {
              fallbackCalculatedSize = enterprise.pca.z;
            }

            const normalizedSize = readNormalizedSize(enterprise, fallbackCalculatedSize);

            out.push({
              id: `company-${pointIndex}`,
              info: {
                name: enterprise.name || "Unknown Company",
                taxcode: enterprise.taxcode || "",
                sector: enterprise.sector_name || "",
                sector_unique_id: enterprise.sector_unique_id || company.sector_unique_id || "",
                employees: enterprise.empl_qtty || 0
              },
              embedding: embedding,
              pca: {
                x: enterprise.pca2_x ?? enterprise.pca?.x ?? (embedding[0] ?? 0),
                y: enterprise.pca2_y ?? enterprise.pca?.y ?? (embedding[1] ?? 0),
                z: normalizedSize
              },
              cluster: Number(clusterLabel)
            });
            pointIndex++;
          });
        }
      });
    } else if (results?.clusterResult?.embedding && results?.clusterResult?.labels) {
      // legacy
      const embeddings = results.clusterResult.embedding;
      const labels = results.clusterResult.labels;
      const sizes = results.clusterResult.size ?? [];
      for (let i = 0; i < embeddings.length; i++) {
        out.push({
          id: `pt-${i}`,
          info: {},
          embedding: embeddings[i],
          pca: {
            x: embeddings[i][0] ?? 0,
            y: embeddings[i][1] ?? 0,
            z: sizes[i] ?? 0
          },
          cluster: Number(labels[i] ?? 0)
        });
      }
    } else if (results?.dataPoints && Array.isArray(results.dataPoints)) {
      // fallback: if results.dataPoints exists (earlier UI used this)
      results.dataPoints.forEach((dp: any, i: number) => {
        out.push({
          id: dp.id ?? `dp-${i}`,
          info: dp.info ?? {},
          embedding: dp.embedding ?? [],
          pca: {
            x: dp.pca?.x ?? (dp.embedding ? dp.embedding[0] : 0),
            y: dp.pca?.y ?? (dp.embedding ? dp.embedding[1] : 0),
            z: dp.pca?.z ?? dp.size ?? 0
          },
          cluster: Number(dp.cluster ?? 0)
        });
      });
    }

    return out;
  }, [results]);

  // Compute unique clusters (sorted)
  const clusters = useMemo(() => {
    const s = Array.from(new Set(processedData.map((d) => d.cluster).filter((c) => c !== null && c !== undefined)));
    return s.sort((a, b) => a - b);
  }, [processedData]);

  // color palette (extendable)
  const colorPalette = [
    "#1976D2", "#4CAF50", "#F44336", "#FF9800", "#9C27B0", "#FF5722",
    "#607D8B", "#795548", "#E91E63", "#00BCD4", "#8BC34A", "#FFC107",
  ];

  // Utility: compute density grid (bins x bins) for heatmap surface
  const computeDensityGrid = (xs: number[], ys: number[], bins: number) => {
    if (xs.length === 0) return { density: [[]], xCenters: [0], yCenters: [0] };

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Pad range a bit so points on edges are included
    const padX = (maxX - minX) * 1e-6 || 1e-6;
    const padY = (maxY - minY) * 1e-6 || 1e-6;

    const xEdges: number[] = [];
    const yEdges: number[] = [];
    for (let i = 0; i <= bins; i++) {
      xEdges.push(minX + (i / bins) * (maxX - minX + padX));
      yEdges.push(minY + (i / bins) * (maxY - minY + padY));
    }
    const xCenters = new Array(bins).fill(0).map((_, i) => (xEdges[i] + xEdges[i + 1]) / 2);
    const yCenters = new Array(bins).fill(0).map((_, i) => (yEdges[i] + yEdges[i + 1]) / 2);

    // init density matrix [ny][nx] (y rows, x cols)
    const density: number[][] = Array.from({ length: bins }, () => new Array(bins).fill(0));

    for (let k = 0; k < xs.length; k++) {
      const xv = xs[k], yv = ys[k];
      // find bin index
      let ix = Math.floor(((xv - xEdges[0]) / (xEdges[xEdges.length - 1] - xEdges[0])) * bins);
      let iy = Math.floor(((yv - yEdges[0]) / (yEdges[yEdges.length - 1] - yEdges[0])) * bins);
      if (ix < 0) ix = 0; if (ix >= bins) ix = bins - 1;
      if (iy < 0) iy = 0; if (iy >= bins) iy = bins - 1;
      density[iy][ix] += 1;
    }

    // Optionally normalize: scale to [0,1] or keep counts. Here just return raw counts.
    return { density, xCenters, yCenters };
  };

  // Main plotting effect — re-renders when dependencies change
  useEffect(() => {
    if (!plotRef.current) return;
    if (!processedData || processedData.length === 0) {
      // clear plot
      if ((plotRef.current as any)._fullLayout) {
        Plotly.purge(plotRef.current);
      }
      setPlotReady(false);
      return;
    }

    // filter by selectedClusters if any
    const filtered = selectedClusters.length === 0
      ? processedData
      : processedData.filter((d) => selectedClusters.includes(d.cluster));

    // arrays for all filtered points
    const xsAll = filtered.map((d) => d.pca.x);
    const ysAll = filtered.map((d) => d.pca.y);
    const zsAll = filtered.map((d) => d.pca.z);

    // compute cluster-wise traces for clear legend and hover
    const traces: any[] = [];

    // 1) Heatmap surface OR background plane
    if (showHeatmap) {
      const { density, xCenters, yCenters } = computeDensityGrid(xsAll, ysAll, heatmapBins);
      // Build z matrix of zeros (heatmap sits exactly at z=0)
      const zZeros = Array.from({ length: density.length }, () => new Array(density[0].length).fill(0));
      traces.push({
        type: "surface",
        x: xCenters,
        y: yCenters,
        z: zZeros, // same dim as density
        surfacecolor: density, // matrix ny x nx
        colorscale: "Viridis",
        opacity: 0.6,
        showscale: true,
        colorbar: { title: "Mật độ DN" },
        name: "Mật độ DN",
        hoverinfo: "skip"
      });
    } else {
      // plane color for Oxy (subtle background) if heatmap disabled
      const xMin = Math.min(...xsAll);
      const xMax = Math.max(...xsAll);
      const yMin = Math.min(...ysAll);
      const yMax = Math.max(...ysAll);
      const nx = 2, ny = 2;
      const xPlane = [xMin, xMax];
      const yPlane = [yMin, yMax];
      const zPlane = Array.from({ length: ny }, () => new Array(nx).fill(0)); // 2x2 zeros
      const colorMat = Array.from({ length: ny }, () => new Array(nx).fill(0));
      traces.push({
        type: "surface",
        x: xPlane,
        y: yPlane,
        z: zPlane,
        surfacecolor: colorMat,
        colorscale: [[0, "rgba(230,240,255,1)"], [1, "rgba(230,240,255,1)"]],
        opacity: 1.0,
        showscale: false,
        name: "Plane",
        hoverinfo: "skip"
      });
    }

    // 2) Projection markers on z=0, split by cluster (so colors consistent)
    if (showProjection) {
      // Create per-cluster projection traces (small markers, low opacity)
      clusters.forEach((clusterId, idx) => {
        const pts = filtered.filter((d) => d.cluster === clusterId);
        if (pts.length === 0) return;
        traces.push({
          type: "scatter3d",
          mode: "markers",
          x: pts.map((p) => p.pca.x),
          y: pts.map((p) => p.pca.y),
          z: pts.map(() => 0),
          marker: {
            size: 3,
            opacity: 0.35,
            color: colorPalette[idx % colorPalette.length]
          },
          showlegend: false,
          hoverinfo: "skip",
          name: `proj-${clusterId}`
        });
      });
    }

    // 3) Drop lines (single trace with many segments) for performance
    if (showDropLines) {
      // guard to avoid performance issues on huge datasets
      const maxLines = 10000;
      if (filtered.length <= maxLines) {
        const xLines: (number | null)[] = [];
        const yLines: (number | null)[] = [];
        const zLines: (number | null)[] = [];
        for (let i = 0; i < filtered.length; i++) {
          const xi = filtered[i].pca.x;
          const yi = filtered[i].pca.y;
          const zi = filtered[i].pca.z;
          xLines.push(xi, xi, null);
          yLines.push(yi, yi, null);
          zLines.push(0, zi, null);
        }
        traces.push({
          type: "scatter3d",
          mode: "lines",
          x: xLines,
          y: yLines,
          z: zLines,
          line: { color: "rgba(80,80,80,0.08)", width: 1 },
          hoverinfo: "skip",
          showlegend: false,
          name: "Droplines"
        });
      }
    }

    // 4) Scatter3d points per cluster (so legend shows cluster counts)
    clusters.forEach((clusterId, idx) => {
      const pts = filtered.filter((d) => d.cluster === clusterId);
      if (pts.length === 0) return;
      const xCoords = pts.map((p) => p.pca.x);
      const yCoords = pts.map((p) => p.pca.y);
      const zCoords = pts.map((p) => p.pca.z);
      const hoverTexts = pts.map((p) => {
        const enterpriseName = p.info?.name ?? "N/A";
        const sectorId = p.info?.sector_unique_id ?? "N/A";
        const sectorName = p.info?.sector ?? "N/A";
        const taxCode = p.info?.taxcode ?? "N/A";
        const employees = p.info?.employees ?? 0;
        const x = p.pca.x ?? 0;
        const y = p.pca.y ?? 0;
        const size = p.pca.z ?? 0;
        let ht = `<b>${enterpriseName}</b><br>`;
        ht += `MST: ${taxCode}<br>`;
        ht += `Ngành: ${sectorName} (${sectorId})<br>`;
        ht += `Nhân viên: ${Number(employees).toLocaleString()}<br>---<br>`;
        ht += `<b>X:</b> ${x.toFixed(3)}<br>`;
        ht += `<b>Y:</b> ${y.toFixed(3)}<br>`;
        ht += `<b>Z (Quy mô):</b> ${size}`;
        return ht;
      });

      traces.push({
        type: "scatter3d",
        mode: "markers",
        x: xCoords,
        y: yCoords,
        z: zCoords,
        text: hoverTexts,
        hoverinfo: "text",
        name: `Cluster ${clusterId} (${pts.length})`,
        marker: {
          color: colorPalette[idx % colorPalette.length],
          size: 5,
          opacity: 0.9
        },
        visible: true
      });
    });

    // Layout: style scene and axes; ensure Oxy plane visually distinct
    // Replace existing layout object with this
const layout: any = {
  title: {
    text: (() => {
      let title = "BIỂU ĐỒ CÁC DOANH NGHIỆP";
      try {
        if (parameters?.level_value && parameters.level_value.length > 0) {
          const allIndustries = getAllIndustries();
          const selectedIndustries = allIndustries.filter((ind: any) => parameters.level_value.includes(ind.apiCode));
          if (selectedIndustries.length > 0) {
            const highestLevelIndustry = selectedIndustries.reduce((prev: any, cur: any) => (prev.level < cur.level ? prev : cur));
            title += `: (${highestLevelIndustry.apiCode}) ${highestLevelIndustry.name}`;
          }
        }
      } catch (e) { /* ignore */ }
      return title;
    })(),
    font: { size: 16 }
  },

  // --- key changes here: reduce top, increase bottom, autosize ---
  margin: { l: 0, r: 0, t: 40, b: 120 },

  scene: {
    xaxis: {
      title: { text: "PCA-1 (Ngành)", font: { size: 13 } },
      showgrid: true,
      gridcolor: "rgba(0,0,0,0.08)",
      tickfont: { size: 11 },
    },
    yaxis: {
      title: { text: "PCA-2 (Ngành)", font: { size: 13 } },
      showgrid: true,
      gridcolor: "rgba(0,0,0,0.08)",
      tickfont: { size: 11 },
    },
    zaxis: {
      title: { text: "Quy mô DN (đã chuẩn hóa)", font: { size: 13 } },
      showgrid: true,
      gridcolor: "rgba(0,0,0,0.08)",
      tickfont: { size: 11 },
      zeroline: true,
    },

    // Camera: kéo cao/xa/tụt để phần dưới (z gần 0) hiển thị rõ hơn
    camera: { eye: { x: 1.4, y: 1.4, z: 0.9 } },

    // Khi cần, thay aspectmode để điều chỉnh tỉ lệ hiển thị
    aspectmode: "auto"
  },

  legend: {
    x: 1.02,
    xanchor: "left",
    y: 1,
    bgcolor: "rgba(255,255,255,0.9)",
    bordercolor: "rgba(0,0,0,0.12)",
    borderwidth: 1
  },

  paper_bgcolor: "white",
  plot_bgcolor: "white",
  autosize: true
};


    

    const config = {
      responsive: true,
      displayModeBar: false,
      doubleClick: "reset"
    };

    // Plot (replace)
    Plotly.react(plotRef.current!, traces, layout, config).then(() => {
      setPlotReady(true);
    });

    // Set tool dragmode
    const plotDiv = plotRef.current as any;
    if (plotDiv) {
      switch (activeTool) {
        case "pan":
          Plotly.relayout(plotDiv, { "scene.dragmode": "pan" });
          break;
        case "zoom":
          Plotly.relayout(plotDiv, { "scene.dragmode": "zoom" });
          break;
        default:
          Plotly.relayout(plotDiv, { "scene.dragmode": "lasso" });
      }
    }

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [
    processedData,
    selectedClusters,
    clusters,
    colorPalette,
    showHeatmap,
    showProjection,
    showDropLines,
    heatmapBins,
    activeTool,
    parameters
  ]);

  // UI: cluster filter and controls
  const clusterOptions = useMemo(() => {
    if (!results) return [];
    // Prefer results.dataPoints cluster list if available else processedData
    const allClusters = Array.from(new Set((results?.dataPoints ?? processedData).map((d: any) => d.cluster))).filter((c: any) => c !== null && c !== undefined).sort((a: any, b: any) => a - b);
    return allClusters;
  }, [results, processedData]);

  const toggleClusterFilter = (value: string) => {
    if (value === "all") {
      setSelectedClusters([]);
    } else {
      const arr = value.split(",").map((v) => Number(v));
      setSelectedClusters(arr);
    }
  };

  // toolbar controls (Heatmap/Projection/Droplines toggles)
  return (
    <div className="flex-1 flex flex-col bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Cluster Visualization</h2>
            <p className="text-sm text-muted-foreground">Mỗi điểm trên biểu đồ là một doanh nghiệp.</p>

            <div className="text-xs text-muted-foreground mt-2 space-y-1">
              <p>📌 <b>Ox, Oy (Ngành nghề):</b> PCA-2D của embedding 128 chiều của <i>tên ngành</i>.</p>
              <p>📌 <b>Oz (Quy mô DN):</b> chiều cao thể hiện quy mô DN (đã chuẩn hóa).</p>
              <p>📌 <b>Màu sắc:</b> cluster (mỗi màu = một cụm).</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Cluster Filter */}
            <Select
              value={selectedClusters.length === 0 ? "all" : selectedClusters.join(",")}
              onValueChange={(value) => toggleClusterFilter(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter clusters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clusters</SelectItem>
                {clusterOptions.map((c: any) => (
                  <SelectItem key={c} value={String(c)}>Cluster {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-2 mt-3">
          <Button variant={activeTool === "pan" ? "default" : "ghost"} size="sm" onClick={() => setActiveTool("pan")} title="Pan"><Move className="h-4 w-4" /></Button>
          <Button variant={activeTool === "zoom" ? "default" : "ghost"} size="sm" onClick={() => setActiveTool("zoom")} title="Zoom"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant={activeTool === "lasso" ? "default" : "ghost"} size="sm" onClick={() => setActiveTool("lasso")} title="Lasso Select"><Lasso className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => {
            if (plotRef.current) {
              Plotly.relayout(plotRef.current, {
                "scene.xaxis.autorange": true,
                "scene.yaxis.autorange": true,
                "scene.zaxis.autorange": true,
                "scene.camera": { eye: { x: 1.4, y: 1.4, z: 1.1 } }
              });
            }
          }} title="Reset Zoom"><Maximize className="h-4 w-4" /></Button>

          {/* Layer toggles */}
          <div className="flex items-center gap-1 border-l border-border pl-3 ml-3">
            <Button size="sm" variant={showHeatmap ? "default" : "ghost"} onClick={() => setShowHeatmap(!showHeatmap)}>{showHeatmap ? "Heatmap ON" : "Heatmap OFF"}</Button>
            <Button size="sm" variant={showProjection ? "default" : "ghost"} onClick={() => setShowProjection(!showProjection)}>{showProjection ? "Projection ON" : "Projection OFF"}</Button>
            <Button size="sm" variant={showDropLines ? "default" : "ghost"} onClick={() => setShowDropLines(!showDropLines)}>{showDropLines ? "Droplines ON" : "Droplines OFF"}</Button>

            {/* Heatmap bins select */}
            <Select value={String(heatmapBins)} onValueChange={(v) => setHeatmapBins(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 bins</SelectItem>
                <SelectItem value="60">60 bins</SelectItem>
                <SelectItem value="100">100 bins</SelectItem>
              </SelectContent>
            </Select>

            {/* Download */}
            <div className="border-l border-border pl-2 ml-2 flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => { if (plotRef.current) Plotly.downloadImage(plotRef.current, { format: "png", width: 1200, height: 800, filename: "cluster-visualization" }); }} disabled={!plotReady}><Download className="h-4 w-4 mr-1" />PNG</Button>
              <Button variant="outline" size="sm" onClick={() => { if (plotRef.current) Plotly.downloadImage(plotRef.current, { format: "svg", width: 1200, height: 800, filename: "cluster-visualization" }); }} disabled={!plotReady}><FileImage className="h-4 w-4 mr-1" />SVG</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Plot container */}
      <Card className="flex-1 p-4">
    
      <div className="w-full">
        {/* <div ref={plotRef} className="w-full h-[820px]" data-testid="scatter-plot" /> */}
        <div
          ref={plotRef}
          className="w-full h-[calc(100vh-280px)]"
          data-testid="scatter-plot"
        />

        <p className="mt-4 text-sm text-gray-600 text-center">
          Biểu đồ này được tạo bằng PCA (giảm chiều dữ liệu xuống 2D cho Ox/Oy),
          Oz thể hiện <b>quy mô DN</b> (đã chuẩn hóa). Màu sắc là các cụm (cluster),
          heatmap mô tả mật độ DN trên mặt phẳng Oxy.
        </p>
      </div>
    
      </Card>
    </div>
  );
}
