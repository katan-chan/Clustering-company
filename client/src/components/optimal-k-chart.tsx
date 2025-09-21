import { useClusteringStore } from "@/lib/clustering-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";


// Define a more specific type for the dot's payload
interface KPayload {
  k: number;
  [key: string]: any;
}

interface CustomizedDotProps {
  cx?: number;
  cy?: number;
  stroke?: string;
  payload?: KPayload;
  value?: any;
  k_best?: number;
}

// Custom dot for highlighting the k_best point
const CustomizedDot = (props: CustomizedDotProps) => {
  const { cx, cy, payload, k_best } = props;

  if (payload && payload.k === k_best) {
    return (
      <svg x={(cx ?? 0) - 8} y={(cy ?? 0) - 8} width={16} height={16} fill="red" viewBox="0 0 1024 1024">
        <path d="M512 960C264.58 960 64 759.42 64 512S264.58 64 512 64s448 200.58 448 448-200.58 448-448 448z" />
      </svg>
    );
  }

  return null;
};

// Custom tooltip to show all 3 metrics
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-2 bg-background border border-border rounded-lg shadow-lg">
        <p className="font-bold text-foreground">{`k = ${label}`}</p>
        <p style={{ color: '#8884d8' }}>{`Silhouette: ${data.silhouette_score.toFixed(3)}`}</p>
        <p style={{ color: '#82ca9d' }}>{`DBI: ${data.dbi_score.toFixed(3)}`}</p>
        <p style={{ color: '#ffc658' }}>{`CHI: ${data.chi_score.toFixed(0)}`}</p>
      </div>
    );
  }

  return null;
};

export default function OptimalKChart() {
  const { results } = useClusteringStore();

  // Extract the evaluation metrics from the results
  const chartData = results?.clusterResult?.evaluation_metrics;
  const kBest = results?.clusterResult?.best_k;

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card">
        <div className="text-center text-muted-foreground">
          <div className="mb-3">📈</div>
          <p>No optimal k-value data to visualize</p>
          <p className="text-sm mt-2">Run clustering to see the evaluation metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-card">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Optimal K-Value Evaluation</h2>
      </div>
      <Card className="flex-1 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="k" label={{ value: 'Number of Clusters (k)', position: 'insideBottom', offset: -5 }} />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="silhouette_score"
              stroke="#8884d8"
              strokeWidth={2}
              name="Silhouette Score"
              dot={<CustomizedDot k_best={kBest} />}
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="dbi_score"
              stroke="#82ca9d"
              strokeWidth={2}
              name="Davies-Bouldin Index"
              dot={<CustomizedDot k_best={kBest} />}
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="chi_score"
              stroke="#ffc658"
              strokeWidth={2}
              name="Calinski-Harabasz Index"
              dot={<CustomizedDot k_best={kBest} />}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
