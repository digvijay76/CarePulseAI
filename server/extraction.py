import sys
import json
import fitz  # PyMuPDF
import re
import os

# Get file path from command line argument
if len(sys.argv) < 2:
    print(json.dumps({"error": "No file path provided"}))
    sys.exit(1)

file_path = sys.argv[1]

# --- Constants for extraction ---
COMMON_LAB_TESTS = [
    "haemoglobin", "hemoglobin", "rbc", "wbc", "platelet", "rdw", "mcv", "mch", "mchc",
    "tlc", "neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils",
    "glucose", "fasting glucose", "pp glucose", "hba1c", "creatinine", "bun",
    "urea", "sodium", "potassium", "chloride", "calcium", "phosphorus", "bilirubin",
    "alt", "ast", "alkaline phosphatase", "tsh", "t3", "t4", "vitamin b12", "vitamin d",
    "hba1c", "glycated haemoglobin", "pcv", "erythrocyte", "erythrocyte count",
    "morphology", "remark", "leucocytes", "total leucocytes count", "tlc count",
    "absolute neutrophils", "absolute neutrophils count",
    "absolute lymphocyte", "absolute lymphocyte count",
    "absolute monocyte", "absolute monocyte count",
    "absolute eosinophil", "absolute eosinophil count",
    "absolute basophil", "absolute basophil count",
    "platelet count", "plateletcount",
    "mpv", "mean platelet volume",
    "pct", "platelet crit",
    "pdw", "platelet distribution width"
]

TEST_TO_COLUMN_MAP = {
    "total leucocytes": "Leucocytes",
    "leucocytes": "Leucocytes",
    "tlc": "Leucocytes",
    "wbc": "WBC",
    "rbc": "Erythrocyte_Count",
    "haemoglobin": "Haemoglobin",
    "hemoglobin": "Haemoglobin",
    "absolute neutrophils count": "Absolute_Neutrophils",
    "absolute lymphocyte count": "Absolute_Lymphocytes",
    "absolute monocyte count": "Absolute_Monocytes",
    "absolute eosinophil count": "Absolute_Eosinophils",
    "absolute basophil count": "Absolute_Basophils",
    "platelet count": "Platelet_Count",
    "neutrophils": "Neutrophils",
    "lymphocytes": "Lymphocytes",
    "monocytes": "Monocytes",
    "eosinophils": "Eosinophils",
    "basophils": "Basophils",
    "mpv": "MPV",
    "pct": "PCT",
    "pdw": "PDW",
    "morphology": "Morphology",
    "remark": "Remark",
    "hba1c": "HbA1C",
    "glycatedhaemoglobin": "HbA1C",
    "hemoglobina1c": "HbA1C"
}

def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        page_text = page.get_text()
        page_text = re.sub(r"Page \d+ of \d+", "", page_text)
        page_text = re.sub(r"(Collected On|Reported On|Registered On|Reference|Sample Collected At|Processing Location).*", "", page_text, flags=re.IGNORECASE)
        page_text = re.sub(r"\b(?:NABL|CAP|ID:|BarCode|Report ID|Reference Range|Printed On|Sample Type|Method)\b.*", "", page_text, flags=re.IGNORECASE)
        page_text = re.sub(r"\s{2,}", " ", page_text)
        text += page_text
    return text

def extract_patient_metadata(text):
    age = re.search(r"Age:\s*([\d\.]+)", text)
    sex = re.search(r"Sex:\s*(Male|Female|M|F)", text, re.IGNORECASE)
    pid = re.search(r"SUBJECT ID\s*([A-Z0-9]+)", text) or re.search(r"SUBJECT INITIALS\s*([A-Z]+)", text)
    return {
        "Age": int(float(age.group(1))) if age else None,
        "Sex": sex.group(1).capitalize()[0] if sex else None,
        "Patient_ID": pid.group(1) if pid else None
    }

def normalize_test_name(name):
    name = name.lower().strip()
    for test_key, column_name in TEST_TO_COLUMN_MAP.items():
        if test_key in name:
            return test_key
    return re.sub(r'[^a-z0-9]', '', name)

def extract_lab_results(text):
    results = {}
    
    # Special handling for HbA1c
    hba1c_pattern = r"(HbA1[Cc]|Glycated\s*Haemoglobin)\s*([\d\.,]+)\s*%?"
    hba1c_matches = re.findall(hba1c_pattern, text, re.IGNORECASE)
    for match in hba1c_matches:
        try:
            value = float(match[1].replace(',', '.'))
            results["hba1c"] = value
        except ValueError:
            continue
    
    # Extract morphology data (special case)
    morphology_match = re.search(r"Morphology\s+([A-Za-z\s]+)", text, re.IGNORECASE)
    if morphology_match:
        morphology = morphology_match.group(1).strip()
        results["morphology"] = morphology
    
    # Extract remark data (special case)
    remark_match = re.search(r"Remark\s+([A-Za-z\s]+)", text, re.IGNORECASE)
    if remark_match:
        remark = remark_match.group(1).strip()
        results["remark"] = remark
    
    # Regular pattern for numerical test results
    pattern = r"([A-Za-z0-9\-–\/\(\)%µ ,]{3,})\s+([\d\.,]+)\s+([a-zA-Z/%µ\d\^\-]+)(?:\s+([^\n]+))?"
    matches = re.findall(pattern, text)
    
    for m in matches:
        test_name_raw = m[0].strip().lower()
        if any(test in test_name_raw for test in COMMON_LAB_TESTS):
            try:
                value_str = m[1].replace(',', '.')
                observed_value = float(value_str)
                key = normalize_test_name(test_name_raw)
                results[key] = observed_value
            except ValueError:
                continue
    
    return results

try:
    # Check if file exists
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)
        
    # Extract data from the file
    text = extract_text_from_pdf(file_path)
    meta = extract_patient_metadata(text)
    labs = extract_lab_results(text)
    
    # Combine metadata and lab results
    extracted_data = {**meta}
    
    # Map lab results to standard column names
    for test_norm, value in labs.items():
        if test_norm in TEST_TO_COLUMN_MAP:
            extracted_data[TEST_TO_COLUMN_MAP[test_norm]] = value
        else:
            extracted_data[test_norm] = value
    
    # Output as JSON
    print(json.dumps(extracted_data))
    
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
