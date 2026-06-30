import sys
import json
import pandas as pd
import joblib
import os
import numpy as np

# Get file path from command line argument
if len(sys.argv) < 2:
    print(json.dumps({"error": "No data file provided"}))
    sys.exit(1)

data_path = sys.argv[1]

try:
    # Load the data
    with open(data_path, 'r') as f:
        lab_data = json.load(f)
    
    # Load ML models and preprocessing tools
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'rf_multilabel_model.pkl')
    scaler_path = os.path.join(os.path.dirname(__file__), 'models', 'scaler.pkl')
    mlb_path = os.path.join(os.path.dirname(__file__), 'models', 'mlb.pkl')
    
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    mlb = joblib.load(mlb_path)
    
    # Prepare the data for prediction
    # Create a DataFrame with one row
    df = pd.DataFrame([lab_data])
    
    # Get feature columns (exclude non-numeric columns)
    feature_cols = [col for col in df.columns if col not in ['Condition', 'Morphology', 'Remark', 'ECG', 'CT_Scan', 'Patient_ID']]
    
    # Select features and convert to numeric
    features = df[feature_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    
    # Ensure all required columns are present
    required_cols = scaler.feature_names_in_
    for col in required_cols:
        if col not in features.columns:
            features[col] = 0
    
    # Reorder columns to match training data
    features = features[required_cols]
    
    # Scale the features
    features_scaled = scaler.transform(features)

    # Make prediction (binary labels)
    predictions = model.predict(features_scaled)

    # Convert predictions to disease names
    predicted_diseases = mlb.inverse_transform(predictions)[0]

    # Compute per-disease risk probabilities for the single sample
    # Handle single-class estimators safely (only class 0 or 1 seen in training)
    proba_list = []  # list of prob(class=1) for each label
    for est in model.estimators_:
        probs = est.predict_proba(features_scaled)
        # probs shape: (n_samples=1, n_classes)
        if probs.shape[1] == 1:
            single_class = est.classes_[0]
            prob_1 = 1.0 if single_class == 1 else 0.0
        else:
            prob_1 = float(probs[0, 1])
        proba_list.append(prob_1)

    # Map risks to disease labels (percent)
    risks_by_disease = {
        disease: round(prob * 100, 2)
        for disease, prob in zip(mlb.classes_, proba_list)
    }

    # Only include risk for the diseases that are predicted as present
    predicted_with_risk = [
        {"disease": d, "risk_percent": risks_by_disease.get(d, None)}
        for d in predicted_diseases
    ]

    # Return the results (backward compatible: keep "predictions")
    # Also add a sorted list of all risk scores for optional UI use
    all_risks_sorted = sorted(
        [{"disease": d, "risk_percent": r} for d, r in risks_by_disease.items()],
        key=lambda x: (x["risk_percent"] if x["risk_percent"] is not None else -1),
        reverse=True,
    )

    result = {
        "predictions": list(predicted_diseases),
        "predicted_with_risk": predicted_with_risk,
        "risk_scores": all_risks_sorted,
        "features": lab_data
    }
    
    print(json.dumps(result))
    
except Exception as e:
    import traceback
    error_details = traceback.format_exc()
    print(json.dumps({
        "error": str(e),
        "traceback": error_details
    }))
    sys.exit(1)
