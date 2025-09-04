import io
import pandas as pd
from flask import Flask, request, jsonify
from correlation_module import load_attribute_description, get_fields_for_group, calculate_correlation_matrix
from flask_cors import CORS 
app = Flask(__name__)
CORS(app)

# Load attribute description globally to avoid reloading on each request
attribute_description_df = load_attribute_description()
indicator_groups = attribute_description_df['Nhóm chỉ số'].unique()

@app.route('/api/correlation', methods=['POST'])
def get_correlation_api():
    """
    API to calculate correlation matrices for different indicator groups,
    grouped by industry sector. Expects a CSV file with financial data.
    """
    print("????")
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request."}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file."}), 400

    if not file or not file.filename.endswith('.csv'):
        return jsonify({"error": "Invalid file type. Please upload a CSV file."}), 400

    try:
        csv_data = io.StringIO(file.read().decode('utf-8'))
        input_df = pd.read_csv(csv_data)
    except Exception as e:
        return jsonify({"error": f"Failed to read or parse CSV file: {e}"}), 400

    if 'sector_unique_id' not in input_df.columns:
        return jsonify({"error": "CSV must contain a 'sector_unique_id' column."}), 400

    industries = input_df.groupby('sector_unique_id')
    
    results = []

    for industry_name, industry_df in industries:
        group_matrices = {}
        
        for group_name in indicator_groups:
            fields = get_fields_for_group(attribute_description_df, group_name)
            
            # Filter for fields that are actually in the dataframe
            existing_fields = [f for f in fields if f in industry_df.columns]
            
            if len(existing_fields) < 2:
                continue

            correlation_matrix = calculate_correlation_matrix(industry_df, existing_fields)
            
            if correlation_matrix:
                group_matrices[group_name] = correlation_matrix

        if group_matrices:
            results.append({
                "Tên ngành": industry_name,
                "group_correlation_matrices": group_matrices
            })

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
