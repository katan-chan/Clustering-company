/**
 * Mapping của các nhóm chỉ số tài chính doanh nghiệp
 * Được sử dụng để nhóm các indicators theo chủ đề phân tích
 */

export interface IndicatorGroup {
  key: string;
  name: string;
  description: string;
  indicators: string[];
}

/**
 * Định nghĩa các nhóm chỉ số chính
 * Tuân theo chuẩn phân loại tài chính doanh nghiệp
 */
export const FIELD_MAPPING: Record<string, string[]> = {
  "Leverage_Debt": [  // Đòn bẩy và Khả năng trả nợ
    "STD_RTD146",  // FFO / Nợ vay
    "STD_RTD71",   // Hệ số Nợ vay/Vốn CSH - PTC
    "STD_RTD96",   // Tổng nợ vay thuần/EBITDA
    "STD_RTD97",   // EBITDA/Chi phí lãi vay
    "STD_RTD98",   // CFO/Tổng nợ vay
    "STD_RTD99",   // Lợi nhuận hoạt động/ Lãi vay
    "STD_RTD1",    // Tổng tài sản/Vốn chủ sở hữu
    "STD_RTD72",   // Hệ số EBIT/Nợ vay
    "STD_RTD148"   // Tổng nợ vay/EBITDA
  ],
  
  "Efficiency": [  // Hiệu quả hoạt động
    "STD_RTD74",  // Vòng quay khoản phải thu
    "STD_RTD76",  // Vòng quay vốn lưu động
    "STD_RTD77",  // EBITDA/Tổng Tài sản
    "STD_RTD78",  // Vòng quay tổng tài sản
    "STD_RTD81",  // Chu kỳ tiền mặt
    "STD_RTD64",  // Vòng quay khoản phải trả
    "STD_RTD75"   // Vòng quay hàng tồn kho
  ],
  
  "Scale": [  // Quy mô
    "STD_RTD13",   // Tổng tài sản (TTS)
    "STD_RTD14",   // Vốn chủ sở hữu (Vốn CSH)
    "STD_RTD31",   // Doanh thu hoạt động TTM
    "empl_qtty"    // Số lượng nhân viên
  ],
  
  "Profitability": [  // Khả Năng Sinh Lời
    "STD_RTD26",  // Biên lợi nhuận trước lãi vay, thuế và khấu hao
    "STD_RTD8",   // ROA
    "STD_RTD82",  // Tỷ suất sinh lời trên vốn kinh doanh (ROCE)
    "STD_RTD83",  // Biên lợi nhuận trước lãi vay và thuế
    "STD_RTD84",  // Biên lợi nhuận hoạt động
    "STD_RTD85",  // Biên lợi nhuận gộp
    "STD_RTD86",  // Biên LNST
    "STD_RTD9"    // ROE
  ],
  
  "Growth": [  // Khả Năng Tăng Trưởng
    "STD_RTD11",  // Lợi nhuận sau thuế (YoY)
    "STD_RTD28",  // Doanh thu TTM (YoY)
    "STD_RTD87",  // EBIT TTM (YoY)
    "STD_RTD88",  // Tăng trưởng tài sản
    "STD_RTD89"   // Tăng trưởng vốn chủ sở hữu
  ],
  
  "Liquidity": [  // Khả Năng Thanh Khoản
    "STD_RTD118", // Thanh khoản - Dòng tiền
    "STD_RTD92",  // Chỉ số thanh toán ngắn hạn
    "STD_RTD93",  // Chỉ số thanh toán nhanh
    "STD_RTD94",  // Chỉ số thanh toán tức thời
    "STD_RTD95",  // CFO/Nợ ngắn hạn
    "STD_RTD147"  // (FFO + Cash) / Nợ vay ngắn hạn
  ]
};

/**
 * Các chỉ số trung gian (không tham gia chấm điểm trực tiếp)
 */
export const INTERMEDIATE_FIELDS = [
  "STD_RTD60",  // EBITDA
  "STD_RTD61"   // Tổng nợ vay thuần
];

/**
 * Metadata cho các nhóm chỉ số với mô tả chi tiết
 */
export const INDICATOR_GROUPS: IndicatorGroup[] = [
  {
    key: "Leverage_Debt",
    name: "Đòn bẩy và Khả năng trả nợ",
    description: "Đánh giá khả năng quản lý nợ và rủi ro tài chính của doanh nghiệp",
    indicators: FIELD_MAPPING.Leverage_Debt
  },
  {
    key: "Efficiency", 
    name: "Hiệu quả hoạt động",
    description: "Đo lường hiệu quả sử dụng tài sản và quản lý vốn lưu động",
    indicators: FIELD_MAPPING.Efficiency
  },
  {
    key: "Scale",
    name: "Quy mô doanh nghiệp", 
    description: "Đánh giá quy mô tài sản, vốn và hoạt động kinh doanh",
    indicators: FIELD_MAPPING.Scale
  },
  {
    key: "Profitability",
    name: "Khả năng sinh lời",
    description: "Đo lường hiệu quả tạo ra lợi nhuận từ hoạt động kinh doanh", 
    indicators: FIELD_MAPPING.Profitability
  },
  {
    key: "Growth",
    name: "Khả năng tăng trưởng",
    description: "Đánh giá xu hướng phát triển của doanh nghiệp theo thời gian",
    indicators: FIELD_MAPPING.Growth
  },
  {
    key: "Liquidity",
    name: "Khả năng thanh khoản", 
    description: "Đo lường khả năng thanh toán nghĩa vụ tài chính ngắn hạn",
    indicators: FIELD_MAPPING.Liquidity
  }
];

/**
 * Utility function để lấy tên nhóm từ key
 */
export const getGroupName = (groupKey: string): string => {
  const group = INDICATOR_GROUPS.find(g => g.key === groupKey);
  return group?.name || groupKey;
};

/**
 * Utility function để lấy mô tả nhóm từ key
 */
export const getGroupDescription = (groupKey: string): string => {
  const group = INDICATOR_GROUPS.find(g => g.key === groupKey);
  return group?.description || "";
};

/**
 * Utility function để validate group key
 */
export const isValidGroupKey = (groupKey: string): boolean => {
  return INDICATOR_GROUPS.some(g => g.key === groupKey);
};