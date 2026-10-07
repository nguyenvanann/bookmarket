const { ethers } = require("ethers");
const { getProvider, recordFaucetOnChain } = require("../services/blockchainService");
const {
  upsertTxNode,
  publishTxUpdate,
} = require("../services/blockchainListener");

const DEFAULT_AMOUNT = () => String(process.env.FAUCET_AMOUNT_ETH || "1");
const MAX_PUBLIC_ETH = Number(process.env.FAUCET_MAX_PUBLIC_ETH || "5");
const MAX_ADMIN_ETH = Number(process.env.FAUCET_MAX_ADMIN_ETH || "100");
const SKIP_IF_BAL_ETH = Number(process.env.FAUCET_SKIP_IF_BALANCE_ETH || "2");

async function unlockDeployer(provider) {
  const deployer = process.env.DEPLOYER_ADDRESS;
  if (!deployer) throw Object.assign(new Error("Thiếu DEPLOYER_ADDRESS"), { status: 500 });

  if (process.env.DEPLOYER_PRIVATE_KEY) {
    return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  }

  const password = process.env.GETH_PASSWORD || "password";
  try {
    await provider.send("personal_unlockAccount", [deployer, password, 300]);
  } catch (e) {
    throw Object.assign(
      new Error(`Không unlock được deployer: ${e.message}. Kiểm tra geth personal API.`),
      { status: 503 }
    );
  }
  return { type: "unlocked", address: deployer, provider };
}

async function sendEth(provider, to, amountWei) {
  const deployer = process.env.DEPLOYER_ADDRESS;

  if (process.env.DEPLOYER_PRIVATE_KEY) {
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const tx = await wallet.sendTransaction({ to, value: amountWei });
    const receipt = await tx.wait();
    return { txHash: receipt.hash, from: wallet.address };
  }

  await unlockDeployer(provider);
  const txHash = await provider.send("eth_sendTransaction", [
    {
      from: deployer,
      to,
      value: ethers.toQuantity(amountWei),
      gas: ethers.toQuantity(21000n),
    },
  ]);
  await provider.waitForTransaction(txHash);
  return { txHash, from: deployer };
}

/**
 * Gửi ETH rồi ghi TxNode Faucet on-chain + Mongo + SSE live.
 */
async function fundAndRecord(provider, to, amountWei) {
  const { txHash, from } = await sendEth(provider, to, amountWei);
  let node = null;
  let recordTxHash = null;
  try {
    const recorded = await recordFaucetOnChain(to, amountWei);
    recordTxHash = recorded.txHash;
    const doc = await upsertTxNode(recorded.nodeIndex, {
      txHash: recorded.txHash,
      blockNumber: recorded.blockNumber,
    });
    await publishTxUpdate(doc);
    node = doc?.toObject ? doc.toObject() : doc;
  } catch (err) {
    console.error("[faucet] recordFaucet:", err.shortMessage || err.message);
  }
  const balAfter = await provider.getBalance(to);
  return {
    txHash,
    recordTxHash,
    from,
    to,
    balanceEth: ethers.formatEther(balAfter),
    balanceWei: balAfter.toString(),
    node,
  };
}

function parseAmount(amountEth, maxEth) {
  const raw = String(amountEth ?? DEFAULT_AMOUNT()).trim();
  let wei;
  try {
    wei = ethers.parseEther(raw);
  } catch {
    const err = new Error("Số ETH không hợp lệ");
    err.status = 400;
    throw err;
  }
  if (wei <= 0n) {
    const err = new Error("Số ETH phải > 0");
    err.status = 400;
    throw err;
  }
  const maxWei = ethers.parseEther(String(maxEth));
  if (wei > maxWei) {
    const err = new Error(`Tối đa ${maxEth} ETH mỗi lần`);
    err.status = 400;
    throw err;
  }
  return { amountEth: raw, amountWei: wei };
}

