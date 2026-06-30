import { Box, Stack, Typography, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const steps = [
  { title: 'Upload Lab Report', subtitle: 'Upload medical report' },
  { title: 'Identify Risks', subtitle: 'Analyze health risks' },
  { title: 'Get Insurance', subtitle: 'Find suitable plans' },
];

function StepCircle({ index, state }) {
  // state: 'done' | 'active' | 'todo'
  const bg = state === 'done' ? '#dcfce7' : state === 'active' ? '#2563eb' : '#e2e8f0';
  const color = state === 'done' ? '#16a34a' : state === 'active' ? '#ffffff' : '#475569';
  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        bgcolor: bg,
        color,
        fontWeight: 700,
      }}
    >
      {state === 'done' ? <CheckIcon fontSize="small" /> : index + 1}
    </Box>
  );
}

export default function StepProgress({ active = 0, sx }) {
  return (
    <Box sx={{ py: 3, ...sx }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
        {steps.map((s, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'todo';
          return (
            <Stack key={s.title} direction="row" alignItems="center" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                <StepCircle index={i} state={state} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={700} noWrap>{s.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>{s.subtitle}</Typography>
                </Box>
              </Stack>
              {i < steps.length - 1 && (
                <ArrowForwardIosIcon sx={{ color: '#94a3b8', fontSize: 18, display: { xs: 'none', md: 'inline-flex' } }} />
              )}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
