import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';

const MAX_SIZE_MB = 20;

export default function PolicyExtraction() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // extracted JSON
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const inputRef = useRef(null);
  

  const valid = useMemo(() => !!file && file.type === 'application/pdf' && file.size <= MAX_SIZE_MB * 1024 * 1024, [file]);

  const onSelect = (f) => {
    if (!f) return;
    setError('');
    if (f.type !== 'application/pdf') {
      setError('Please select a PDF file (.pdf).');
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_SIZE_MB} MB.`);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) onSelect(f);
  }, []);

  const onBrowse = () => inputRef.current?.click();

  const extract = async () => {
    if (!valid) return;
    setExtracting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post('/api/policy/extract', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
      setSnack('Extraction complete');
    } catch (e) {
      // Graceful fallback: keep a stub structure so UI can be reviewed before backend is ready
      const message = e.response?.data?.error || e.message;
      setError(`Extraction failed: ${message}`);
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError('');
    try {
      await axios.post('/api/policy/save', result);
      setSnack('Saved to database');
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setSnack('JSON copied');
    } catch {
      setSnack('Copy failed');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Insurance Policy Extraction
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Upload a policy PDF, extract structured details, then save to your database.
      </Typography>


      <Card variant="outlined">
        <CardHeader title="Upload Policy PDF" subheader={`PDF • Max ${MAX_SIZE_MB} MB`} />
        <CardContent>
          <Box
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              bgcolor: dragOver ? 'primary.50' : 'transparent',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <PictureAsPdfOutlinedIcon sx={{ fontSize: 42, color: 'text.secondary' }} />
            <Typography sx={{ mt: 1 }}>Drag & drop your PDF here</Typography>
            <Typography variant="body2" color="text.secondary">or</Typography>
            <Button sx={{ mt: 1 }} variant="outlined" startIcon={<UploadFileIcon />} onClick={onBrowse}>
              Browse PDF
            </Button>
            <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => onSelect(e.target.files?.[0])} />
            {file && (
              <Chip sx={{ mt: 2 }} label={`${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`} />
            )}
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={extract} disabled={!valid || extracting}>
              {extracting ? <CircularProgress size={18} sx={{ mr: 1, color: 'white' }} /> : null}
              {extracting ? 'Extracting…' : 'Extract'}
            </Button>
            <Button variant="outlined" color="secondary" disabled={!result} onClick={save} startIcon={<SaveOutlinedIcon />}>
              {saving ? 'Saving…' : 'Save to Database'}
            </Button>
          </Stack>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

          {result && (
            <Box sx={{ mt: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Extracted JSON</Typography>
                <Tooltip title="Copy JSON">
                  <span>
                    <IconButton onClick={copyJson} disabled={!result}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, bgcolor: '#0b1020', color: '#e6edf3', maxHeight: 420, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace', fontSize: 13 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(result, null, 2)}</pre>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={!!snack}
        autoHideDuration={2400}
        onClose={() => setSnack('')}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Container>
  );
}
