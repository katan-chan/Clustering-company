# Tiering System Instruction Guide

## Tổng quan

Hệ thống Tiering được thiết kế để phân loại doanh nghiệp thành các tier (T1-T8) dựa trên các chỉ số tài chính. Hệ thống bao gồm:

- **Backend Services**: `tiers.py`, `scorer.py`, `persistent_cache.py`
- **API Endpoints**: `/tiers/all`, `/tiers/cluster`, `/score`
- **Utilities**: `preprocess.py`, `io.py`, `boundaries.py`
- **Clustering Strategies**: `kmeans.py`, `dbscan.py`, `meanshift.py`

## Kiến trúc hệ thống

```
src/core/tiering/
├── services/
│   ├── tiers.py          # Core tiering logic
│   └── scorer.py         # Company scoring logic
├── utils/
│   ├── preprocess.py     # Data preprocessing
│   ├── io.py            # File I/O operations
│   ├── boundaries.py    # Tier boundary computation
│   └── persistent_cache.py # Data caching
└── strategies/
    ├── interface_cluster.py # Clustering interface
    ├── kmeans.py         # K-Means implementation
    ├── dbscan.py         # DBSCAN implementation
    ├── meanshift.py      # MeanShift implementation
    └── cluster.py       # Strategy pattern context
```

## Backend Services

### 1. tiers.py - Core Tiering Service

**Chức năng chính:**
- Tính tiers cho toàn bộ sectors hoặc sector cụ thể
- Tạo synthetic indicators từ multiple features
- Cache kết quả để tối ưu performance

**Các hàm chính:**

#### `compute_tiers_all(indicators, weights=None, k=8, algorithm="kmeans")`
Tính tiers cho toàn bộ dữ liệu từ sectors A-S.

**Parameters:**
- `indicators`: List[str] - Danh sách indicators
- `weights`: Optional[List[float]] - Trọng số cho từng indicator
- `k`: int - Số clusters (default: 8)
- `algorithm`: str - Thuật toán clustering ("kmeans", "dbscan", "meanshift")

**Returns:**
```python
{
    "tier_labels": ["T1", "T2", ..., "T8"],
    "boundaries": [("-inf", 0.15), (0.15, 0.25), ...],
    "result_df": pd.DataFrame,
    "cache_file": "path/to/cache.csv"
}
```

#### `compute_tiers_sector(sector, indicators, weights=None, cluster_label=None, k=8, algorithm="kmeans")`
Tính tiers cho sector cụ thể.

**Parameters:**
- `sector`: str - Mã sector (A-S)
- `indicators`: List[str] - Danh sách indicators
- `weights`: Optional[List[float]] - Trọng số
- `cluster_label`: Optional[int] - Lọc theo cluster
- `k`: int - Số clusters
- `algorithm`: str - Thuật toán clustering

#### `load_data(sector=None, cluster_label=None, indicators=None)`
Load dữ liệu từ persistent cache.

#### `compute(values, values_normalized, indicator_name, k=8, mode="high_good", algorithm="kmeans", scaling_params_file=None)`
Core computation logic cho tiering.

### 2. scorer.py - Company Scoring Service

**Chức năng chính:**
- Chuyển đổi feature values thành tier labels
- Hỗ trợ multiple input formats
- Chỉ trả về companies có scores khác null

**Hàm chính:**

#### `score_companies(companies)`
Score danh sách companies.

**Parameters:**
- `companies`: List[Dict] - Danh sách companies với features

**Returns:**
```python
[
    {
        "taxcode": "0100100008",
        "sector": "G",
        "cluster_label": 0,
        "scores": [
            {"indicator": "STD_RTD71", "tier": "T3"},
            {"indicator": "empl_qtty", "tier": "T1"}
        ]
    }
]
```

### 3. persistent_cache.py - Data Caching

**Chức năng chính:**
- Cache preprocessed data để tránh tính toán lại
- Lazy loading khi cần thiết
- Metadata tracking cho cache management

**Class chính:**

#### `PersistentCache`
```python
cache = PersistentCache()

# Get cached data
df, outliers_df = cache.get(sector="A")

# Set cache
cache.set(df, sector="A", ...)
```

## Data Preprocessing

### preprocess.py

**Các hàm chính:**

#### `preprocess(df, features=None, years=None, null_method="skip", outlier_method="iqr", outlier_percentile=5.0, normalize_method="minmax", save_outliers=True, outliers_file=None, save_scaling_params=False, scaling_params_file=None)`

