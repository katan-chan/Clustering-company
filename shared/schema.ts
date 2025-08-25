import { z } from "zod";

// File upload schemas
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  type: z.enum(['embeddings', 'info']),
});

export const fileMetadataSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  delimiter: z.string(),
  hasHeader: z.boolean(),
  columnCount: z.number(),
  rowCount: z.number(),
  columns: z.array(z.string()),
  numericColumns: z.array(z.string()),
  preview: z.array(z.record(z.string(), z.any())),
});

// Clustering parameters
export const clusteringParamsSchema = z.object({
  lambda: z.number().min(0.01).max(10),
  k: z.union([
    z.number().int().min(2).max(20),
    z.array(z.number().int().min(2).max(20))
  ]),
});

// API configuration
export const apiConfigSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(1).optional(),
});

// Data processing schemas
export const dataPointSchema = z.object({
  id: z.string(),
  embedding: z.array(z.number()),
  info: z.record(z.string(), z.union([z.string(), z.number()])),
  pca: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  cluster: z.number().optional(),
});

export const clusterResultSchema = z.object({
  dataset_id: z.string(),
  lambda: z.number(),
  k_candidates: z.array(z.number()),
  best_k: z.number(),
  metrics_csv: z.string(),
  metric_plots: z.object({
    calinski_harabasz: z.string().optional(),
    davies_bouldin: z.string().optional(),
    silhouette: z.string().optional(),
  }).optional(),
  labels_csv: z.string(),
  projection_plots: z.object({
    pca: z.string().optional(),
    tsne: z.string().optional(),
    umap: z.string().optional(),
  }).optional(),
});

export const clusterMetricsSchema = z.object({
  silhouetteScore: z.number(),
  inertia: z.number(),
  clusters: z.array(z.object({
    id: z.number(),
    size: z.number(),
    centroid: z.object({
      x: z.number(),
      y: z.number(),
    }),
    avgDistance: z.number(),
  })),
});

// Export types
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
export type ClusteringParams = z.infer<typeof clusteringParamsSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type DataPoint = z.infer<typeof dataPointSchema>;
export type ClusterResult = z.infer<typeof clusterResultSchema>;
export type ClusterMetrics = z.infer<typeof clusterMetricsSchema>;

export interface ClusteringResults {
  dataPoints: DataPoint[];
  clusterResult: ClusterResult | null;
  metrics: ClusterMetrics;
  projectionImages: Record<string, string>;
  metricImages: Record<string, string>;
}

// User schemas
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export const insertUserSchema = userSchema.omit({ id: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
