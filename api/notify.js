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

async function sendPushToUser(bolaoRef, subDoc, jogo) {
  const { uid, subscription } = subDoc.data();
  if (!subscription) return;

  let pts = null;
  try {
    const palpDoc = await bolaoRef.collection('palpites').doc(uid)
      .collection('jogos').doc(jogo.jogoId).get();
    if (palpDoc.exists) {
      const d = palpDoc.data();
      pts = calcPontos(d.s1, d.s2, jogo.s1, jogo.s2);
    }
  } catch (_) {}

  const label = jogo.t1 && jogo.t2
    ? `${jogo.t1} ${jogo.s1}×${jogo.s2} ${jogo.t2}`
    : `Jogo ${jogo.jogoId}: ${jogo.s1}×${jogo.s2}`;

  let title, body;
  if (pts === null) {
    title = `⚽ Resultado: ${label}`;
    body = 'Você não palpitou neste jogo.';
  } else if (pts === 25) {
    title = `🎉 Placar exato! ${label}`;
    body = 'Parabéns, vc fez 25 pontos!';
  } else if (pts === 18) {
    title = `✅ Acertou o resultado! ${label}`;
    body = 'Quase lá — acertou um dos resultados — 18 pontos';
  } else if (pts === 5) {
    title = `👌 Acertou um número! ${label}`;
    body = '5 pontos — acertou um dos placares';
  } else {
    title = `❌ Resultado: ${label}`;
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
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.NOTIFY_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { bolaoId, resultados } = req.body || {};
  if (!bolaoId || !Array.isArray(resultados) || !resultados.length) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const bolaoRef = db.collection('boloes').doc(bolaoId);

  // Filtrar apenas jogos que ainda não tiveram notificação enviada
  const sentSnap = await bolaoRef.collection('notificacoesSent').get();
  const jaEnviados = new Set(sentSnap.docs.map(d => d.id));
  const novos = resultados.filter(r => !jaEnviados.has(r.jogoId));

  if (!novos.length) return res.json({ ok: true, skipped: resultados.length, novos: 0 });

  // Marcar todos como enviados antes de disparar (evita duplicatas em corrida)
  const batch = db.batch();
  for (const r of novos) {
    batch.set(bolaoRef.collection('notificacoesSent').doc(r.jogoId), {
      sentAt: new Date().toISOString(), s1: r.s1, s2: r.s2,
    });
  }
  await batch.commit();

  // Buscar todas as assinaturas push do bolão
  const subsSnap = await bolaoRef.collection('pushSubscriptions').get();
  if (subsSnap.empty) return res.json({ ok: true, novos: novos.length, subs: 0 });

  // Para cada jogo novo, notificar todos os assinantes
  for (const jogo of novos) {
    await Promise.allSettled(subsSnap.docs.map(sub => sendPushToUser(bolaoRef, sub, jogo)));
  }

  return res.json({ ok: true, novos: novos.length, subs: subsSnap.docs.length });
};
