import { useEffect } from "react";
import { useClusteringStore } from "@/lib/clustering-store";
import FileUploadZone from "@/components/file-upload-zone";
import ClusteringForm from "@/components/clustering-form";
import ScatterPlot from "@/components/scatter-plot";
import ResultsPanel from "@/components/results-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ClusteringPage() {
  const {
    embeddingsFile,
    infoFile,
    processing,
    progress,
    error,
    results,
    validationStatus,
    runClustering,
    clearError,
  } = useClusteringStore();

  const canRunClustering = !processing;

  useEffect(() => {
    document.title = "Enterprise Clustering Analytics Platform";
  }, []);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Left Sidebar - Control Panel */}
      <div className="w-80 min-w-[280px] max-w-[400px] lg:w-80 xl:w-96 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Clustering Control Panel
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload data files and configure clustering parameters
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground mb-4">Data Files (Tùy chọn)</h3>
            
            <FileUploadZone
              type="embeddings"
              title="Embeddings File"
              description="CSV or TXT format"
              icon="cloud-upload"
              data-testid="upload-embeddings"
            />
            
            <FileUploadZone
              type="info"
              title="Info File"
              description="CSV or TXT format"
              icon="database"
              data-testid="upload-info"
            />

            {/* Validation Status */}
            {validationStatus && (
              <Card className={`p-3 ${validationStatus.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center">
                  {validationStatus.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                  )}
                  <span className={`text-sm ${validationStatus.valid ? 'text-green-800' : 'text-red-800'}`}>
                    {validationStatus.message}
                  </span>
                </div>
                {validationStatus.valid && validationStatus.details && (
                  <div className="mt-2 text-xs text-green-700 space-y-1">
                    {validationStatus.details.map((detail, index) => (
                      <div key={index}>• {detail}</div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          <Separator />

          {/* Clustering Parameters */}
          <ClusteringForm />

          <Separator />

          {/* Run Clustering */}
          <div className="space-y-4">
            <Button
              onClick={runClustering}
              disabled={!canRunClustering}
              className="w-full bg-accent hover:bg-accent/90 text-white font-medium py-3"
              data-testid="button-run-clustering"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Run Clustering Analysis"
              )}
            </Button>

            {/* Progress Indicator */}
            {processing && (
              <Card className="p-3 bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">Processing...</span>
                  <span className="text-sm text-blue-600">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="mb-2" />
                <div className="text-xs text-blue-700 space-y-1" data-testid="progress-log">
                  <div className="flex items-center">
                    {progress > 20 ? (
                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    )}
                    Files processed
                  </div>
                  <div className="flex items-center">
                    {progress > 60 ? (
                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                    ) : progress > 20 ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <div className="h-3 w-3 mr-1" />
                    )}
                    PCA computation completed
                  </div>
                  <div className="flex items-center">
                    {progress > 90 ? (
                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                    ) : progress > 60 ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <div className="h-3 w-3 mr-1" />
                    )}
                    Running clustering API...
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Export Controls */}
          {results && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Export Options</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" data-testid="export-csv">
                  CSV
                </Button>
                <Button variant="outline" size="sm" data-testid="export-json">
                  JSON
                </Button>
                <Button variant="outline" size="sm" data-testid="export-png">
                  PNG
                </Button>
                <Button variant="outline" size="sm" data-testid="export-svg">
                  SVG
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Visualization */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-foreground">
                PCA 2D Clustering Visualization
              </h2>
              {results && (
                <div className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground" data-testid="data-points-count">
                  {results.dataPoints?.length || 0} data points
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 p-6">
          <ScatterPlot />
        </div>
      </div>

      {/* Right Panel - Results */}
      <ResultsPanel />

      {/* Error Notification */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md" data-testid="error-notification">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800">Processing Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="text-red-400 hover:text-red-600 p-1"
              data-testid="button-dismiss-error"
            >
              ×
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
