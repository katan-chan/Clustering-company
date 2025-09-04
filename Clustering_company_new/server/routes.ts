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
      if (typeof lambda !== 'number' || lambda <= 0) {
        return res.status(400).json({ error: "lambda must be a positive number" });
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

  const httpServer = createServer(app);
  return httpServer;
}
