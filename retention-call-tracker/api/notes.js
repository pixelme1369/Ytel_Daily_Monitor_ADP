const { put, get } = require('@vercel/blob');

// One JSON blob holding every phone's note: { "<phone>": { text, updatedAt } }. A single small
// shared file (not one blob per phone) since note volume here is tiny (one row per flagged lead,
// leads under 10 days in status) -- keeps this to one read + one read-modify-write per save instead
// of needing a real database. Same @vercel/blob usage pattern as the root api/upload.js/api/latest.js.
const NOTES_KEY = 'retention-notes.json';
// Known accepted limitation: two reps saving notes for two different phones at nearly the same
// moment can race (read-modify-write, not atomic) and one save can silently overwrite the other's.
// Acceptable at this team's scale; would need a real per-key store to close entirely.
const MAX_NOTE_LEN = 2000;

async function readNotes() {
  try {
    const result = await get(NOTES_KEY, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return {};
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(text || '{}');
  } catch (e) {
    return {};
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const notes = await readNotes();
    res.status(200).json({ notes });
    return;
  }

  if (req.method === 'POST') {
    const { phone, text } = req.body || {};
    if (!phone) {
      res.status(400).json({ error: 'Missing phone' });
      return;
    }
    const notes = await readNotes();
    const trimmed = String(text || '').slice(0, MAX_NOTE_LEN);
    if (trimmed) {
      notes[phone] = { text: trimmed, updatedAt: new Date().toISOString() };
    } else {
      // Empty save clears the note entirely rather than storing a blank entry.
      delete notes[phone];
    }
    try {
      await put(NOTES_KEY, JSON.stringify(notes), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save note: ' + e.message });
      return;
    }
    res.status(200).json({ ok: true, updatedAt: notes[phone] ? notes[phone].updatedAt : null });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
