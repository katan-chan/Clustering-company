import pandas as pd
import sys
import json
import numpy as np
import os

# Define paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(BASE_DIR, 'sample_to_external')
ATTRIBUTE_DESCRIPTION_PATH = os.path.join(DATA_FOLDER, 'field_description.xlsx')

def load_attribute_description():
    """Loads the attribute description dataframe."""
    return pd.read_excel(ATTRIBUTE_DESCRIPTION_PATH)

def get_fields_for_group(attribute_description_df, group_name):
    """Returns the fields for a specific indicator group."""
    return attribute_description_df[attribute_description_df['Nhóm chỉ số'] == group_name]['field'].unique()

def calculate_correlation_matrix(df, fields):
    """Calculates the correlation matrix for a given set of fields after outlier removal."""
    # Ensure fields exist in dataframe, and drop rows with NaNs in these columns
    x = df[fields].dropna()
    
    if x.shape[0] < 2 or x.shape[1] < 2:
        return None

    # Outlier removal using the IQR method
    Q1 = x.quantile(0.25)
    Q3 = x.quantile(0.75)
    IQR = Q3 - Q1
    x_cleaned = x[~((x < (Q1 - 1.5 * IQR)) | (x > (Q3 + 1.5 * IQR))).any(axis=1)]

    if x_cleaned.empty or len(x_cleaned.columns) < 2:
        return None
        
    corr_matrix = x_cleaned.corr()
    
    # Replace NaN with None for JSON compatibility and return as a list of lists
    corr_matrix_list = corr_matrix.replace(np.nan, None).values.tolist()
    
    # Also return the column headers for context
    headers = corr_matrix.columns.tolist()
    
    return { "matrix": corr_matrix_list, "headers": headers }
