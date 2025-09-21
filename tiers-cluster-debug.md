# API Endpoint Issues: /tiers/cluster

## 🚨 Current Error
```
Error in tiers_cluster: Required columns not found (indicator/cluster_label)
```

## 🔍 Analysis

### Problem Source
The error indicates that the backend API is expecting different column/parameter names than what the frontend is sending.

### Expected vs Actual Parameters

**Frontend currently sends:**
```json
{
  "sector": "A",
  "group_label": 1,
  "indicator": "STD_RTD13"
}
```

**Backend apparently expects:**
```json
{
  "sector": "A", 
  "cluster_label": 1,  // ← NOT group_label
  "indicator": "STD_RTD13"
}
```

## 📍 Files Involved

### Frontend API Implementation
- **File**: `client/src/lib/rating-api.ts`
- **Method**: `getTiers()`
- **Current endpoint**: `POST /tiers/cluster`

### Mock Server (Not Real Backend)
- **File**: `server/routes.ts` (lines 146-180)
- **Note**: This is just mock data, not the real API causing the error

### Real Backend Location
- **Unknown**: The actual Flask/Python backend that returns the error is not in this codebase
- **Evidence**: Error message format suggests Python backend
- **Missing**: `app.py` only has basic Flask setup, no actual endpoints

## 🔧 Implemented Fixes

### 1. Enhanced Request Payload
```typescript
// In rating-api.ts
const requestPayload = {
  ...request,
  cluster_label: request.group_label, // Add alternative field name
};
```

### 2. API Testing Function
Added `testTiersApi()` function that tests multiple parameter formats:
- `group_label` only
- `cluster_label` only  
- Both parameters

### 3. Interface Updates
```typescript
interface TierRequest {
  sector: string;
  group_label: number;
  indicator: string;
  cluster_label?: number; // Alternative for backend compatibility
}
```

## 🧪 Testing Workflow

1. **Connect to API** (enter endpoint URL)
2. **Click "Test Tiers API"** button
3. **Check browser console** for detailed test results
4. **Try different parameter formats** automatically

The test will try 3 different payload formats and report which one works.

## 🎯 Next Steps

### If Backend Expects `cluster_label`:
- Backend team should confirm parameter naming
- Update API documentation
- Consider accepting both names for compatibility

### If Backend Expects Different Structure:
- Get exact API specification from backend team
- Update frontend interfaces accordingly
- Add proper error handling

### Missing Backend Code:
- Locate the actual Python backend implementation
- Check if it's running on a different service/port
- Verify the real endpoint structure

## 📋 Debug Commands

```bash
# Find actual backend implementation
grep -r "tiers_cluster" . 
grep -r "cluster_label" .
grep -r "Required columns not found" .

# Check if there's external API service
curl -X POST [API_ENDPOINT]/tiers/cluster \
  -H "Content-Type: application/json" \
  -d '{"sector":"A","group_label":1,"indicator":"STD_RTD13"}'

# Test alternative format
curl -X POST [API_ENDPOINT]/tiers/cluster \
  -H "Content-Type: application/json" \
  -d '{"sector":"A","cluster_label":1,"indicator":"STD_RTD13"}'
```

## 🚀 Resolution Status

- ✅ **Frontend**: Enhanced to send both parameter names
- ✅ **Testing**: Added comprehensive API testing
- ❓ **Backend**: Need to locate real implementation
- ❓ **Documentation**: Need official API specification

The frontend now handles both parameter naming conventions and provides detailed testing tools to identify the exact requirements.