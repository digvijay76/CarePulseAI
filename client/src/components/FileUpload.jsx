import { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Box, Card, CardContent, CardHeader, Typography, Button, Alert, LinearProgress, Stack } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

function FileUpload({ onDataExtracted }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.type === 'application/pdf' || 
        selectedFile.type.startsWith('image/'))) {
      setFile(selectedFile);
      setError('');
    } else {
      setFile(null);
      setError('Please select a PDF or image file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('report', file);
    
    setUploading(true);
    setProgress(0);
    
    try {
      const response = await axios.post('/api/extract', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        }
      });
      
      setUploading(false);
      onDataExtracted(response.data);
    } catch (err) {
      setUploading(false);
      setError('Error processing file: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card variant="outlined" component={motion.div} whileHover={{ y: -3 }}>
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <CloudUploadIcon color="primary" />
              <Typography variant="h6">Upload Medical / Lab Report</Typography>
            </Stack>
          }
          subheader="Upload your lab report to begin analysis"
        />
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          )}
          <Box component="form" onSubmit={handleSubmit}>
            <Box
              sx={{
                border: '1px dashed #94a3b8',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: file ? '#ecfdf5' : '#f8fafc',
                cursor: uploading ? 'not-allowed' : 'pointer',
                mb: 2,
              }}
              onClick={() => !uploading && document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,image/*"
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {!file ? (
                <>
                  <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 1 }}>
                    Drag & drop your file here or click to browse
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supported formats: PDF, JPG, PNG
                  </Typography>
                </>
              ) : (
                <>
                  <CheckCircleOutlineIcon sx={{ fontSize: 40, color: 'success.main' }} />
                  <Typography variant="subtitle2" sx={{ mt: 1 }} color="success.main">
                    File uploaded successfully
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
                    <InsertDriveFileIcon color="action" />
                    <Typography variant="body2" color="primary.main" fontWeight={600}>{file.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Typography>
                  </Stack>
                  <Button size="small" sx={{ mt: 1 }} onClick={(e) => { e.preventDefault(); document.getElementById('file-input').click(); }}>
                    Upload Different File
                  </Button>
                </>
              )}
            </Box>
            {uploading && (
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">Uploading…</Typography>
                  <Typography variant="body2">{progress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            )}
            <Button type="submit" variant="contained" size="large" disabled={!file || uploading}>
              {uploading ? 'Processing…' : 'Extract Data'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default FileUpload;
