// src/components/ResultsDisplay.jsx

import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardContent, Button, Alert, Typography, Table, TableHead, TableRow, TableCell, TableBody, Stack, Box, Divider, Chip, LinearProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InsightsIcon from '@mui/icons-material/Insights';
import BoltIcon from '@mui/icons-material/Bolt';
import ShowRecommendations from '../pages/ShowRecommendations';

// 1) Friendly‐name mappings
const FRIENDLY_FIELD_NAMES = {
  Haemoglobin: 'Hemoglobin',
  Erythrocyte_Count: 'Red Blood Cell Count',
  Leucocytes: 'White Blood Cell Count',
  WBC: 'White Blood Cell Count',
  RBC: 'Red Blood Cell Count',
  Absolute_Neutrophils: 'Neutrophil Count',
  Absolute_Lymphocytes: 'Lymphocyte Count',
  Absolute_Monocytes: 'Monocyte Count',
  Absolute_Eosinophils: 'Eosinophil Count',
  Absolute_Basophils: 'Basophil Count',
  Neutrophils: 'Neutrophils',
  Lymphocytes: 'Lymphocytes',
  Monocytes: 'Monocytes',
  Eosinophils: 'Eosinophils',
  Basophils: 'Basophils',
  Platelet_Count: 'Platelet Count',
  HbA1C: 'HbA1c (Glycated Hemoglobin)',
  MPV: 'Mean Platelet Volume',
  PCT: 'Plateletcrit',
  PDW: 'Platelet Distribution Width',
  Glucose: 'Blood Glucose',
  Creatinine: 'Creatinine',
  Urea: 'Blood Urea',
  Sodium: 'Sodium',
  Potassium: 'Potassium',
  Chloride: 'Chloride',
  Calcium: 'Calcium',
  Bilirubin: 'Bilirubin',
  ALT: 'ALT (Alanine Transaminase)',
  AST: 'AST (Aspartate Transaminase)',
  Alkaline_Phosphatase: 'Alkaline Phosphatase',
  Age: 'Patient Age',
  Sex: 'Patient Gender',
  Patient_ID: 'Patient ID',

  // “Other” keys you had can be left out here, since they're now ignored
};

// 2) Units mapping
const PARAMETER_UNITS = {
  Haemoglobin: 'g/dL',
  Erythrocyte_Count: 'million/μL',
  Leucocytes: 'thousand/μL',
  WBC: 'thousand/μL',
  RBC: 'million/μL',
  Absolute_Neutrophils: 'cells/μL',
  Absolute_Lymphocytes: 'cells/μL',
  Absolute_Monocytes: 'cells/μL',
  Absolute_Eosinophils: 'cells/μL',
  Absolute_Basophils: 'cells/μL',
  Neutrophils: '%',
  Lymphocytes: '%',
  Monocytes: '%',
  Eosinophils: '%',
  Basophils: '%',
  Platelet_Count: 'thousand/μL',
  HbA1C: '%',
  MPV: 'fL',
  PCT: '%',
  PDW: '%',
  Glucose: 'mg/dL',
  Creatinine: 'mg/dL',
  Urea: 'mg/dL',
  Sodium: 'mEq/L',
  Potassium: 'mEq/L',
  Chloride: 'mEq/L',
  Calcium: 'mg/dL',
  Bilirubin: 'mg/dL',
  ALT: 'U/L',
  AST: 'U/L',
  Alkaline_Phosphatase: 'U/L'
};

// 3) Only the desired categories — no “Other Parameters”
const DATA_CATEGORIES = {
  'Patient Information': ['Age', 'Sex', 'Patient_ID'],
  'Complete Blood Count': [
    'Haemoglobin', 'Erythrocyte_Count', 'RBC', 'Leucocytes', 'WBC', 'Platelet_Count'
  ],
  'White Blood Cell Differential': [
    'Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils',
    'Absolute_Neutrophils', 'Absolute_Lymphocytes', 'Absolute_Monocytes',
    'Absolute_Eosinophils', 'Absolute_Basophils'
  ],
  'Platelet Parameters': ['Platelet_Count', 'MPV', 'PCT', 'PDW'],
  'Metabolic Parameters': [
    'Glucose', 'HbA1C', 'Creatinine', 'Urea', 'Sodium', 'Potassium', 'Chloride', 'Calcium'
  ],
  'Liver Function Tests': ['Bilirubin', 'ALT', 'AST', 'Alkaline_Phosphatase']
  // <-- No Other Parameters key here
};

