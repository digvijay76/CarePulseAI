import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  TextField,
  Chip,
  Stack,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

function asArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return [input];
}

function formatINR(amount) {
  if (!amount || isNaN(amount)) return '—';
  try {
    return '₹' + Number(amount).toLocaleString('en-IN');
  } catch {
    return '₹' + amount;
  }
}

// Parse strings like "Up to SI" | "50% of SI" | "25% of SI each" into a fraction of Sum Insured
function parseCapFraction(cap) {
  if (!cap || typeof cap !== 'string') return 1;
  const s = cap.toLowerCase();
  if (s.includes('up to si')) return 1;
  const m = s.match(/(\d+)\s*%/);
  if (m) {
    const pct = Number(m[1]);
    if (!isNaN(pct)) return Math.min(1, Math.max(0, pct / 100));
  }
  return 1; // default assume full SI if we can't parse
}

// Choose a plan's display SI (prefer max, else min)
function planSI(plan) {
  const max = plan?.sum_assured?.max;
  const min = plan?.sum_assured?.min;
  return typeof max === 'number' ? max : (typeof min === 'number' ? min : 0);
}

// Compute a recommended coverage baseline from highest treatment cost
function recommendedCoverage(highestByDisease, selected) {
  const costs = (selected || []).map((d) => Number(highestByDisease?.[d]?.highest_treatment_cost_in_inr || 0));
  const base = costs.length ? Math.max(...costs) : 0;
  if (!base) return 0;
  const buffer = 0.3; // 30% buffer
  const inflation = 0.10; // 10% per year
  const years = 3;
  return Math.round(base * (1 + buffer) * Math.pow(1 + inflation, years));
}

// Effective coverage for the selected diseases considering disease caps
function effectiveCoverageForSelection(plan, selectedDiseases, fallbackBase) {
  const si = planSI(plan) || fallbackBase || 0;
  if (!si) return 0;
  const caps = (selectedDiseases || []).map((d) => {
    const info = plan?.disease_coverage?.[d];
    // also support API shape where caps are under plan.coverage[disease]
    const apiInfo = plan?.coverage?.[d];
    const cap = (info && info.cap_amount) || (apiInfo && apiInfo.cap_amount) || 'Up to SI';
    return parseCapFraction(cap);
  });
  const limiting = caps.length ? Math.min(...caps) : 1;
  return Math.round(si * limiting);
}

const DEFAULT_SUGGESTIONS = [
  'Anemia','Diabetes','Hypertension','Asthma','Thyroid','Tuberculosis','Arthritis','Cancer'
];

