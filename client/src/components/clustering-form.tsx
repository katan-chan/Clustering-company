import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useClusteringStore } from "@/lib/clustering-store";
import { clusteringParamsSchema, apiConfigSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

const formSchema = z.object({
  lambda: clusteringParamsSchema.shape.lambda,
  k: z.number().int().min(2).max(20),
  endpoint: apiConfigSchema.shape.endpoint,
  apiKey: apiConfigSchema.shape.apiKey,
});

export default function ClusteringForm() {
  const { parameters, apiConfig, updateParameters, updateApiConfig } = useClusteringStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lambda: parameters.lambda,
      k: Array.isArray(parameters.k) ? parameters.k[0] : parameters.k,
      endpoint: apiConfig.endpoint,
      apiKey: apiConfig.apiKey || "",
    },
  });

  const onParametersSubmit = (data: { lambda: number; k: number }) => {
    updateParameters({
      lambda: data.lambda,
      k: data.k,
    });
  };

  const onApiConfigSubmit = async (data: { endpoint: string; apiKey?: string }) => {
    updateApiConfig({
      endpoint: data.endpoint,
      apiKey: data.apiKey,
    });
    
    // Real connection check using /meta endpoint
    if (data.endpoint) {
      setConnectionStatus("checking");
      try {
        const { clusteringApi } = await import("@/lib/clustering-api");
        await clusteringApi.getMeta({
          endpoint: data.endpoint,
          apiKey: data.apiKey,
        });
        setConnectionStatus("connected");
      } catch (error) {
        setConnectionStatus("disconnected");
        console.error("Connection check failed:", error);
      }
    } else {
      setConnectionStatus("disconnected");
    }
  };

  return (
    <div className="space-y-6">
      {/* Algorithm Parameters */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Algorithm Parameters</h3>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onParametersSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lambda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lambda (λ)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.01"
                      max="10"
                      placeholder="0.5"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      data-testid="input-lambda"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Weight factor for embedding vs info data
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="k"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Clusters (k)</FormLabel>
                  <div className="flex space-x-2">
                    <FormControl>
                      <Input
                        type="number"
                        min="2"
                        max="20"
                        placeholder="6"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="flex-1"
                        data-testid="input-k"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Auto-detect optimal k"
                      data-testid="button-auto-k"
                    >
                      ✨
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Or use multiple values: [3,4,5,6,7,8]
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>

      <Separator />

      {/* API Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">API Configuration</h3>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onApiConfigSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://api.clustering-service.com"
                      {...field}
                      onBlur={field.onBlur}
                      data-testid="input-endpoint"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key (Tùy chọn)</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showApiKey ? "text" : "password"}
                        placeholder="Để trống nếu API không cần key"
                        {...field}
                        onBlur={field.onBlur}
                        className="pr-10"
                        data-testid="input-api-key"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                      data-testid="button-toggle-api-key"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Chỉ cần nhập nếu API clustering yêu cầu xác thực
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {connectionStatus === "connected" ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Connected</span>
                </>
              ) : connectionStatus === "checking" ? (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-sm text-yellow-600">Checking connection...</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  <WifiOff className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Disconnected</span>
                </>
              )}
            </div>
            
            <Button type="submit" className="w-full" data-testid="button-update-config">
              Update Configuration
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
