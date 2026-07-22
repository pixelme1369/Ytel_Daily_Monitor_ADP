const { get } = require('@vercel/blob');

module.exports = async (req, res) => {
  try {
    const result = await get('latest.xlsx', { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      res.status(404).json({ error: 'No shared file uploaded yet' });
      return;
    }
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.status(200).send(buf);
  } catch (e) {
    res.status(404).json({ error: 'No shared file uploaded yet' });
  }
};
