from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import math

app = Flask(__name__)
CORS(app)

# Mock data
MOCK_INDICATORS = {
    "indicators": {
        "STD_RTD97": "ROA - Return on Assets",
        "STD_RTD91": "ROE - Return on Equity", 
        "STD_RTD71": "Current Ratio",
        "STD_RTD72": "Debt to Equity",
        "STD_RTD13": "Total Assets",
        "STD_RTD1": "Asset Turnover",
        "STD_RTD118": "Cash Flow",
        "STD_RTD11": "Net Income Growth",
        "STD_RTD146": "FFO to Debt"
    }
}

def generate_tier_boundaries(k=8, algorithm="kmeans"):
    """Generate realistic tier boundaries based on algorithm"""
    if algorithm == "kmeans":
        # K-means tends to create more evenly distributed clusters
        boundaries = []
        for i in range(k):
            if i == 0:
                lower = "-inf"
            else:
                lower = round(0.1 + (i-1) * 0.15, 3)
            
            if i == k-1:
                upper = "inf"
            else:
                upper = round(0.1 + i * 0.15, 3)
            
            boundaries.append([lower, upper])
        return boundaries
    
    elif algorithm == "dbscan":
        # DBSCAN might create irregular clusters
        boundaries = []
        irregular_points = [0.05, 0.12, 0.25, 0.4, 0.6, 0.75, 0.9, 0.95]
        for i in range(k):
            if i == 0:
                lower = "-inf"
            else:
                lower = irregular_points[i-1] if i-1 < len(irregular_points) else 0.1 + (i-1) * 0.1
            
            if i == k-1:
                upper = "inf"
            else:
                upper = irregular_points[i] if i < len(irregular_points) else 0.1 + i * 0.1
            
            boundaries.append([lower, upper])
        return boundaries
    
    else:  # meanshift
        # Mean shift creates clusters around modes
        boundaries = []
        mode_points = [0.08, 0.18, 0.35, 0.5, 0.65, 0.8, 0.92]
        for i in range(k):
            if i == 0:
                lower = "-inf"
            else:
                lower = mode_points[i-1] if i-1 < len(mode_points) else 0.1 + (i-1) * 0.12
            
            if i == k-1:
                upper = "inf"
            else:
                upper = mode_points[i] if i < len(mode_points) else 0.1 + i * 0.12
            
            boundaries.append([lower, upper])
        return boundaries

def generate_company_counts(k=8, base_companies=1500):
    """Generate realistic company counts per tier"""
    counts = []
    # T1-T3: Lower counts (better performing companies are rarer)
    # T4-T6: Higher counts (average performing companies)
    # T7-T8: Medium counts (poor performing companies)
    
    distribution = [0.08, 0.12, 0.15, 0.18, 0.20, 0.15, 0.08, 0.04]  # T1 to T8
    
    for i in range(k):
        if i < len(distribution):
            count = int(base_companies * distribution[i])
        else:
            count = int(base_companies / k)  # Fallback for k > 8
        
        # Add some randomness
        count += random.randint(-5, 5)
        counts.append(max(1, count))  # Ensure at least 1 company per tier
    
    return counts

@app.route('/indicator', methods=['GET'])
def get_indicators():
    """Trả về danh sách indicators"""
    return jsonify(MOCK_INDICATORS)

@app.route('/tiers/all', methods=['POST'])
def tiers_all():
    """Tính tiers cho all sectors - NEW FORMAT"""
    data = request.get_json()
    indicators = data.get('indicators', [])
    weights = data.get('weights', [])
    k = data.get('k', 8)
    algorithm = data.get('algorithm', 'kmeans')
    
    if not indicators:
        return jsonify({"error": "indicators parameter is required"}), 400
    
    # Validate weights
    if weights and len(weights) != len(indicators):
        return jsonify({"error": "weights length must match indicators length"}), 400
    
    # Generate boundaries based on algorithm
    boundaries = generate_tier_boundaries(k, algorithm)
    
    # Generate tier labels
    tier_labels = [f"T{i+1}" for i in range(k)]
    
    # Calculate total companies (simulate all sectors data)
    total_companies = random.randint(1200, 1800)
    
    # Mock response in new format
    response = {
        "indicators": indicators,
        "weights": weights,
        "algorithm": algorithm,
        "k": k,
        "tier_labels": tier_labels,
        "boundaries": boundaries,
        "result_df_shape": [total_companies, k + 2],  # companies x (tiers + metadata)
        "cache_file": f"cache/tiers/all_sector_None_{'_'.join(indicators)}_{algorithm}.csv",
        "success": True
    }
    
    print(f"📊 Generated /tiers/all response: {algorithm} with {k} clusters")
    print(f"📊 Indicators: {indicators}")
    print(f"📊 Weights: {weights}")
    
    return jsonify(response)

