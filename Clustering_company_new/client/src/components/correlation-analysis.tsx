import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useClusteringStore } from '@/lib/clustering-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

interface MatrixData {
  matrix: (number | null)[][];
  headers: string[];
}

interface IndustryCorrelationResult {
  "Tên ngành": string;
  group_correlation_matrices: {
    [groupName: string]: MatrixData;
  };
}

// Helper to safely parse JSON from a response
async function safeJsonParse(response: Response) {
  try {
    return await response.json();
  } catch (e) {
    return null;
  }
}

// Sub-component to render a single correlation matrix
const CorrelationMatrix = ({ matrixData }: { matrixData: MatrixData }) => {
  const { matrix, headers } = matrixData;

  const getColor = (value: number | null) => {
    if (value === null) return 'bg-gray-200';
    const alpha = Math.abs(value);
    return value > 0 ? `rgba(34, 139, 34, ${alpha})` : `rgba(255, 0, 0, ${alpha})`;
  };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full border">
        <TableHeader>
          <TableRow>
            <TableHead className="border sticky left-0 bg-card z-10">Indicator</TableHead>
            {headers.map((header, index) => (
              <TableHead key={index} className="border text-center">{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {headers.map((rowHeader, rowIndex) => (
            <TableRow key={rowIndex}>
              <TableCell className="font-medium border sticky left-0 bg-card z-10">{rowHeader}</TableCell>
              {matrix[rowIndex].map((cell, cellIndex) => (
                <TableCell key={cellIndex} className="border text-center" style={{ backgroundColor: getColor(cell) }}>
                  {cell !== null ? cell.toFixed(2) : 'N/A'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export function CorrelationAnalysis() {
  const [results, setResults] = useState<IndustryCorrelationResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { uploadedData } = useClusteringStore();

  const handleRunAnalysis = async () => {
    if (!uploadedData || uploadedData.length === 0) {
      setError("No data available. Please upload a file first in the 'Clustering Control Panel'.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // Convert the uploaded JSON data to a CSV string
      const headers = Object.keys(uploadedData[0]);
      const csvContent = [
        headers.join(','),
        ...uploadedData.map(row => headers.map(header => row[header]).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], "data.csv", { type: "text/csv" });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://127.0.0.1:5000/api/correlation', {
        method: 'POST',
        body: formData,
      });

      console.log(">>>Response received:", response);

      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        throw new Error(errorData?.error || `Failed with status ${response.status}`);
      }

      const data = await safeJsonParse(response);
      if (!data) {
        throw new Error("Empty response from server (no JSON returned)");
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group Correlation Analysis</CardTitle>
        <CardDescription>
          Calculates correlation matrices for the six main indicator groups based on the uploaded data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRunAnalysis} disabled={isLoading}>
          {isLoading ? 'Running...' : 'Run Analysis'}
        </Button>

        {error && (
           <Alert variant="destructive">
             <Terminal className="h-4 w-4" />
             <AlertTitle>Error</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
        )}

        {results && (
          <ScrollArea className="h-[600px] w-full">
            {results.map((industryResult) => (
              <div key={industryResult["Tên ngành"]} className="mb-4">
                <h3 className="text-lg font-semibold mb-2">{industryResult["Tên ngành"]}</h3>
                <Accordion type="single" collapsible className="w-full">
                  {Object.entries(industryResult.group_correlation_matrices).map(([groupName, matrixData]) => (
                    <AccordionItem value={groupName} key={groupName}>
                      <AccordionTrigger>{groupName}</AccordionTrigger>
                      <AccordionContent>
                        <CorrelationMatrix matrixData={matrixData} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
