/**
 * IndicatorGroupSelector Component
 * 
 * Tính năng: Cho phép người dùng chọn nhóm chỉ số định sẵn thay vì phải chọn từng indicator riêng lẻ
 * 
 * Giải thích thiết kế:
 * 1. Single Responsibility Principle: Component chỉ chịu trách nhiệm về việc select nhóm chỉ số
 * 2. Open/Closed Principle: Dễ dàng extend với các nhóm chỉ số mới thông qua INDICATOR_GROUPS
 * 3. Dependency Inversion: Phụ thuộc vào interface/props thay vì concrete implementation
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Info, Users } from "lucide-react";
import { INDICATOR_GROUPS, type IndicatorGroup } from "@/constants/field-mapping";

interface IndicatorGroupSelectorProps {
  /** Danh sách indicators hiện tại đã được chọn */
  selectedIndicators: string[];
  
  /** Danh sách nhóm indicators hiện tại */
  indicatorGroups: string[][];
  
  /** Callback khi chọn nhóm chỉ số */
  onGroupSelect: (groupIndicators: string[]) => void;
  
  /** Callback khi xóa nhóm chỉ số */
  onGroupRemove: (groupIndex: number) => void;
  
  /** Loading state */
  loading?: boolean;
  
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Component cho phép chọn nhóm chỉ số định sẵn
 * 
 * Workflow:
 * 1. Hiển thị dropdown với các nhóm chỉ số có sẵn từ FIELD_MAPPING
 * 2. Khi chọn nhóm, tự động add toàn bộ indicators trong nhóm đó
 * 3. Hiển thị preview các indicators sẽ được thêm
 * 4. Cho phép xem mô tả của từng nhóm
 */
export default function IndicatorGroupSelector({
  selectedIndicators,
  indicatorGroups,
  onGroupSelect,
  onGroupRemove,
  loading = false,
  disabled = false
}: IndicatorGroupSelectorProps): JSX.Element {
  const [selectedGroupKey, setSelectedGroupKey] = React.useState<string>("");
  
  /**
   * Lấy thông tin nhóm chỉ số đã chọn
   */
  const selectedGroup: IndicatorGroup | undefined = React.useMemo(() => {
    if (!selectedGroupKey) return undefined;
    return INDICATOR_GROUPS.find(group => group.key === selectedGroupKey);
  }, [selectedGroupKey]);
  
  /**
   * Kiểm tra các indicators trong nhóm đã được chọn chưa
   */
  const getIndicatorStatus = (indicators: string[]) => {
    const alreadySelected = indicators.filter(indicator => 
      selectedIndicators.includes(indicator)
    );
    const newIndicators = indicators.filter(indicator => 
      !selectedIndicators.includes(indicator)
    );
    
    return { alreadySelected, newIndicators, totalCount: indicators.length };
  };
  
  /**
   * Handle thêm nhóm chỉ số
   * Tuân theo Principle of Least Surprise: chỉ thêm indicators chưa được chọn
   */
  const handleAddGroup = () => {
    if (!selectedGroup) return;
    
    const { newIndicators } = getIndicatorStatus(selectedGroup.indicators);
    
    if (newIndicators.length > 0) {
      onGroupSelect(newIndicators);
      setSelectedGroupKey(""); // Reset selection
    }
  };
  
  /**
   * Render preview indicators sẽ được thêm
   */
  const renderIndicatorPreview = () => {
    if (!selectedGroup) return null;
    
    const { alreadySelected, newIndicators } = getIndicatorStatus(selectedGroup.indicators);
    
    return (
      <div className="mt-3 p-3 bg-muted/50 rounded-md">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Indicators trong nhóm:</span>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedGroup.indicators.map(indicator => {
            const isAlreadySelected = alreadySelected.includes(indicator);
            return (
              <Badge
                key={indicator}
                variant={isAlreadySelected ? "secondary" : "default"}
                className={`text-xs ${
                  isAlreadySelected ? "opacity-50" : ""
                }`}
              >
                {indicator}
                {isAlreadySelected && " ✓"}
              </Badge>
            );
          })}
        </div>
        
        <div className="text-xs text-muted-foreground">
          <div>• Tổng: {selectedGroup.indicators.length} indicators</div>
          <div>• Đã chọn: {alreadySelected.length} indicators</div>
          <div>• Sẽ thêm: <span className="font-medium text-green-600">{newIndicators.length} indicators</span></div>
        </div>
      </div>
    );
  };
  
  /**
   * Render danh sách nhóm hiện tại
   */
  const renderCurrentGroups = () => {
    if (indicatorGroups.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Chưa có nhóm chỉ số nào</p>
          <p className="text-xs">Chọn nhóm từ dropdown ở trên</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {indicatorGroups.map((group, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-accent/20 rounded-md border"
          >
            <div className="flex-1">
              <div className="flex flex-wrap gap-1 mb-1">
                {group.map(indicator => (
                  <Badge key={indicator} variant="outline" className="text-xs">
                    {indicator}
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Nhóm {index + 1} • {group.length} indicators
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onGroupRemove(index)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={loading || disabled}
            >
              Xóa
            </Button>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Nhóm Chỉ Số Định Sẵn
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Chọn nhóm chỉ số theo chủ đề phân tích thay vì chọn từng chỉ số riêng lẻ
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Group Selection */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select
              value={selectedGroupKey}
              onValueChange={setSelectedGroupKey}
              disabled={loading || disabled}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Chọn nhóm chỉ số..." />
              </SelectTrigger>
              <SelectContent>
                {INDICATOR_GROUPS.map(group => (
                  <SelectItem key={group.key} value={group.key}>
                    <div className="flex flex-col">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.indicators.length} chỉ số
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleAddGroup}
              disabled={!selectedGroup || loading || disabled}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Thêm nhóm
            </Button>
          </div>
          
          {/* Group Description */}
          {selectedGroup && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-blue-900">{selectedGroup.name}</div>
                <div className="text-blue-700 mt-1">{selectedGroup.description}</div>
              </div>
            </div>
          )}
          
          {/* Indicator Preview */}
          {renderIndicatorPreview()}
        </div>
        
        <Separator />
        
        {/* Current Groups */}
        <div>
          <h4 className="text-sm font-medium mb-3">Nhóm chỉ số hiện tại</h4>
          {renderCurrentGroups()}
        </div>
      </CardContent>
    </Card>
  );
}