**Parameters:**
- `df`: pd.DataFrame - Input data
- `features`: Optional[List[str]] - Features to process (default: all quantitative)
- `years`: Optional[List[int]] - Filter by years
- `null_method`: str - Null handling ("skip", "median", "none")
- `outlier_method`: str - Outlier handling ("iqr", "percentile", "none")
- `outlier_percentile`: float - Percentile for outlier clipping
- `normalize_method`: str - Normalization ("minmax", "std", "none")
- `save_outliers`: bool - Save outliers to file
- `outliers_file`: Optional[str] - Outliers file path
- `save_scaling_params`: bool - Save scaling parameters
- `scaling_params_file`: Optional[str] - Scaling params file path

**Returns:**
```python
(df_processed, outliers_df, scaling_params)
```

#### `inverse_scaling(scaled_values, feature, scaling_params)`
Chuyển đổi scaled values về original scale.

## Clustering Strategies

### Interface

Tất cả clustering algorithms implement `ClusterInterface`:

```python
class ClusterInterface(ABC):
    @abstractmethod
    def cluster(self, X: np.ndarray, k: int = 8) -> Tuple[np.ndarray, np.ndarray]:
        pass

    @abstractmethod
    def compute_boundaries(self, X: np.ndarray, labels: np.ndarray,
                          centers: np.ndarray, k: int = 8, mode: str = "high_good") -> List[Tuple[float, float]]:
        pass
```

### Available Algorithms

1. **K-Means** (`kmeans.py`)
   - Default algorithm
   - Handles k > n_samples cases
   - Consistent 8 clusters output

2. **DBSCAN** (`dbscan.py`)
   - Density-based clustering
   - Automatic cluster number detection

3. **MeanShift** (`meanshift.py`)
   - Mode-seeking algorithm
   - Automatic cluster number detection

### Usage

```python
from src.core.tiering.strategies.cluster import ClusterAlgorithm

# Create algorithm instance
cluster_algo = ClusterAlgorithm(algorithm="kmeans")

# Cluster data
labels, centers = cluster_algo.cluster(X, k=8)

# Compute boundaries
boundaries = cluster_algo.compute_boundaries(X, labels, centers, k=8, mode="high_good")
```

## API Endpoints

### 1. POST /tiers/all

**Request:**
```json
{
  "indicators": ["STD_RTD97", "STD_RTD91"],
  "weights": [0.7, 0.3],
  "k": 8,
  "algorithm": "kmeans"
}
```

**Response:**
```json
{
  "indicators": ["STD_RTD97", "STD_RTD91"],
  "weights": [0.7, 0.3],
  "algorithm": "kmeans",
  "k": 8,
  "tier_labels": ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"],
  "boundaries": [["-inf", 0.15], [0.15, 0.25], ...],
  "result_df_shape": [1500, 8],
  "cache_file": "cache/tiers/all_sector_None_STD_RTD97_STD_RTD91_kmeans.csv",
  "success": true
}
```

### 2. POST /tiers/cluster

**Request:**
```json
{
  "sector": "G",
  "indicators": ["STD_RTD97", "STD_RTD91"],
  "weights": [0.7, 0.3],
  "cluster_label": 2,
  "k": 8,
  "algorithm": "kmeans"
}
```

**Response:**
```json
{
  "sector": "G",
  "indicators": ["STD_RTD97", "STD_RTD91"],
  "weights": [0.7, 0.3],
  "cluster_label": 2,
  "algorithm": "kmeans",
  "k": 8,
  "tier_labels": ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"],
  "boundaries": [["-inf", 0.12], [0.12, 0.22], ...],
  "result_df_shape": [150, 6],
  "cache_file": "cache/tiers/G_2_STD_RTD97_STD_RTD91_kmeans.csv",
  "success": true
}
```

### 3. POST /score

Gán nhãn tiers theo danh sách `indicators` và (tuỳ chọn) `weights`. Nếu `sector` rỗng → lấy thang điểm toàn bộ; có `sector` → lấy thang theo sector (và `cluster_label` nếu có).

