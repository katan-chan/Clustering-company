import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import path from "path";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Correlation Module API route
  app.post("/api/correlation/calculate", (req, res) => {
    const pythonProcess = spawn("python", [path.join(__dirname, "..", "correlation_module.py")]);

    let dataToSend = "";
    pythonProcess.stdout.on("data", (data) => {
      dataToSend += data.toString();
    });

    let errorToSend = "";
    pythonProcess.stderr.on("data", (data) => {
      errorToSend += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Correlation script exited with code ${code}: ${errorToSend}`);
        return res.status(500).json({ error: "Failed to execute correlation script", details: errorToSend });
      }
      try {
        const result = JSON.parse(dataToSend);
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: "Failed to parse python script output." });
      }
    });

    // Write the request body to the script's stdin
    pythonProcess.stdin.write(JSON.stringify(req.body));
    pythonProcess.stdin.end();
  });
  // Clustering API proxy routes
  app.get("/api/clustering/meta", async (req, res) => {
    try {
      // Mock clustering service metadata
      const meta = {
        message: "KMeans clustering service",
        defaults: { 
          lambda: 0.5, 
          k_list: [3, 4, 5, 6, 7, 8] 
        },
        files: {
          "vector_ratio.csv": "./data/vector_ratio.csv",
          "vector_ratio.meta.json": "./data/vector_ratio.meta.json"
        },
        outputs_dir: "/abs/path/to/outputs"
      };
      
      res.json(meta);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clustering service metadata" });
    }
  });

  app.post("/api/clustering/run", async (req, res) => {
    try {
      const { lambda, k_list } = req.body;

      // Validate request
      if (typeof lambda !== 'number') {
        return res.status(400).json({ error: "Lambda must be a number" });
      }

      if (!Array.isArray(k_list) || k_list.some(k => typeof k !== 'number' || k < 2)) {
        return res.status(400).json({ error: "k_list must be an array of integers >= 2" });
      }

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock clustering result
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const best_k = k_list[Math.floor(k_list.length / 2)]; // Pick middle k as "best"
      
      const result = {
        lambda,
        k_candidates: k_list,
        best_k,
        metrics_csv: `/files/metrics/${timestamp}/metrics.csv`,
        metric_plots: {
          elbow: `/files/metrics/${timestamp}/elbow.png`,
          silhouette: `/files/metrics/${timestamp}/silhouette.png`
        },
        labels_csv: `/files/labels/${timestamp}/labels_k${best_k}.csv`,
        projection_plots: {
          pca2d: `/files/projections/${timestamp}/pca2d_k${best_k}.png`,
          tsne2d: null
        }
      };

      res.json(result);
    } catch (error) {
      console.error("Clustering error:", error);
      res.status(500).json({ error: "Internal clustering service error" });
    }
  });

  // File download proxy (for accessing clustering results)
  app.get("/api/files/*", async (req, res) => {
    try {
      const filePath = (req.params as { 0: string })[0];
      
      // In a real implementation, this would proxy to the actual clustering service
      // For now, return appropriate mock responses based on file type
      
      if (filePath.endsWith('.csv')) {
        // Mock CSV data
        if (filePath.includes('labels')) {
          const labels = Array.from({ length: 1000 }, (_, i) => `${i},${(i % 6) + 1}`).join('\n');
          res.setHeader('Content-Type', 'text/csv');
          res.send(`id,cluster\n${labels}`);
        } else if (filePath.includes('metrics')) {
          const metrics = `k,inertia,silhouette_score\n${[3,4,5,6,7,8].map(k => 
            `${k},${Math.random() * 1000},${Math.random()}`
          ).join('\n')}`;
          res.setHeader('Content-Type', 'text/csv');
          res.send(metrics);
        } else {
          res.status(404).json({ error: "File not found" });
        }
      } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg')) {
        // Return a small placeholder image
        res.setHeader('Content-Type', 'image/png');
        res.status(404).json({ error: "Image file not implemented in mock" });
      } else {
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error("File download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Company Rating API endpoints
  app.get("/api/indicator", async (req, res) => {
    try {
      // Mock indicators list - in real implementation this would come from database
      const indicators = [
        { 
          id: "STD_RTD146", 
          name: "Chỉ số tài chính 146", 
          description: "Chỉ số đánh giá tài chính doanh nghiệp",
          category: "financial"
        },
        { 
          id: "STD_RTD1", 
          name: "Chỉ số hoạt động 1", 
          description: "Chỉ số đánh giá hiệu quả hoạt động",
          category: "operational"
        },
        { 
          id: "STD_RTD71", 
          name: "Chỉ số rủi ro 71", 
          description: "Chỉ số đánh giá mức độ rủi ro",
          category: "risk"
        },
        { 
          id: "STD_RTD64", 
          name: "Chỉ số thanh khoản 64", 
          description: "Chỉ số đánh giá khả năng thanh khoản",
          category: "liquidity"
        }
      ];
      
      res.json(indicators);
    } catch (error) {
      console.error("Failed to get indicators:", error);
      res.status(500).json({ error: "Failed to retrieve indicators" });
    }
  });

  app.post("/api/tiers/cluster", async (req, res) => {
    try {
      const { sector, group_label, indicator } = req.body;

      // Validate request
      if (!sector || group_label === undefined || !indicator) {
        return res.status(400).json({ 
          error: "Missing required parameters: sector, group_label, and indicator" 
        });
      }

      // Mock tiers data - in real implementation this would come from clustering service
      const tiersData = {
        group_label: group_label,
        indicator: indicator,
        method: { 
          label: "kmeans", 
          mode: Math.random() > 0.5 ? "high_good" : "low_good" 
        },
        sector: sector,
        tiers: [
          { tier: "T1", range: [84.8, "inf"], count: Math.floor(Math.random() * 10) + 1 },
          { tier: "T2", range: [70.5, 84.8], count: Math.floor(Math.random() * 20) + 5 },
          { tier: "T3", range: [60.2, 70.5], count: Math.floor(Math.random() * 30) + 10 },
          { tier: "T4", range: [50.8, 60.2], count: Math.floor(Math.random() * 25) + 8 },
          { tier: "T5", range: [40.1, 50.8], count: Math.floor(Math.random() * 20) + 5 },
          { tier: "T6", range: [30.5, 40.1], count: Math.floor(Math.random() * 15) + 3 },
          { tier: "T7", range: [20.0, 30.5], count: Math.floor(Math.random() * 10) + 2 },
          { tier: "T8", range: [0, 20.0], count: Math.floor(Math.random() * 5) + 1 }
        ]
      };
      
      res.json(tiersData);
    } catch (error) {
      console.error("Failed to get tiers data:", error);
      res.status(500).json({ error: "Failed to retrieve tiers data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