function normalizeAddresses(body) {
  const list = [];
  if (Array.isArray(body.addresses)) list.push(...body.addresses);
  if (body.address) list.push(body.address);
  if (typeof body.text === "string") {
    list.push(
      ...body.text
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  const unique = [...new Set(list.map((a) => String(a).trim()).filter(Boolean))];
  return unique;
}

/**
 * Public faucet — cấp ETH cho ví bất kỳ (rate-limit, bỏ qua nếu đã giàu).
 */
async function faucet(req, res, next) {
  try {
    const addresses = normalizeAddresses(req.body);
    if (addresses.length === 0) {
      return res.status(400).json({ message: "Thiếu địa chỉ ví" });
    }
    if (addresses.length > 1) {
      return res.status(400).json({
        message: "Faucet công khai chỉ gửi 1 ví. Admin dùng /api/admin/faucet để gửi hàng loạt.",
      });
    }

    const address = addresses[0];
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ message: "Địa chỉ ví không hợp lệ" });
    }

    const { amountEth, amountWei } = parseAmount(req.body.amountEth, MAX_PUBLIC_ETH);
    const provider = getProvider();

    global.__bmFaucetAt = global.__bmFaucetAt || new Map();
    const key = address.toLowerCase();
    const last = global.__bmFaucetAt.get(key) || 0;
    if (Date.now() - last < 20_000) {
      return res.status(429).json({ message: "Faucet đang chờ — thử lại sau 20 giây" });
    }

    const balBefore = await provider.getBalance(address);
    if (balBefore >= ethers.parseEther(String(SKIP_IF_BAL_ETH))) {
      return res.json({
        skipped: true,
        message: `Ví đã có ≥ ${SKIP_IF_BAL_ETH} ETH`,
        balanceWei: balBefore.toString(),
        balanceEth: ethers.formatEther(balBefore),
        to: address,
      });
    }

    const funded = await fundAndRecord(provider, address, amountWei);
    global.__bmFaucetAt.set(key, Date.now());

    res.json({
      txHash: funded.txHash,
      recordTxHash: funded.recordTxHash,
      from: funded.from,
      to: funded.to,
      amountEth,
      balanceEth: funded.balanceEth,
      balanceWei: funded.balanceWei,
      node: funded.node,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

/**
 * Admin faucet — cấp ETH cho mọi ví, tuỳ số lượng, hàng loạt, force kể cả ví đã có ETH.
 */
async function adminFaucet(req, res, next) {
  try {
    const addresses = normalizeAddresses(req.body);
    if (addresses.length === 0) {
      return res.status(400).json({ message: "Thiếu địa chỉ ví (address / addresses / text)" });
    }
    if (addresses.length > 50) {
      return res.status(400).json({ message: "Tối đa 50 ví mỗi lần" });
    }

    const force = Boolean(req.body.force);
    const { amountEth, amountWei } = parseAmount(req.body.amountEth, MAX_ADMIN_ETH);
    const provider = getProvider();
    const deployer = process.env.DEPLOYER_ADDRESS;
    let remaining = await provider.getBalance(deployer);

    const results = [];
    for (const raw of addresses) {
      if (!ethers.isAddress(raw)) {
        results.push({ to: raw, ok: false, message: "Địa chỉ không hợp lệ" });
        continue;
      }
      const to = ethers.getAddress(raw);
      try {
        const balBefore = await provider.getBalance(to);
        if (!force && balBefore >= ethers.parseEther(String(SKIP_IF_BAL_ETH))) {
          results.push({
            to,
            ok: true,
            skipped: true,
            message: `Đã có ≥ ${SKIP_IF_BAL_ETH} ETH`,
            balanceEth: ethers.formatEther(balBefore),
          });
          continue;
        }
        if (remaining < amountWei) {
          results.push({ to, ok: false, message: "Deployer không đủ ETH" });
          continue;
        }
        const funded = await fundAndRecord(provider, to, amountWei);
        remaining -= amountWei;
        results.push({
          to,
          ok: true,
          skipped: false,
          txHash: funded.txHash,
          recordTxHash: funded.recordTxHash,
          from: funded.from,
          amountEth,
          balanceEth: funded.balanceEth,
          nodeIndex: funded.node?.index,
          nodeHash: funded.node?.nodeHash,
        });
      } catch (err) {
        results.push({ to, ok: false, message: err.shortMessage || err.message });
      }
    }

    const fundedCount = results.filter((r) => r.ok && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.ok).length;

    res.json({
      amountEth,
      force,
      funded: fundedCount,
      skipped,
      failed,
      deployerBalanceEth: ethers.formatEther(await provider.getBalance(deployer)),
      results,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

async function getBalance(req, res, next) {
  try {
    const address = String(req.params.address || "").trim();
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ message: "Địa chỉ ví không hợp lệ" });
    }
    const provider = getProvider();
    const bal = await provider.getBalance(address);
    const deployer = process.env.DEPLOYER_ADDRESS;
    const deployerBal = deployer ? await provider.getBalance(deployer) : 0n;
    res.json({
      address: ethers.getAddress(address),
      balanceWei: bal.toString(),
      balanceEth: ethers.formatEther(bal),
      faucet: {
        defaultAmountEth: DEFAULT_AMOUNT(),
        skipIfBalanceEth: SKIP_IF_BAL_ETH,
        maxPublicEth: MAX_PUBLIC_ETH,
      },
      deployer: deployer
        ? {
            address: deployer,
            balanceEth: ethers.formatEther(deployerBal),
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { faucet, adminFaucet, getBalance };