**Request:**
```json
[
  {
    "taxcode": "0100100001",
    "sector": null,
    "cluster_label": null,
    "indicators": ["STD_RTD97", "STD_RTD91"],
    "weights": [0.7, 0.3],
    "STD_RTD97": 0.42,
    "STD_RTD91": 0.35
  },
  {
    "taxcode": "0100100002",
    "sector": "G",
    "cluster_label": null,
    "indicators": ["STD_RTD97"],
    "STD_RTD97": 0.78
  },
  {
    "taxcode": "0100100003",
    "sector": "A",
    "cluster_label": 2,
    "indicators": ["STD_RTD71", "STD_RTD1"],
    "weights": [1.0, 1.0],
    "STD_RTD71": 0.12,
    "STD_RTD1": 1.25
  }
]
```

**Response:**
```json
{
  "total_companies": 3,
  "scored_companies": 3,
  "companies": [
    {
      "taxcode": "0100100001",
      "sector": null,
      "cluster_label": null,
      "scores": [
        {"indicator": "STD_RTD97+STD_RTD91", "tier": "T6"}
      ]
    },
    {
      "taxcode": "0100100002",
      "sector": "G",
      "cluster_label": null,
      "scores": [
        {"indicator": "STD_RTD97", "tier": "T4"}
      ]
    },
    {
      "taxcode": "0100100003",
      "sector": "A",
      "cluster_label": 2,
      "scores": [
        {"indicator": "STD_RTD71+STD_RTD1", "tier": "T5"}
      ]
    }
  ]
}
```

## Data Flow

### 1. Tiering Pipeline

```
Raw Data (A-S.csv) 
    ↓
PersistentCache.get() 
    ↓
preprocess() 
    ↓
_create_synthetic_indicator() 
    ↓
compute() 
    ↓
cluster() + compute_boundaries() 
    ↓
match_tier_company() 
    ↓
Save to cache + Return results
```

### 2. Scoring Pipeline

```
Company Features 
    ↓
Load cached tier boundaries 
    ↓
Match feature values to tiers 
    ↓
Return non-null scores only
```

## Performance Optimization

### 1. Persistent Caching
- Cache preprocessed data để tránh tính toán lại
- Lazy loading khi cần thiết
- Metadata tracking cho cache management

### 2. Adaptive Parameters
- Tự động điều chỉnh k dựa trên data size
- Fallback mechanisms cho edge cases

### 3. Memory Management
- Efficient data structures
- Minimal memory copying
- Garbage collection optimization

## Error Handling

### Common Errors

1. **"indicators parameter is required"**
   - Solution: Provide indicators list in request

2. **"weights length must match indicators length"**
   - Solution: Ensure weights array has same length as indicators

3. **"No valid indicators found"**
   - Solution: Check indicator names in data

4. **"Expected 8 clusters but only found X"**
   - Solution: Reduce k or use different algorithm

### Error Response Format

```json
{
  "error": "Error message description"
}
```

## Testing

### Unit Tests
- `test_tiering_pipeline_real_data.py` - Pipeline tests với real data
- `test_compute_tiers_comprehensive.py` - Comprehensive tiering tests
- `test_preprocessing.py` - Preprocessing function tests
- `test_persistent_cache.py` - Cache functionality tests

### Running Tests
```bash
# Run all tiering tests
python -m pytest src/tests/test_tiering_pipeline_real_data.py -v

# Run specific test
python -m pytest src/tests/test_compute_tiers_comprehensive.py::TestComputeTiersComprehensive::test_compute_tiers_all_with_mock_data -v -s
```

## Configuration

### config.py Settings

```python
# Preprocessing parameters
null_handling: Literal["none", "skip", "median"] = "skip"
outlier_handling: Literal["none", "iqr", "percentile"] = "iqr"
normalization: Literal["none", "std", "minmax"] = "minmax"
outlier_percentile: float = 5.0

# Clustering parameters
default_k: int = 8
default_algorithm: str = "kmeans"

# Cache settings
cache_dir: str = "cache"
```

## Best Practices

### 1. Data Preparation
- Ensure data quality before processing
- Use appropriate null handling strategy
- Consider outlier impact on clustering

### 2. Parameter Selection
- Start with default parameters
- Adjust k based on data size
- Test different algorithms for your use case

### 3. Performance
- Use persistent cache for repeated operations
- Monitor memory usage with large datasets
- Consider batch processing for multiple indicators

### 4. Error Handling
- Always check API responses for errors
- Implement retry logic for transient failures
- Log errors for debugging

## Troubleshooting

### Common Issues

