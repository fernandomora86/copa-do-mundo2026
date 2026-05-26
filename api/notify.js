const webpush = require('web-push');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    }),
  });
}
const db = admin.firestore();

webpush.setVapidDetails(
  'mailto:fmgaspari@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function calcPontos(p1, p2, r1, r2) {
  p1 = parseInt(p1, 10); p2 = parseInt(p2, 10);
  r1 = parseInt(r1, 10); r2 = parseInt(r2, 10);
  if ([p1, p2, r1, r2].some(isNaN)) return 0;
  if (p1 === r1 && p2 === r2) return 25;
  const pW = p1 > p2 ? 1 : p1 < p2 ? 2 : 0;
  const rW = r1 > r2 ? 1 : r1 < r2 ? 2 : 0;
  if (pW === rW) return 18;
  if (p1 === r1 || p2 === r2) return 5;
  return 0;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://copa-do-mundo2026-beta.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.NOTIFY_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { bolaoId, jogoId, s1, s2, t1, t2 } = req.body || {};
  if (!bolaoId || !jogoId || s1 === undefined || s2 === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const bolaoRef = db.collection('boloes').doc(bolaoId);

  // Prevent duplicate notifications
  const sentRef = bolaoRef.collection('notificacoesSent').doc(jogoId);
  const sentDoc = await sentRef.get();
  if (sentDoc.exists) return res.json({ ok: true, skipped: true });
  await sentRef.set({ sentAt: new Date().toISOString(), s1, s2 });

  const subsSnap = await bolaoRef.collection('pushSubscriptions').get();
  if (subsSnap.empty) return res.json({ ok: true, sent: 0 });

  const jogoLabel = t1 && t2 ? `${t1} ${s1}×${s2} ${t2}` : `Jogo ${jogoId}: ${s1}×${s2}`;

  const sends = subsSnap.docs.map(async (subDoc) => {
    const { uid, subscription } = subDoc.data();
    if (!subscription) return;

    let pts = null;
    try {
      const palpDoc = await bolaoRef.collection('palpites').doc(uid)
        .collection('jogos').doc(jogoId).get();
      if (palpDoc.exists) {
        const d = palpDoc.data();
        pts = calcPontos(d.s1, d.s2, s1, s2);
      }
    } catch (_) {}

    let title, body;
    if (pts === null) {
      title = `⚽ Resultado: ${jogoLabel}`;
      body = 'Você não palpitou neste jogo.';
    } else if (pts === 25) {
      title = `🎉 Placar exato! ${jogoLabel}`;
      body = 'Parabéns, vc fez 25 pontos!';
    } else if (pts === 18) {
      title = `✅ Acertou o resultado! ${jogoLabel}`;
      body = `Quase lá — acertou um dos resultados — 18 pontos`;
    } else if (pts === 5) {
      title = `👌 Acertou um número! ${jogoLabel}`;
      body = '5 pontos — acertou um dos placares';
    } else {
      title = `❌ Resultado: ${jogoLabel}`;
      body = 'Não foi dessa vez, 0 pontos';
    }

    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body, icon: '/icon.svg', badge: '/icon.svg', url: '/' })
      );
    } catch (e) {
      if (e.statusCode === 410) {
        await bolaoRef.collection('pushSubscriptions').doc(uid).delete().catch(() => {});
      }
    }
  });

  await Promise.allSettled(sends);
  return res.json({ ok: true, sent: subsSnap.docs.length });
};
