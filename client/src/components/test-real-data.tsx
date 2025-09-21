import React, { useEffect } from "react";
import { useClusteringStore } from "@/lib/clustering-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const mockResponse = {
  "best_k": 5,
  "companies": {
    "0100739027": {
      "STD_RTD1": "1.035290955186772",
      "empl_qtty": "5.0",
      "industryCode": "A",
      "industryName": "Trồng cây ăn quả vùng nhiệt đới và cận nhiệt đới",
      "industryPath": "A-1-12-121-1212",
      "label": 0,
      "pca_V": [0.31896481159953943, 0.3584878981786477],
      "sector_unique_id": "1212",
      "size": 1.4368571523727307,
      "taxcode": "0100739027",
      "yearreport": "2017"
    },
    "0106873364": {
      "STD_RTD1": "1.0",
      "empl_qtty": "10.0",
      "industryCode": "A",
      "industryName": "Trồng cây ăn quả khác",
      "industryPath": "A-1-12-121-1219",
      "label": 0,
      "pca_V": [0.2928076963990547, 0.2567654926064739],
      "sector_unique_id": "1219",
      "size": 1.9564410117320343,
      "taxcode": "0106873364",
      "yearreport": "2018"
    },
    "0101234567": {
      "empl_qtty": "15.0",
      "industryCode": "B",
      "industryName": "Khai thác than cứng",
      "label": 1,
      "pca_V": [-1.2, 0.8],
      "sector_unique_id": "0510",
      "size": 2.1,
      "taxcode": "0101234567",
      "yearreport": "2019"
    },
    "0109876543": {
      "empl_qtty": "25.0",
      "industryCode": "C",
      "industryName": "Sản xuất thực phẩm",
      "label": 2,
      "pca_V": [0.5, -1.1],
      "sector_unique_id": "1010",
      "size": 2.8,
      "taxcode": "0109876543",
      "yearreport": "2020"
    }
  },
  "metrics": [
    {
      "calinski_harabasz": 4.324438405216522,
      "counts_by_label": { "0": 4, "1": 4, "2": 2, "3": 4, "4": 1 },
      "davies_bouldin": 0.8729470100573202,
      "inertia": 230.59390277552177,
      "k": 5,
      "silhouette": 0.3617715920644163
    }
  ],
  "n_samples": 4
};

export default function TestWithRealData() {
  const { results } = useClusteringStore();

  const simulateApiResponse = () => {
    console.log("🧪 Simulating API response with real data structure");
    
    // Create fake results object matching expected structure
    const fakeResults = {
      dataPoints: [], // Will be processed from clusterResult
      clusterResult: {
        ...mockResponse,
        lambda: 0.5,
        dataset_id: "test",
        k_candidates: [3, 4, 5, 6, 7],
        metrics_csv: "",
        labels_csv: ""
      },
      metrics: {
        silhouetteScore: mockResponse.metrics[0]?.silhouette || 0.36,
        inertia: mockResponse.metrics[0]?.inertia || 230,
        clusters: Object.entries(mockResponse.companies).map(([taxcode, data]: [string, any]) => ({
          id: data.label,
          size: 1,
          centroid: { x: data.pca_V[0], y: data.pca_V[1] },
          avgDistance: Math.random() * 2
        }))
      },
      projectionImages: {},
      metricImages: {}
    };

    // Simulate setting results using Zustand's setState
    useClusteringStore.setState({
      results: fakeResults
    });
    
    console.log("✅ Mock data set in store:", fakeResults);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Test with Real Data Structure</h2>
        
        <div className="p-2 bg-gray-100 rounded text-sm">
          <p>🔍 Current results: {results ? 'Available' : 'None'}</p>
          {results?.clusterResult && (
            <>
              <p>📊 Companies type: {typeof results.clusterResult.companies}</p>
              <p>🏢 Companies count: {
                typeof results.clusterResult.companies === 'object' 
                  ? Object.keys(results.clusterResult.companies).length 
                  : 'N/A'
              }</p>
              <p>🎯 Best K: {(results.clusterResult as any).best_k}</p>
            </>
          )}
        </div>

        <Button onClick={simulateApiResponse} className="w-full">
          Load Mock Real Data Structure
        </Button>

        {results?.clusterResult && (
          <div className="mt-4 p-2 border rounded">
            <h3 className="font-medium mb-2">Sample Company Data:</h3>
            <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
              {JSON.stringify(
                Object.entries((results.clusterResult as any).companies || {})[0], 
                null, 
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