@app.route('/tiers/cluster', methods=['POST'])
def tiers_cluster():
    """Tính tiers cho sector cụ thể - NEW FORMAT"""
    data = request.get_json()
    sector = data.get('sector')
    indicators = data.get('indicators', [])
    weights = data.get('weights', [])
    cluster_label = data.get('cluster_label')
    k = data.get('k', 8)
    algorithm = data.get('algorithm', 'kmeans')
    
    if not indicators:
        return jsonify({"error": "indicators parameter is required"}), 400
    
    # Validate weights
    if weights and len(weights) != len(indicators):
        return jsonify({"error": "weights length must match indicators length"}), 400
    
    # Generate boundaries based on algorithm
    boundaries = generate_tier_boundaries(k, algorithm)
    
    # Generate tier labels
    tier_labels = [f"T{i+1}" for i in range(k)]
    
    # Calculate companies for specific sector (smaller than all sectors)
    sector_companies = random.randint(80, 300)
    
    # Mock response in new format
    response = {
        "sector": sector,
        "indicators": indicators,
        "weights": weights,
        "cluster_label": cluster_label,
        "algorithm": algorithm,
        "k": k,
        "tier_labels": tier_labels,
        "boundaries": boundaries,
        "result_df_shape": [sector_companies, k + 3],  # companies x (tiers + sector metadata)
        "cache_file": f"cache/tiers/{sector}_{cluster_label}_{'_'.join(indicators)}_{algorithm}.csv",
        "success": True
    }
    
    print(f"📊 Generated /tiers/cluster response: {algorithm} with {k} clusters for sector {sector}")
    print(f"📊 Indicators: {indicators}")
    print(f"📊 Weights: {weights}")
    
    return jsonify(response)

@app.route('/score', methods=['POST'])
def score_companies():
    """Score companies - COMPATIBLE FORMAT"""
    companies = request.get_json()
    
    if not companies:
        return jsonify({"error": "companies parameter is required"}), 400
    
    # Mock scoring
    result_companies = []
    for company in companies:
        taxcode = company.get('taxcode')
        sector = company.get('sector')
        
        # Mock scores based on indicators in request
        indicators = company.get('indicators', ['STD_RTD97'])
        scores = []
        
        for indicator in indicators:
            tier = f"T{random.randint(1, 8)}"
            scores.append({"indicator": indicator, "tier": tier})
        
        result_companies.append({
            "taxcode": taxcode,
            "sector": sector,
            "scores": scores
        })
    
    return jsonify({
        "total_companies": len(companies),
        "scored_companies": len(result_companies), 
        "companies": result_companies
    })

@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "OK",
        "message": "Updated Mock Rating API Server is running",
        "version": "2.0 - New API Format Support",
        "endpoints": [
            "GET /indicator",
            "POST /tiers/all (NEW FORMAT)", 
            "POST /tiers/cluster (NEW FORMAT)",
            "POST /score"
        ],
        "new_features": [
            "Indicators array support",
            "Weights support for each indicator",
            "Algorithm selection (kmeans, dbscan, meanshift)",
            "Configurable K (number of clusters)",
            "Realistic boundary generation",
            "Algorithm-specific clustering behavior"
        ]
    })

if __name__ == '__main__':
    print("🚀 Starting Updated Mock Rating API Server...")
    print("📡 Available endpoints:")
    print("   GET  /indicator")
    print("   POST /tiers/all (NEW FORMAT)")
    print("   POST /tiers/cluster (NEW FORMAT)") 
    print("   POST /score")
    print()
    print("🔧 New API Features:")
    print("   ✅ Indicators array support")
    print("   ✅ Weights support")
    print("   ✅ Algorithm selection (kmeans, dbscan, meanshift)")
    print("   ✅ Configurable K clusters")
    print("   ✅ Realistic boundary generation")
    print()
    print("💡 Frontend URL: http://localhost:5000")
    print("📋 Test with: curl -X POST http://localhost:5000/tiers/all -H 'Content-Type: application/json' -d '{\"indicators\":[\"STD_RTD97\"],\"k\":8,\"algorithm\":\"kmeans\"}'")
    
    app.run(debug=True, host='0.0.0.0', port=5000)