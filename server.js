// Zero-dependency server: no npm install needed. Run: npm start  (or: node server.js)
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000, ROOT = __dirname, PUB = path.join(ROOT, 'public');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const types = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.js': 'text/javascript' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  // Quiz list: correct answers are NEVER sent to the browser
  if (req.method === 'GET' && url === '/api/quizzes') {
    return send(res, 200, read('quizzes.json').map(q => ({
      id: q.id, title: q.title, youtubeId: q.youtubeId, thumbnail: q.thumbnail, comingSoon: !!q.comingSoon,
      questions: q.questions.map(({ text, options }) => ({ text, options }))
    })));
  }
  // Grading happens on the server; only the score goes back
  if (req.method === 'POST' && url === '/api/submit') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const { quizId, name, answers } = JSON.parse(body);
        const quiz = read('quizzes.json').find(q => q.id === quizId);
        if (!quiz || !Array.isArray(answers)) return send(res, 400, { error: 'Invalid submission' });
        const total = quiz.questions.length;
        const correct = quiz.questions.filter((q, i) => answers[i] === q.answer).length;
        const percent = Math.round(correct / total * 100);
        const results = read('results.json');
        results.push({ name: String(name || 'Anonymous').slice(0, 40), quizId, correct, total, percent, date: new Date().toISOString() });
        fs.writeFileSync(path.join(ROOT, 'data', 'results.json'), JSON.stringify(results, null, 2));
        send(res, 200, { correct, total, percent });
      } catch (e) { send(res, 400, { error: 'Invalid submission' }); }
    });
    return;
  }
  const file = path.join(PUB, url === '/' ? 'index.html' : url);
  if (!file.startsWith(PUB)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (e, d) => {
    if (e) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(PORT, () => console.log('TechRiz Academy running at http://localhost:' + PORT));
