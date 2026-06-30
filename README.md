## CarePulse AI — Smart Health Insight & Policy Recommender
CarePulse AI is an end-to-end system built with Python, ML/NLP, OCR, FastAPI, and the MERN stack that turns raw medical documents into actionable insights and personalized insurance guidance.

- Automated Medical Data Extraction (OCR + NLP): Extracts test names, values, and clinical parameters from lab reports using OCR and NLP pipelines with ~94% extraction accuracy, converting unstructured documents into structured medical data.
- Disease Risk Prediction Engine (ML Models): Analyzes extracted health metrics to generate multi-condition risk scores with ~87% prediction accuracy, enabling precise and reliable health profiling.
- Personalized Insurance Recommendation: Maps predicted health risks to suitable insurance plans using a rule-based + ML-driven recommendation engine, providing tailored policy suggestions aligned to the user’s health profile.

## Features
- Upload lab report JSON and view predicted disease risk percentages
- Insurance recommendations with effective coverage calculation using disease caps
- Modern React UI with MUI, stepper-based dashboard flow
- Policy PDF extraction via Python (Gemini 2.5 Pro) and save to DB
- Health check endpoint and helpful API logging

## Tech Stack
- Frontend: React + Vite + MUI
- Backend: Node.js + Express
- ML/Extraction: Python subprocesses (prediction, policy extraction)
- Database: MongoDB via Mongoose

## Project Structure
```
client/
  src/
    App.jsx, main.jsx, components/, pages/
server/
  server.js, prediction.py, extraction.py, policy_extraction.py
  models/, dataset/, uploads/
```

## Prerequisites
- Node.js 18+
- Python 3.10+ (with `pip`)
- MongoDB (local or Atlas)

## Environment Variables
Create `server/.env` with:
```
MONGODB_URI=mongodb://localhost:27017/insureapp
# Optional: point to a Python in a virtualenv
PYTHON_BIN=C:\Path\to\venv\Scripts\python.exe
# Required for policy extraction
GEMINI_API_KEY=your_key_here
```

## Setup
### Install dependencies
```powershell
# From project root
Push-Location client; npm install; Pop-Location
Push-Location server; npm install; Pop-Location
```

### Python packages (server-side)
Install required Python libs in the interpreter used by `PYTHON_BIN` (or system python):
```powershell
# Choose your Python (set to venv if used)
python -m pip install --upgrade pip
python -m pip install google-genai pandas scikit-learn
```

## Run
### Start backend (port 5000)
```powershell
Push-Location server; node server.js; Pop-Location
```

### Start frontend (port 5173; proxies /api to 5000)
```powershell
Push-Location client; npm run dev; Pop-Location
```

Open `http://localhost:5173`.

## Key Endpoints (Server)
- `GET /health` — server and DB status
- `POST /api/extract` — extract lab data to JSON
- `POST /api/predict` — disease risk prediction
- `POST /api/plan` — insurance recommendations
- `GET /api/policy/extract` — route diagnostic
- `POST /api/policy/extract` — policy PDF → JSON via Gemini
- `POST /api/policy/save` — upsert extracted policy JSON

## Frontend Pages
- Dashboard: multi-step upload → risks → insurance recommendations
- Insurance: policy extraction page (upload PDF → extract → save)

## Coverage Calculation
The UI computes effective coverage using disease caps:
- Effective coverage = `sum_assured × min(cap fractions for selected diseases)`
- Falls back to recommended baseline derived from highest treatment costs when `sum_assured` is missing.

## Troubleshooting
- 404 from frontend to backend: ensure Vite proxy maps `/api` to port 5000 and the server is running
- Python errors like `cannot import name 'genai'`:
  - Install `google-genai` in the interpreter used by the server
  - Set `PYTHON_BIN` to your venv's `python.exe`
- Policy extraction requires a valid `GEMINI_API_KEY`

## Git & Publishing
Common commands:
```powershell
# Initialize and first commit
git init
git add .
git commit -m "Initial commit"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/<user>/<repo>.git

# Push main branch
git branch -M main
git push -u origin main
```

## License
Proprietary – internal project use. Adjust as needed.
