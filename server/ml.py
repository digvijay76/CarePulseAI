import pandas as pd
import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, MultiLabelBinarizer
from sklearn.multioutput import MultiOutputClassifier
from sklearn.metrics import accuracy_score, hamming_loss, f1_score, classification_report
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import multilabel_confusion_matrix, ConfusionMatrixDisplay

# Create a directory to save models
os.makedirs('models', exist_ok=True)

# 1. Load and prepare data - use a try/except to handle file not found errors
try:
    # Try the original path first
    file_path = "H:/Major_Project_Spit/Insure-app/server/dataset/updated_prediction_dataset.csv"
    if not os.path.exists(file_path):
        # If not found, try a relative path
        file_path = "updated_prediction_dataset.csv"
        
    df = pd.read_csv(file_path)
    print(f"Successfully loaded dataset from {file_path}")
except FileNotFoundError as e:
    print(f"Error: {e}")
    print("Please provide the correct path to your dataset file.")
    raise

# Process conditions
df['Condition'] = df['Condition'].fillna('').astype(str).str.split(', ')
mlb = MultiLabelBinarizer()
y = mlb.fit_transform(df['Condition'])
print(f"Number of unique conditions: {len(mlb.classes_)}")

# Prepare features
feature_cols = [col for col in df.columns if col not in ['Condition', 'Morphology', 'Remark', 'ECG', 'CT_Scan']]
X = df[feature_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
print(f"Number of features: {X.shape[1]}")

# 2. Split and scale data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# 3. Train model with more trees and balanced class weights
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1  # Use all available cores
)
multi_rf = MultiOutputClassifier(rf)
multi_rf.fit(X_train_scaled, y_train)

# 4. Save models to the models directory
model_path = os.path.join('models', 'rf_multilabel_model.pkl')
scaler_path = os.path.join('models', 'scaler.pkl')
mlb_path = os.path.join('models', 'mlb.pkl')

joblib.dump(multi_rf, model_path)
joblib.dump(scaler, scaler_path)
joblib.dump(mlb, mlb_path)

print(f"Models saved to: {os.path.abspath('models')}")
print(f"- Model: {model_path}")
print(f"- Scaler: {scaler_path}")
print(f"- Label Binarizer: {mlb_path}")

# 5. Evaluate model
y_pred = multi_rf.predict(X_test_scaled)
print("\nEvaluation Metrics:")
print(f"- Accuracy: {accuracy_score(y_test, y_pred):.2f}")
print(f"- Hamming Loss: {hamming_loss(y_test, y_pred):.2f}")
print(f"- Micro F1: {f1_score(y_test, y_pred, average='micro'):.2f}")
print(f"- Macro F1: {f1_score(y_test, y_pred, average='macro'):.2f}")
