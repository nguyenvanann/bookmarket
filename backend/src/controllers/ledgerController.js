const Transaction = require("../models/Transaction");
const chain = require("../services/blockchainService");
const { addClient, clientCount } = require("../services/liveHub");

async function getChain(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const action = req.query.action; // Mint | Sale | Transfer
    const bookId = req.query.bookId ? Number(req.query.bookId) : null;
    const q = {};
    if (action) q.action = action;
    if (bookId) q.bookId = bookId;

    const nodes = await Transaction.find(q).sort({ index: -1 }).limit(limit);
    const tip = await chain.getLedgerTip();
    const total = await Transaction.countDocuments(q);
    res.json({ tip, nodes: nodes.reverse(), total });
  } catch (e) {
    next(e);
  }
}

async function getStatus(_req, res, next) {
  try {
    const status = await chain.getLedgerStatus();
    res.json({ status, liveClients: clientCount() });
  } catch (e) {
    next(e);
  }
}

async function getBookChain(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const nodes = await Transaction.find({ bookId }).sort({ index: 1 });
    res.json({ bookId, nodes });
  } catch (e) {
    next(e);
  }
}

/** SSE: event tx | tip | book | ping */
function streamLedger(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  addClient(res);
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, clients: clientCount() })}\n\n`);

  const ping = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch {
      clearInterval(ping);
    }
  }, 20000);

  req.on("close", () => clearInterval(ping));
}

module.exports = { getChain, getStatus, getBookChain, streamLedger };