// 4) Fallback humanizer
function humanize(key) {
  if (FRIENDLY_FIELD_NAMES[key]) return FRIENDLY_FIELD_NAMES[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Row component
const ParameterRow = () => null; // replaced by MUI Table rows

// Group component
const ParameterGroup = ({ category, values }) => {
  const seen = new Set();
  const rows = Object.entries(values)
    .map(([key, val]) => {
      const name = humanize(key);
      if (seen.has(name)) return null;
      seen.add(name);
      return { key, value: val, friendlyName: name };
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>{category}</Typography>
      <Table size="small" sx={{ border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
        <TableHead sx={{ bgcolor: '#f1f5f9' }}>
          <TableRow>
            <TableCell>Parameter</TableCell>
            <TableCell>Value</TableCell>
            <TableCell>Unit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ key, value, friendlyName }, idx) => (
            <TableRow key={key} sx={{ bgcolor: idx % 2 === 0 ? 'transparent' : '#fafafa' }}>
              <TableCell>{friendlyName}</TableCell>
              <TableCell>{value}</TableCell>
              <TableCell>{PARAMETER_UNITS[key] || ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// Prediction results unchanged
const PredictionResults = ({ predictions }) => {
  if (!predictions?.predictions) return null;
  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardHeader title={
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckCircleOutlineIcon color="success" />
          <Typography variant="h6">Disease Predictions</Typography>
        </Stack>
      } subheader="Potential conditions based on your lab values" />
      <CardContent>
        {predictions.predictions.length > 0 ? (
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
            {(predictions.predicted_with_risk?.length ? predictions.predicted_with_risk.map((item, i) => (
              <Typography key={i} variant="body2" sx={{ bgcolor: '#eef2ff', color: '#3730a3', px: 1.25, py: 0.5, borderRadius: 1.5 }}>
                {item.disease}{typeof item.risk_percent === 'number' ? ` — ${item.risk_percent}%` : ''}
              </Typography>
            )) : predictions.predictions.map((cond, i) => (
              <Typography key={i} variant="body2" sx={{ bgcolor: '#eef2ff', color: '#3730a3', px: 1.25, py: 0.5, borderRadius: 1.5 }}>
                {cond}
              </Typography>
            )))}
          </Stack>
        ) : (
          <Alert severity="info">No diseases predicted based on the provided data.</Alert>
        )}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          Disclaimer: These predictions are based on statistical analysis and shouldn’t replace professional medical advice.
        </Typography>
      </CardContent>
    </Card>
  );
};

// Main component
export default function ResultsDisplay({ extractedData, onConfirmContinue, onStepChange }) {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('review'); // 'review' | 'intro' | 'predicted' | 'insurance'
  const [insuranceDiseases, setInsuranceDiseases] = useState([]);
  // no navigation; flow is contained within Dashboard

  const categorizedData = useMemo(() => {
    if (!extractedData) return {};

    // init empty buckets
    const buckets = Object.keys(DATA_CATEGORIES).reduce((acc, cat) => {
      acc[cat] = {};
      return acc;
    }, {});

    // distribute only into known categories
    Object.entries(extractedData).forEach(([key, val]) => {
      if (key === 'Condition' || val == null) return;
      for (const [cat, params] of Object.entries(DATA_CATEGORIES)) {
        if (params.includes(key)) {
          buckets[cat][key] = val;
          break;
        }
      }
    });

    // drop empty categories
    return Object.entries(buckets).reduce((acc, [cat, vals]) => {
      if (Object.keys(vals).length > 0) acc[cat] = vals;
      return acc;
    }, {});
  }, [extractedData]);

  const getPredictions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await axios.post('/api/predict', extractedData);
      setPredictions(resp.data);
      setStep('predicted');
      onStepChange && onStepChange(1);
    } catch (e) {
      setError(`Error getting predictions: ${(e.response?.data?.message) || e.message}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [extractedData]);

  if (!extractedData) return null;

  return (
    <div>
      {/* Step 1: Review extracted data with Confirm & Continue */}
      {step === 'review' && (
        <Card variant="outlined">
          <CardHeader title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <InsightsIcon color="primary" />
              <Typography variant="h6">Extracted Medical Data</Typography>
            </Stack>
          } subheader="Review and confirm the extracted parameters" />
          <CardContent>
            {Object.entries(categorizedData).map(([cat, vals]) => (
              <ParameterGroup key={cat} category={cat} values={vals} />
            ))}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1.5} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  setStep('intro');
                  onConfirmContinue && onConfirmContinue(); // signal parent to hide upload card
                  onStepChange && onStepChange(1);
                }}
              >
                Confirm
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Intro card to identify risks */}
      {step === 'intro' && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#f3e8ff', display: 'grid', placeItems: 'center' }}>
                  <BoltIcon sx={{ color: '#7c3aed' }} />
                </Box>
                <Box>
                  <Typography fontWeight={700}>Disease Risk Prediction</Typography>
                  <Typography variant="body2" color="text.secondary">AI-powered analysis of potential health risks</Typography>
                </Box>
              </Stack>
              <Button
                variant="contained"
                onClick={getPredictions}
                disabled={loading}
                startIcon={<BoltIcon />}
                sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
              >
                {loading ? 'Analyzing…' : 'Identify Risks'}
              </Button>
            </Stack>
            
            {!predictions && (
              <Box sx={{ textAlign: 'center', color: '#64748b', py: 8 }}>
                
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Click "Identify Risks" to analyze health data</Typography>
                <Typography variant="body2">Our AI will predict potential disease risks based on lab results</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Risk results with progress bars and next actions */}
      {step === 'predicted' && predictions && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Identified Health Risks</Typography>
            <Typography variant="caption" color="text.secondary">Predicted disease risks with probability scores</Typography>
            <Divider sx={{ my: 2 }} />

            <Stack spacing={2}>
              {(predictions.risk_scores || []).slice(0, 6).map((item, idx) => {
                const pct = item.risk_percent ?? 0;
                const level = pct >= 70 ? 'high' : pct >= 40 ? 'moderate' : 'low';
                const levelColor = level === 'high' ? '#ef4444' : level === 'moderate' ? '#f59e0b' : '#22c55e';
                const levelBg = level === 'high' ? '#fee2e2' : level === 'moderate' ? '#fef3c7' : '#dcfce7';
                return (
                  <Box key={idx} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 1.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography fontWeight={600}>{item.disease}</Typography>
                      <Typography variant="caption" color="text.secondary">Risk Score</Typography>
                    </Stack>
                    <Chip size="small" label={level} sx={{ mt: 0.5, bgcolor: levelBg, color: levelColor, textTransform: 'capitalize', width: 'fit-content' }} />
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress variant="determinate" value={pct} sx={{
                        height: 8, borderRadius: 9999,
                        '& .MuiLinearProgress-bar': { bgcolor: levelColor }
                      }} />
                      <Typography variant="caption" color="text.secondary">{Math.round(pct)}%</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {/* Placeholder insight line */}
                      Based on your lab values
                    </Typography>
                  </Box>
                );
              })}
            </Stack>

            <Box sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', p: 2, borderRadius: 2, mt: 2 }}>
              <Typography variant="body2" color="primary.dark"><strong>High Risk Factors Detected</strong></Typography>
              <Typography variant="caption" color="text.secondary">Some conditions require attention and insurance coverage</Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={() => setStep('review')}>Back to Upload</Button>
              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  const diseases = (predictions?.predicted_with_risk?.map((x) => x.disease) || predictions?.predictions || []).filter(Boolean);
                  setInsuranceDiseases(diseases);
                  setStep('insurance');
                  onStepChange && onStepChange(2);
                }}
              >
                Get Insurance Plan
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      )}

      {/* Also keep compact predictions chip card if present (optional) */}
      {step === 'predicted' && predictions && <PredictionResults predictions={predictions} />}

      {/* Step 4: Embedded Insurance Recommendations (Dashboard only) */}
      {step === 'insurance' && (
        <Box sx={{ mt: 2 }}>
          <ShowRecommendations embedded initialDiseases={insuranceDiseases} />
        </Box>
      )}
    </div>
  );
}
