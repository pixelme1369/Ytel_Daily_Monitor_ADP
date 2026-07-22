const { list } = require('@vercel/blob');

module.exports = async (req, res) => {
  try {
    const { blobs } = await list({ prefix: 'latest.xlsx', limit: 1 });
    if (!blobs || !blobs.length) {
      res.status(404).json({ error: 'No shared file uploaded yet' });
      return;
    }
    const upstream = await fetch(blobs[0].url);
    if (!upstream.ok) {
      res.status(502).json({ error: 'Failed to fetch stored file' });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
