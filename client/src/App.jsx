import { useState } from 'react';
import { motion } from 'framer-motion';
import FileUpload from './components/FileUpload';
import ResultsDisplay from './components/ResultsDisplay';
import './styles/App.css';
import { MdHealthAndSafety } from 'react-icons/md';
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
// ShowRecommendations is embedded within ResultsDisplay when needed
import PolicyExtraction from './pages/PolicyExtraction';
import StepProgress from './components/StepProgress';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

function NavLinkButton({ to, label, icon }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Button
      component={Link}
      to={to}
      startIcon={icon}
      disableElevation
      sx={{
        ml: 1,
        textTransform: 'none',
        borderRadius: '9999px',
        px: 1.5,
        py: 0.75,
        fontWeight: 600,
        bgcolor: isActive ? '#eaf2ff' : 'transparent',
        color: isActive ? '#2563eb' : '#0f172a',
        border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
        '&:hover': {
          bgcolor: isActive ? '#e0ecff' : '#f1f5f9',
          borderColor: isActive ? '#bfdbfe' : '#e5e7eb',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <span>{label}</span>
        {isActive && <Box sx={{ width: 6, height: 6, bgcolor: '#2563eb', borderRadius: '50%' }} />}
      </Box>
    </Button>
  );
}

function Home() {
  const [extractedData, setExtractedData] = useState(null);
  const [hideUpload, setHideUpload] = useState(false);
  const [uiStep, setUiStep] = useState(0); // 0: Upload, 1: Identify Risks, 2: Get Insurance
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Patient Risk & Insurance Analysis
          </Typography>
          <Typography color="text.secondary">
            Complete your health risk analysis in 3 simple steps
          </Typography>
        </Box>
      <StepProgress active={uiStep} />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="dashboard-content">
          {!hideUpload && <FileUpload onDataExtracted={(data) => { setExtractedData(data); setUiStep(0); }} />}
          {extractedData && (
            <ResultsDisplay
              extractedData={extractedData}
              onConfirmContinue={() => { setHideUpload(true); setUiStep(1); }}
              onStepChange={(s) => setUiStep(s)}
            />
          )}
        </div>
      </motion.div>
    </Container>
  );
}

function App() {
  return (
    <div className="app">
      <AppBar position="sticky" elevation={0} color="inherit" sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: 'white' }}>
        <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <Box sx={{ width: 28, height: 28, bgcolor: '#2563eb', borderRadius: '8px', display: 'grid', placeItems: 'center' }}>
              <MdHealthAndSafety size={18} color="#ffffff" />
            </Box>
            <Typography variant="h6" fontWeight={700}>CarePulse AI</Typography>
          </Box>
          <NavLinkButton to="/" label="Dashboard" icon={<DashboardRoundedIcon sx={{ fontSize: 18 }} />} />
          <NavLinkButton to="/recommendations" label="Insurance" icon={<ShieldOutlinedIcon sx={{ fontSize: 18 }} />} />
        </Toolbar>
      </AppBar>

      <Routes>
        <Route path="/" element={<Home />} />
        {/* Insurance tab: policy PDF extraction and save to DB */}
        <Route path="/recommendations" element={<PolicyExtraction />} />
      </Routes>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <MdHealthAndSafety className="footer-logo-img" />
              <span>CarePulse AI</span>
            </div>
            <p className="copyright">© 2025 CarePulse AI — Smart Health Insight & Policy Recommender | All Rights Reserved</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
