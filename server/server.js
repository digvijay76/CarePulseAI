const express = require('express');
const fileUpload = require('express-fileupload');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';

// Load env vars from server/.env if present
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Database helper (mongoose)
const db = require('./db');

// Middleware
app.use(express.json());
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max file size for policy PDFs
}));

// Simple API request logger to help debug 404s
app.use('/api', (req, _res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  next();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Health endpoint to quickly check server and DB state
app.get('/health', (req, res) => {
  try {
    const state = (db && db.mongoose && db.mongoose.connection) ? db.mongoose.connection.readyState : null;
    const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    res.json({ status: 'ok', db: stateMap[state] || state });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// API endpoint to extract data from uploaded file
app.post('/api/extract', async (req, res) => {
  try {
    if (!req.files || !req.files.report) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.files.report;
    const filePath = path.join(uploadsDir, file.name);
    
    // Save the file
    await file.mv(filePath);
    
    // Run Python extraction script
    const pythonProcess = spawn(PYTHON_BIN, ['extraction.py', filePath]);
    
    let extractedData = '';
    pythonProcess.stdout.on('data', (data) => {
      extractedData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          return reject(res.status(500).json({ message: 'Error extracting data from file' }));
        }
        
        try {
          const jsonData = JSON.parse(extractedData);
          resolve(res.json(jsonData));
          
          // Clean up the uploaded file
          fs.unlinkSync(filePath);
        } catch (err) {
          reject(res.status(500).json({ message: 'Error parsing extracted data' }));
        }
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// Lightweight GET to verify the policy extractor route exists
app.get('/api/policy/extract', (req, res) => {
  res.json({ ok: true, message: 'Use POST with multipart/form-data field "file" to extract policy JSON.' });
});

// -------------------- Policy PDF extraction (Gemini) --------------------
app.post('/api/policy/extract', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }

    const pdf = req.files.file;
    const safeName = `${Date.now()}_${pdf.name.replace(/[^\w.\-]/g, '_')}`;
    const filePath = path.join(uploadsDir, safeName);
    await pdf.mv(filePath);

    const python = spawn(PYTHON_BIN, ['policy_extraction.py', filePath], {
      cwd: __dirname,
      env: { ...process.env },
    });

    let out = '';
    let err = '';
    python.stdout.on('data', (d) => (out += d.toString()));
    python.stderr.on('data', (d) => (err += d.toString()));

    python.on('close', (code) => {
      try { fs.existsSync(filePath) && fs.unlinkSync(filePath); } catch {}
      if (code !== 0) {
        console.error('policy_extraction.py failed:', code, err);
        return res.status(500).json({ error: 'Extraction failed', details: err });
      }
      try {
        const json = JSON.parse(out);
        res.json(json);
      } catch (e) {
        console.error('Parse error from policy_extraction.py:', e, 'out:', out);
        res.status(500).json({ error: 'Invalid JSON from extractor', details: e.message, raw: out });
      }
    });
  } catch (e) {
    console.error('Exception in /api/policy/extract:', e);
    res.status(500).json({ error: e.message });
  }
});

// -------------------- Save extracted policy JSON to MongoDB --------------------
app.post('/api/policy/save', async (req, res) => {
  try {
    const conn = db.mongoose.connection;
    if (!conn || conn.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing JSON body' });

    const items = Array.isArray(payload) ? payload : [payload];

    const col = conn.db.collection('diseases'); // existing collection used by /api/plan
    const ops = items.map((doc) => ({
      updateOne: {
        filter: {
          $or: [
            doc.policy_id ? { policy_id: doc.policy_id } : null,
            doc.uin ? { uin: doc.uin } : null,
          ].filter(Boolean),
        },
        update: { $set: { ...doc, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        upsert: true,
      },
    }));

    const result = ops.length ? await col.bulkWrite(ops, { ordered: false }) : { nUpserted: 0, nModified: 0 };
    res.json({ ok: true, result });
  } catch (e) {
    console.error('Error in /api/policy/save:', e);
    res.status(500).json({ error: e.message });
  }
});

// API endpoint to predict diseases
app.post('/api/predict', (req, res) => {
  try {
    const labData = req.body;
    // Write data to temporary file
    const tempDataPath = path.join(uploadsDir, `temp_${Date.now()}.json`);
    fs.writeFileSync(tempDataPath, JSON.stringify(labData));

    // Run Python prediction script
      const pythonProcess = spawn(PYTHON_BIN, ['prediction.py', tempDataPath]);

    let predictionData = '';
    let pythonError = '';
    pythonProcess.stdout.on('data', (data) => {
      predictionData += data.toString();
    });
    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
      console.error(`Python Error: ${data}`);
    });

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        // Clean up temp file
        if (fs.existsSync(tempDataPath)) {
          fs.unlinkSync(tempDataPath);
        }

        if (code !== 0) {
          console.error(`Python process exited with code ${code}. Stderr: ${pythonError}`);
          return reject(res.status(500).json({ message: 'Error predicting diseases', error: pythonError }));
        }

        try {
          const jsonData = JSON.parse(predictionData);
          resolve(res.json(jsonData));
        } catch (err) {
          console.error('Error parsing prediction data:', err, 'Raw output:', predictionData);
          reject(res.status(500).json({ message: 'Error parsing prediction data', error: err.message, raw: predictionData }));
        }
      });
    }).catch((err) => {
      // Catch any unhandled promise rejections
      console.error('Unhandled promise rejection in /api/predict:', err);
    });
  } catch (err) {
    console.error('Exception in /api/predict:', err);
    return res.status(500).json({ message: err.message });
  }
});

// -------------------- Insurance recommendation endpoint --------------------
app.post('/api/plan', async (req, res) => {
  try {
    const body = req.body || {};
    // Accept either { disease: "Anemia" } or { diseases: ["Anemia","Diabetes"] }
    let diseases = [];
    if (Array.isArray(body.diseases)) {
      diseases = body.diseases.map((d) => String(d).trim()).filter(Boolean);
    } else if (typeof body.disease === 'string') {
      diseases = [body.disease.trim()].filter(Boolean);
    }

    if (!diseases.length) {
      return res.status(400).json({ error: 'Provide disease (string) or diseases (array of strings)' });
    }

    // Ensure DB is connected
    const conn = db.mongoose.connection;
    if (!conn || conn.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    // Collections (from the "Disease" database as shown in screenshots)
    const diseasesCol = conn.db.collection('diseases');
    const costCol = conn.db.collection('cost');

    // 1) Find insurance policies that cover ANY of the provided diseases
    const orConds = diseases.map((d) => ({ [`disease_coverage.${d}`]: { $exists: true } }));
    const insuranceDocs = await diseasesCol
      .find(
        { $or: orConds },
        {
          projection: {
            _id: 0,
            policy_id: 1,
            company_name: 1,
            policy_name: 1,
            uin: 1,
            disease_coverage: 1,
          },
        }
      )
      .toArray();

    // Map coverage to only requested diseases per policy
    const insurance_policies = insuranceDocs.map((doc) => {
      const coverage = {};
      for (const d of diseases) {
        if (doc.disease_coverage && Object.prototype.hasOwnProperty.call(doc.disease_coverage, d)) {
          coverage[d] = doc.disease_coverage[d];
        }
      }
      return {
        policy_id: doc.policy_id,
        policy_name: doc.policy_name,
        company_name: doc.company_name,
        uin: doc.uin,
        coverage,
      };
    });

    // 2) Highest treatment cost for each disease
    const costs = await costCol
      .find(
        { disease: { $in: diseases } },
        { projection: { _id: 0, disease: 1, highest_treatment_cost_in_inr: 1 } }
      )
      .toArray();

    const highest_treatment_cost_by_disease = {};
    for (const c of costs) {
      const prev = highest_treatment_cost_by_disease[c.disease];
      if (!prev || (c.highest_treatment_cost_in_inr ?? 0) > (prev.highest_treatment_cost_in_inr ?? 0)) {
        highest_treatment_cost_by_disease[c.disease] = c;
      }
    }
    for (const d of diseases) {
      if (!(d in highest_treatment_cost_by_disease)) {
        highest_treatment_cost_by_disease[d] = null;
      }
    }

    // 3) Build response
    res.json({
      diseases,
      policy_count: insurance_policies.length,
      insurance_policies,
      highest_treatment_cost_by_disease,
    });
  } catch (error) {
    console.error('Error in /api/plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Serve Vite build files
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Prefer the server to start even if DB is down so /health is reachable.
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

db.connect()
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection failed (server still running):', err.message || err);
  });
