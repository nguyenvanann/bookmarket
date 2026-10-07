const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

function loadAbi(name) {
  const p = path.join(__dirname, "..", "abi", `${name}.json`);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

let provider;
let provider2;
let bookNFT;
let marketplace;

const DEFAULT_RPC = "http://127.0.0.1:8547";

function resetProviderCache() {
  provider = null;
  provider2 = null;
  bookNFT = null;
  marketplace = null;
}

function getProvider() {
  if (!provider) {
    const rpc = process.env.RPC_URL || DEFAULT_RPC;
    const chainId = Number(process.env.CHAIN_ID || 54321);
    // staticNetwork: tránh spam "failed to detect network" khi Geth restart
    provider = new ethers.JsonRpcProvider(rpc, chainId, { staticNetwork: true });
  }
  return provider;
}

/** Fail-fast khi Geth tắt — tránh prepare-checkout / mint treo lâu */
async function assertRpcReady({ timeoutMs = 4000 } = {}) {
  const rpc = process.env.RPC_URL || DEFAULT_RPC;
  try {
    const p = getProvider();
    const network = await Promise.race([
      p.getNetwork(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("RPC timeout")), timeoutMs)
      ),
    ]);
    const expected = Number(process.env.CHAIN_ID || 54321);
    if (expected && Number(network.chainId) !== expected) {
      throw new Error(
        `Sai chainId RPC: nhận ${network.chainId}, cần ${expected}`
      );
    }
    return true;
  } catch (e) {
    resetProviderCache();
    const err = new Error(
      `Không kết nối được Geth tại ${rpc}. Hãy chạy private-net (node1) rồi thử lại.`
    );
    err.status = 503;
    err.cause = e;
    throw err;
  }
}

function getProvider2() {
  if (!process.env.RPC_URL_2) return null;
  if (!provider2) {
    provider2 = new ethers.JsonRpcProvider(process.env.RPC_URL_2);
  }
  return provider2;
}

function getBookNFT() {
  const addr = process.env.BOOK_NFT_ADDRESS;
  if (!addr) return null;
  if (!bookNFT) {
    bookNFT = new ethers.Contract(addr, loadAbi("BookNFT"), getProvider());
  }
  return bookNFT;
}

function getMarketplace() {
  const addr = process.env.BOOK_MARKETPLACE_ADDRESS;
  if (!addr) return null;
  if (!marketplace) {
    marketplace = new ethers.Contract(addr, loadAbi("BookMarketplace"), getProvider());
  }
  return marketplace;
}

const ACTION_NAMES = ["Mint", "Transfer", "Sale", "Faucet"];

function actionName(v) {
  const n = Number(v);
  return ACTION_NAMES[n] || "Transfer";
}

async function readTxNode(index) {
  const c = getBookNFT();
  if (!c) return null;
  const n = await c.getTxNode(index);
  return {
    index: Number(n.index),
    bookId: Number(n.bookId),
    from: n.from,
    to: n.to,
    priceWei: n.price.toString(),
    action: actionName(n.action),
    timestamp: Number(n.timestamp),
    prevNodeHash: n.prevNodeHash,
    nodeHash: n.nodeHash,
  };
}

async function readBookOnChain(bookId) {
  const c = getBookNFT();
  if (!c) return null;
  const b = await c.getBook(bookId);
  const owner = await c.ownerOf(bookId);
  return {
    bookId,
    title: b.title,
    author: b.author,
    genre: b.genre,
    metadataURI: b.metadataURI,
    listedPriceWei: b.listedPrice.toString(),
    forSale: b.forSale,
    createdAt: Number(b.createdAt),
    ownerWallet: owner.toLowerCase(),
  };
}

async function getLedgerTip() {
  const c = getBookNFT();
  if (!c) return { latestNodeIndex: 0, latestNodeHash: ethers.ZeroHash, verified: false };
  const latestNodeIndex = Number(await c.latestNodeIndex());
  const latestNodeHash = await c.latestNodeHash();
  let verified = true;
  if (latestNodeIndex > 0) {
    verified = await c.verifyChain(latestNodeIndex);
  }
  return { latestNodeIndex, latestNodeHash, verified };
}

