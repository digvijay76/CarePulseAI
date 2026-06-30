import os
import sys
import json
import time
import random

try:
    from google import genai
    from google.genai import types
except Exception as e:
    sys.stderr.write("Missing dependency google-genai or import error: %s\n" % e)
    sys.exit(1)


# ============================================================
# STRICT POLICY JSON SCHEMA TEMPLATE
# ============================================================
JSON_SCHEMA_TEMPLATE = """
Return the extracted policy in the following EXACT JSON structure:

{
  "policy_id": "",
  "company_name": "",
  "policy_name": "",
  "uin": "",
  "sum_assured": {
    "min": 0,
    "max": 0
  },
  "policy_type": "",
  "waiting_periods": {
    "pre_existing_disease": 0,
    "first_30_days": false,
    "90_days": [],
    "1_year": [],
    "2_years": [],
    "4_years": []
  },
  "coverage": {
    "hospitalisation": "",
    "room_charges": {
      "limit": "",
      "icu_limit": "",
      "overall_limit": ""
    },
    "doctor_fees": "",
    "other_expenses": "",
    "dialysis_chemo_radio": "",
    "modern_treatments": "",
    "ambulance": "",
    "pre_hospitalisation": "",
    "post_hospitalisation": "",
    "organ_donor": "",
    "mental_illness": "",
    "obesity_treatment": "",
    "refractive_error": ""
  },
  "disease_coverage": {
    "Cancer": {
      "cap_amount": "",
      "waiting_period_years": 0
    }
  },
  "general_exclusions": []
}

Rules:
- Fill every field as per extracted policy.
- Use the same keys, structure, types.
- Add more diseases under “disease_coverage” if available in the document.
- No extra fields allowed.
- Convert all Lacs/Crores → numeric Rupees.
- first_30_days must be true/false only.
- Output ONLY valid JSON. No explanation.
"""


# ============================================================
# PROMPT
# ============================================================
PROMPT = (
    "You are an expert insurance data extractor.\n"
    "Analyze the provided health insurance policy PDF and extract ONLY the single best policy variant.\n"
    "Best = most comprehensive, highest coverage, or the main/base variant.\n\n"
    "STRICT OUTPUT RULES:\n"
    "1. Output ONLY a single JSON object.\n"
    "2. Do NOT output arrays unless specified in schema.\n"
    "3. No text outside JSON.\n"
    "4. Follow the JSON template EXACTLY.\n\n"
    + JSON_SCHEMA_TEMPLATE
)


# ============================================================
# Retry wrapper
# ============================================================
def retry_with_backoff(fn, retries=5, min_wait=1, max_wait=4):
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                wait = random.uniform(min_wait, max_wait) * attempt
                sys.stderr.write(
                    f"[Retry] Gemini overloaded (503). Attempt {attempt}/{retries}. Waiting {wait:.2f}s...\n"
                )
                time.sleep(wait)
                continue
            raise e
    raise Exception("Model overloaded after retries.")


# ============================================================
# Main
# ============================================================
def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: policy_extraction.py <pdf_path>\n")
        sys.exit(2)

    pdf_path = sys.argv[1]

    if not os.path.exists(pdf_path):
        sys.stderr.write(f"File not found: {pdf_path}\n")
        sys.exit(2)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        sys.stderr.write("GEMINI_API_KEY not set.\n")
        sys.exit(3)

    client = genai.Client(api_key=api_key)

    # Upload PDF
    try:
        uploaded_file = client.files.upload(file=pdf_path)
    except Exception as e:
        sys.stderr.write("File upload failed: %s\n" % e)
        sys.exit(4)

    # Model call
    def call_model():
        return client.models.generate_content(
            model="gemini-2.5-pro",
            contents=[uploaded_file, PROMPT],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )

    try:
        response = retry_with_backoff(call_model)
        text = response.text
    except Exception as e:
        sys.stderr.write("Generation failed: %s\n" % e)
        sys.exit(5)

    # Delete uploaded file
    try:
        client.files.delete(name=uploaded_file.name)
    except Exception:
        pass

    # ============================================================
    # JSON Parsing
    # ============================================================
    try:
        parsed = json.loads(text)
        print(json.dumps(parsed, ensure_ascii=False))
        return
    except Exception:
        # Extract substring
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                parsed = json.loads(text[start:end+1])
                print(json.dumps(parsed, ensure_ascii=False))
                return
            except:
                pass

        sys.stderr.write("Model output was not valid JSON.\n")
        sys.exit(6)


if __name__ == "__main__":
    main()