1. **Slow Performance**
   - Check cache usage
   - Reduce data size for testing
   - Use simpler algorithms

2. **Memory Issues**
   - Reduce batch size
   - Clear cache periodically
   - Use streaming processing

3. **Inconsistent Results**
   - Check data preprocessing
   - Verify algorithm parameters
   - Ensure reproducible random seeds

### Debug Mode

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## API Testing với Postman

### Setup Postman

1. **Tạo Collection mới**: "Tiering API Tests"
2. **Set Base URL**: `http://localhost:5000`
3. **Set Headers**: `Content-Type: application/json`

### Test Cases

#### 1. Test /tiers/all - Single Indicator

**Request:**
- **Method**: POST
- **URL**: `{{base_url}}/tiers/all`
- **Body** (raw JSON):
```json
{
  "indicators": ["STD_RTD97"],
  "k": 8,
  "algorithm": "kmeans"
}
```

**Expected Response:**
```json
{
  "indicators": ["STD_RTD97"],
  "weights": null,
  "algorithm": "kmeans",
  "k": 8,
  "tier_labels": ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"],
  "boundaries": [["-inf", 0.15], [0.15, 0.25], ...],
  "result_df_shape": [1500, 8],
  "cache_file": "cache/tiers/all_sector_None_STD_RTD97_kmeans.csv",
  "success": true
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has required fields", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('indicators');
    pm.expect(jsonData).to.have.property('tier_labels');
    pm.expect(jsonData).to.have.property('boundaries');
    pm.expect(jsonData).to.have.property('success', true);
});

pm.test("Tier labels count is 8", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.tier_labels).to.have.lengthOf(8);
});
```

#### 2. Test /tiers/all - Multiple Indicators with Weights

**Request:**
- **Method**: POST
- **URL**: `{{base_url}}/tiers/all`
- **Body** (raw JSON):
```json
{
  "indicators": ["STD_RTD97", "STD_RTD91", "STD_RTD72"],
  "weights": [0.5, 0.3, 0.2],
  "k": 8,
  "algorithm": "kmeans"
}
```

**Expected Response:**
```json
{
  "indicators": ["STD_RTD97", "STD_RTD91", "STD_RTD72"],
  "weights": [0.5, 0.3, 0.2],
  "algorithm": "kmeans",
  "k": 8,
  "tier_labels": ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"],
  "boundaries": [["-inf", 0.12], [0.12, 0.22], ...],
  "result_df_shape": [1500, 8],
  "cache_file": "cache/tiers/all_sector_None_STD_RTD97_STD_RTD91_STD_RTD72_kmeans.csv",
  "success": true
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Weights match indicators length", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.weights).to.have.lengthOf(jsonData.indicators.length);
});
```

#### 3. Test /tiers/cluster - Sector Specific

**Request:**
- **Method**: POST
- **URL**: `{{base_url}}/tiers/cluster`
- **Body** (raw JSON):
```json
{
  "sector": "G",
  "indicators": ["STD_RTD97"],
  "k": 8,
  "algorithm": "kmeans"
}
```

**Expected Response:**
```json
{
  "sector": "G",
  "indicators": ["STD_RTD97"],
  "weights": null,
  "cluster_label": null,
  "algorithm": "kmeans",
  "k": 8,
  "tier_labels": ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"],
  "boundaries": [["-inf", 0.18], [0.18, 0.28], ...],
  "result_df_shape": [200, 6],
  "cache_file": "cache/tiers/G_None_STD_RTD97_kmeans.csv",
  "success": true
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Sector is G", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.sector).to.eql("G");
});
```

#### 4. Test /tiers/cluster - With Cluster Label

**Request:**
- **Method**: POST
- **URL**: `{{base_url}}/tiers/cluster`
- **Body** (raw JSON):
```json
{
  "sector": "G",
  "indicators": ["STD_RTD97"],
  "cluster_label": 2,
  "k": 8,
  "algorithm": "kmeans"
}
```

**Expected Response:**
```json
{
  "sector": "G",
  "indicators": ["STD_RTD97"],
  "weights": null,
  "cluster_label": 2,
  "algorithm": "kmeans",
  "k": 8,
  "tier_labels": ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"],
  "boundaries": [["-inf", 0.15], [0.15, 0.25], ...],
  "result_df_shape": [50, 6],
  "cache_file": "cache/tiers/G_2_STD_RTD97_kmeans.csv",
  "success": true
}
```