async function getLedgerStatus() {
  const tip = await getLedgerTip();
  const p1 = getProvider();
  const block1 = await p1.getBlockNumber();
  let block2 = null;
  let peerSync = null;
  try {
    const p2 = getProvider2();
    if (p2) {
      block2 = await p2.getBlockNumber();
      peerSync = block2 === block1;
    }
  } catch {
    peerSync = false;
  }
  return {
    chainId: Number(process.env.CHAIN_ID || 54321),
    rpc: process.env.RPC_URL,
    rpc2: process.env.RPC_URL_2 || null,
    bookNft: process.env.BOOK_NFT_ADDRESS || null,
    marketplace: process.env.BOOK_MARKETPLACE_ADDRESS || null,
    blockNumber: block1,
    blockNumberNode2: block2,
    nodesInSync: peerSync,
    ...tip,
  };
}

async function getAdminSigner() {
  const p = getProvider();
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, p);
  }
  const addr = process.env.DEPLOYER_ADDRESS;
  const password = process.env.GETH_PASSWORD || "password";
  if (!addr) {
    throw Object.assign(
      new Error("Missing DEPLOYER_ADDRESS or DEPLOYER_PRIVATE_KEY"),
      { status: 503 }
    );
  }
  try {
    await p.send("personal_unlockAccount", [addr, password, 300]);
  } catch (e) {
    throw Object.assign(
      new Error(
        `Không unlock được deployer: ${e.message}. ` +
          `Chạy start-node1 với API personal, kiểm tra GETH_PASSWORD = password.txt.`
      ),
      { status: 503 }
    );
  }
  return await p.getSigner(addr);
}

async function mintBookOnChain({ to, title, author, genre, metadataURI, priceEth, priceWei }) {
  await assertRpcReady();
  const signer = await getAdminSigner();
  const nft = getBookNFT();
  if (!nft) {
    throw Object.assign(new Error("Chưa cấu hình BOOK_NFT_ADDRESS"), { status: 503 });
  }
  const code = await getProvider().getCode(await nft.getAddress());
  if (!code || code === "0x") {
    throw Object.assign(
      new Error(
        `BOOK_NFT_ADDRESS không có bytecode trên RPC. Chạy lại: cd smart-contract && npm run deploy:local`
      ),
      { status: 503 }
    );
  }
  const c = nft.connect(signer);
  let wei;
  if (priceWei != null && String(priceWei) !== "") {
    wei = BigInt(priceWei);
  } else {
    // Giữ chuỗi ETH từ formatEther — tránh Number() làm lệch wei → IncorrectPayment
    wei = ethers.parseEther(String(priceEth ?? "0").trim() || "0");
  }
  const tx = await c.mintBook(to, title, author, genre, metadataURI || "", wei);
  const receipt = await tx.wait();

  let bookId = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = c.interface.parseLog(log);
      if (parsed?.name === "BookMinted") {
        bookId = Number(parsed.args.bookId);
        break;
      }
    } catch {
      /* log khác contract */
    }
  }
  if (bookId == null || !Number.isFinite(bookId)) {
    const tipIndex = Number(await c.latestNodeIndex());
    if (tipIndex > 0) {
      const node = await readTxNode(tipIndex);
      if (node?.action === "Mint") bookId = node.bookId;
    }
  }

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    bookId,
  };
}

/** true nếu token bookId tồn tại on-chain (ownerOf không revert) */
async function bookExistsOnChain(bookId) {
  const c = getBookNFT();
  if (!c || bookId == null || bookId < 1) return false;
  try {
    await c.ownerOf(bookId);
    return true;
  } catch {
    return false;
  }
}

/** Ghi TxNode Faucet on-chain (bookId = 0) — nối tip chuỗi ngay sau khi cấp ETH. */
async function recordFaucetOnChain(to, amountWei) {
  const signer = await getAdminSigner();
  const c = getBookNFT();
  if (!c) throw Object.assign(new Error("Chưa cấu hình BOOK_NFT_ADDRESS"), { status: 503 });
  const connected = c.connect(signer);
  const tx = await connected.recordFaucet(to, amountWei);
  const receipt = await tx.wait();
  const tipIndex = Number(await c.latestNodeIndex());
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    nodeIndex: tipIndex,
  };
}

module.exports = {
  getProvider,
  getBookNFT,
  getMarketplace,
  assertRpcReady,
  resetProviderCache,
  readTxNode,
  readBookOnChain,
  getLedgerTip,
  getLedgerStatus,
  mintBookOnChain,
  bookExistsOnChain,
  recordFaucetOnChain,
  actionName,
  ACTION_NAMES,
  loadAbi,
};