export default function ShowRecommendations({ embedded = false, initialDiseases = [] }) {
  const [query, setQuery] = useState('');
  const [diseases, setDiseases] = useState(initialDiseases?.length ? initialDiseases : ['Anemia']);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const highestByDisease = results?.highest_treatment_cost_by_disease || {};

  const removeDisease = (d) => setDiseases((prev) => prev.filter((x) => x !== d));
  const addDisease = (d) => {
    const clean = String(d).trim();
    if (clean && !diseases.includes(clean)) setDiseases((prev) => [...prev, clean]);
    setQuery('');
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const payload = { diseases };
      const { data } = await axios.post('/api/plan', payload);
      setResults(data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  // Compute plan stats for UI badges and ranking
  const rankedPlans = useMemo(() => {
    const list = results?.insurance_policies || [];
    const wanted = diseases.map((d) => d.toLowerCase());
    const scoreFor = (plan) => {
      const recBase = recommendedCoverage(highestByDisease, diseases);
      const covered = Object.keys(plan.coverage || {}).map((c) => c.toLowerCase());
      const matches = wanted.filter((d) => covered.includes(d));
      const matchPct = wanted.length ? Math.round((matches.length / wanted.length) * 100) : 0;
      const effectiveCoverage = effectiveCoverageForSelection(plan, diseases, recBase);
      const coverageAmount = effectiveCoverage;
      const coverageScore = Math.min(99, Math.max(65, Math.round(65 + (matches.length / Math.max(1, wanted.length)) * 35)));
      return {
        matchPct,
        coverageAmount,
        effectiveCoverage,
        coverageScore,
        matches,
        covered,
      };
    };

    return list
      .map((p) => ({ plan: p, stats: scoreFor(p) }))
      .sort((a, b) => {
        if (b.stats.matchPct !== a.stats.matchPct) return b.stats.matchPct - a.stats.matchPct;
        return b.stats.coverageAmount - a.stats.coverageAmount;
      });
  }, [results, diseases]);

  // keep diseases in sync when embedded initialDiseases changes
  useEffect(() => {
    if (embedded) {
      setDiseases(initialDiseases?.length ? initialDiseases : []);
    }
  }, [embedded, initialDiseases]);

  const Wrapper = embedded ? Box : Container;

  return (
    <Wrapper {...(embedded ? { sx: { py: 0 } } : { maxWidth: 'lg', sx: { py: 4 } })}>
      {!embedded && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Patient Risk & Insurance Analysis
          </Typography>
          <Typography color="text.secondary">
            Complete your health risk analysis in 3 simple steps
          </Typography>
        </Box>
      )}

      {!embedded && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                label="Add disease"
                placeholder="e.g., Anemia"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addDisease(query); }}
                sx={{ flexGrow: 1 }}
              />
              <Button variant="contained" onClick={() => addDisease(query)}>Add</Button>
              <Button variant="contained" color="primary" onClick={submit} disabled={loading}>
                {loading ? 'Finding plans…' : 'Recommend Insurance'}
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
              {diseases.map((d) => (
                <Chip key={d} label={d} onDelete={() => removeDisease(d)} color="primary" variant="outlined" />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
              {DEFAULT_SUGGESTIONS.map((d) => (
                <Chip key={d} label={d} onClick={() => addDisease(d)} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card variant="outlined" sx={{ mb: 3, borderColor: 'error.light' }}>
          <CardContent>
            <Typography color="error.main">{error}</Typography>
          </CardContent>
        </Card>
      )}

      {/* Empty state before recommendations */}
      {!results && !loading && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ p: 1, bgcolor: 'primary.50', borderRadius: 1, color: 'primary.main', display: 'inline-flex' }}>
                  <ShieldOutlinedIcon />
                </Box>
                <Box>
                  <Typography fontWeight={700}>Recommended Insurance Plans</Typography>
                  <Typography variant="body2" color="text.secondary">Find the best insurance coverage for your health risks</Typography>
                </Box>
              </Stack>
              <Button variant="contained" onClick={submit} disabled={loading} startIcon={<ShieldOutlinedIcon />}>
                Recommend Insurance
              </Button>
            </Stack>
            <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 6 }}>
              <ShieldOutlinedIcon sx={{ fontSize: 48, color: 'action.disabled' }} />
              <Typography sx={{ mt: 1 }}>Click "Recommend Insurance" to find suitable plans</Typography>
              <Typography variant="body2">We\'ll match your health risks with the best insurance options</Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {results && (
        <Box>
          {/* Featured Recommended Plan */}
          {rankedPlans[0] && (
            <Card
              sx={{
                mb: 3,
                borderColor: 'primary.light',
                bgcolor: 'rgba(33, 150, 243, 0.06)',
              }}
              component={motion.div}
              whileHover={{ y: -2 }}
            >
              <CardContent>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Chip size="small" icon={<StarBorderIcon />} label="Recommended for You" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }} />
                    </Stack>
                    <Typography variant="h6" fontWeight={700}>{rankedPlans[0].plan.policy_name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{rankedPlans[0].plan.company_name || 'HealthGuard Insurance'}</Typography>

                    <Grid container spacing={2} sx={{ mb: 1 }}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, bgcolor: 'common.white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary">Coverage Amount</Typography>
                          <Typography fontWeight={700}>
                            {formatINR(rankedPlans[0].stats.effectiveCoverage)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, bgcolor: 'common.white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary">Coverage Score</Typography>
                          <Typography fontWeight={700}>{rankedPlans[0].stats.coverageScore}%</Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Diseases Covered:</Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {Object.keys(rankedPlans[0].plan.coverage || {}).map((c) => (
                          <Chip key={c} label={c} size="small" />
                        ))}
                      </Stack>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Key Features:</Typography>
                      <Stack spacing={0.5}>
                        <Typography variant="body2"><CheckCircleRoundedIcon color="success" fontSize="small" style={{ verticalAlign: 'middle' }} />{' '}Zero waiting period</Typography>
                        <Typography variant="body2"><CheckCircleRoundedIcon color="success" fontSize="small" style={{ verticalAlign: 'middle' }} />{' '}Free health checkups</Typography>
                        <Typography variant="body2"><CheckCircleRoundedIcon color="success" fontSize="small" style={{ verticalAlign: 'middle' }} />{' '}Cashless hospitalization</Typography>
                      </Stack>
                    </Box>
                  </Box>
                  <Box sx={{ minWidth: { xs: '100%', md: 260 }, textAlign: { xs: 'left', md: 'right' } }}>
                    <Chip label={`${rankedPlans[0].stats.matchPct}% Match`} size="small" sx={{ bgcolor: 'success.light', color: 'success.dark' }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Highest treatment cost summary */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Estimated highest treatment cost</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {asArray(results.diseases).map((d) => {
                  const item = highestByDisease[d];
                  return (
                    <Chip
                      key={d}
                      label={`${d}: ${item?.highest_treatment_cost_in_inr ? '₹' + item.highest_treatment_cost_in_inr.toLocaleString() : 'N/A'}`}
                      color="secondary"
                      variant="outlined"
                    />
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          {/* Other available plans */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6">Other Available Plans</Typography>
            
          </Stack>

          <Grid container spacing={2}>
            {rankedPlans.slice(1, 3).map(({ plan, stats }, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                <Card variant="outlined" component={motion.div} whileHover={{ y: -3 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box>
                        <Typography fontWeight={700}>{plan.policy_name}</Typography>
                        <Typography variant="body2" color="text.secondary">{plan.company_name || '—'}</Typography>
                      </Box>
                      <Chip label={`${stats.matchPct}% Match`} size="small" sx={{ bgcolor: 'grey.100' }} />
                    </Stack>

                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Coverage Amount</Typography>
                        <Typography>{formatINR(stats.effectiveCoverage)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Coverage Score</Typography>
                        <Typography>{stats.coverageScore}%</Typography>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">Covers:</Typography>
                      <Typography variant="body2">{stats.matches.length ? stats.matches.join(', ') : '—'}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {(!results.insurance_policies || results.insurance_policies.length === 0) && (
            <Typography color="text.secondary">No matching policies found for the selected diseases.</Typography>
          )}
        </Box>
      )}
    </Wrapper>
  );
}
