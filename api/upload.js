const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { password, dataBase64 } = req.body || {};
  if (!process.env.UPLOAD_PASSWORD) {
    res.status(500).json({ error: 'Server not configured: UPLOAD_PASSWORD is not set' });
    return;
  }
  if (!password || password !== process.env.UPLOAD_PASSWORD) {
    res.status(401).json({ error: 'Wrong password' });
    return;
  }
  if (!dataBase64) {
    res.status(400).json({ error: 'No file data provided' });
    return;
  }
  try {
    const buf = Buffer.from(dataBase64, 'base64');
    const blob = await put('latest.xlsx', buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/octet-stream',
    });
    res.status(200).json({ ok: true, url: blob.url, size: buf.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
