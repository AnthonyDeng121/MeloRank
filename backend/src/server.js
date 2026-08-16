const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('MeloRank Backend API is running!');
});

// QQ Music image proxy route
app.get('/api/proxy/qqmusic/image', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid URL parameter' });
    }
    
    // Only allow QQ Music image URLs
    if (!url.includes('y.qq.com') && !url.includes('y.gtimg.cn')) {
      return res.status(403).json({ error: 'Only QQ Music image URLs are allowed' });
    }
    
    // Fetch the image from QQ Music
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Get the content type and send the image data
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.buffer();
    
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});