#### 5. Test /score - Single Company

**Request:**
- **Method**: POST
- **URL**: `{{base_url}}/score`
- **Body** (raw JSON):
```json
[
  {
    "taxcode": "0100100008",
    "sector": "G",
    "cluster_label": 0,
    "features": {
      "STD_RTD71": 0.374,
      "empl_qtty": 6132,
      "STD_RTD1": 1.429
    },
    "sector_unique_id": "46413",
    "yearreport": 2022,
    "length_report": 5
  }
]
```

**Expected Response:**
```json
{
  "total_companies": 1,
  "scored_companies": 1,
  "companies": [
    {
      "taxcode": "0100100008",
      "sector": "G",
      "cluster_label": 0,
      "sector_unique_id": "46413",
      "yearreport": 2022,
      "length_report": 5,
      "scores": [
        {"indicator": "STD_RTD71", "tier": "T3"},
        {"indicator": "empl_qtty", "tier": "T1"}
      ]
    }
  ]
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Scored companies count", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.scored_companies).to.be.at.most(jsonData.total_companies);
});

pm.test("Company has scores", function () {
    const jsonData = pm.response.json();
    if (jsonData.companies.length > 0) {
        pm.expect(jsonData.companies[0]).to.have.property('scores');
        pm.expect(jsonData.companies[0].scores).to.be.an('array');
    }
});
```

#### 6. Test /score - Multiple Companies

**Request:**
- **Method**: POST
- **URL**: `{{base_url}}/score`
- **Body** (raw JSON):
```json
[
  {
    "taxcode": "0100100008",
    "sector": "G",
    "cluster_label": 0,
    "features": {
      "STD_RTD71": 0.374,
      "empl_qtty": 6132
    },
    "sector_unique_id": "46413",
    "yearreport": 2022
  },
  {
    "taxcode": "0100100009",
    "sector": "A",
    "cluster_label": 1,
    "features": {
      "STD_RTD71": 0.125,
      "empl_qtty": 2500
    },
    "sector_unique_id": "46414",
    "yearreport": 2022
  }
]
```

#### 7. Test Error Cases

**Test 1: Missing indicators**
- **Request**: `{"k": 8}`
- **Expected**: 400 status, error message

**Test 2: Invalid weights length**
- **Request**: `{"indicators": ["A", "B"], "weights": [0.5]}`
- **Expected**: 400 status, error message

**Test 3: Invalid sector**
- **Request**: `{"sector": "Z", "indicators": ["STD_RTD97"]}`
- **Expected**: 500 status, error message

**Test 4: Empty companies array**
- **Request**: `[]`
- **Expected**: 400 status, error message

### Postman Collection Setup

1. **Tạo Environment Variables:**
   - `base_url`: `http://localhost:5000`
   - `test_sector`: `G`
   - `test_indicator`: `STD_RTD97`

2. **Tạo Pre-request Scripts:**
```javascript
// Set timestamp for unique requests
pm.environment.set("timestamp", new Date().getTime());
```

3. **Tạo Tests cho mỗi request:**
```javascript
// Common test for all tiering endpoints
pm.test("Response time is less than 5000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(5000);
});

pm.test("Response has success field", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
});
```

### Performance Testing

#### Load Testing với Postman

1. **Tạo Collection Runner**
2. **Set iterations**: 10-50
3. **Set delay**: 100ms
4. **Monitor response times**

#### Stress Testing

1. **Test với large datasets**
2. **Test với multiple indicators**
3. **Test concurrent requests**

### Debugging Tips

1. **Check Response Headers:**
   - Content-Type: application/json
   - Status codes: 200, 400, 500

2. **Validate JSON Structure:**
   - Required fields present
   - Data types correct
   - Array lengths match expectations

3. **Monitor Performance:**
   - Response times
   - Memory usage
   - Cache hit rates

4. **Error Handling:**
   - Check error messages
   - Verify input validation
   - Test edge cases

### Postman Collection Export

Export collection để chia sẻ:
1. **Collection** → **Export**
2. **Choose v2.1**
3. **Include environment variables**
4. **Save as JSON file**

### Automated Testing

Sử dụng Newman (Postman CLI):
```bash
# Install Newman
npm install -g newman

# Run collection
newman run Tiering_API_Tests.postman_collection.json -e environment.json

# Run with report
newman run Tiering_API_Tests.postman_collection.json -e environment.json -r html
```
