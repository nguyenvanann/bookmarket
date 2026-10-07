import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  parseEther,
} from "ethers";
import bookAbi from "./abi/BookNFT.json";
import marketAbi from "./abi/BookMarketplace.json";
import { explainContractError } from "../utils/contractErrors";

const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 54321);
const CHAIN_HEX = "0x" + CHAIN_ID.toString(16);
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8547";
const NETWORK_NAME = import.meta.env.VITE_NETWORK_NAME || "BookMarket Private";
const NFT = import.meta.env.VITE_BOOK_NFT_ADDRESS;
const MARKET = import.meta.env.VITE_BOOK_MARKETPLACE_ADDRESS;

const RPC_URLS = [...new Set([RPC_URL, "http://127.0.0.1:8547", "http://localhost:8547"])];

export function formatEth(wei) {
  try {
    return `${formatEther(wei || "0")} ETH`;
  } catch {
    return "0 ETH";
  }
}

function requireAddresses() {
  if (!NFT || !MARKET) {
    throw new Error("Chưa cấu hình VITE_BOOK_NFT_ADDRESS / VITE_BOOK_MARKETPLACE_ADDRESS");
  }
}

function errCode(err) {
  const c = err?.code ?? err?.data?.originalError?.code ?? err?.error?.code;
  return c == null ? null : Number(c);
}

function errMessage(err) {
  return String(
    err?.message || err?.data?.message || err?.error?.message || err || ""
  );
}

/** MetaMask (hoặc provider inject) — tránh nhầm multi-wallet */
export function getEthereum() {
  const eth = window.ethereum;
  if (!eth) throw new Error("Cần cài MetaMask (extension) rồi tải lại trang.");
  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0] || eth;
  }
  return eth;
}

async function mmChainId(eth = getEthereum()) {
  const hex = await eth.request({ method: "eth_chainId" });
  return Number.parseInt(hex, 16);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForChainId(eth, expected, tries = 25) {
  for (let i = 0; i < tries; i++) {
    const id = await mmChainId(eth);
    if (id === expected) return id;
    await sleep(120);
  }
  return mmChainId(eth);
}

function addChainParams() {
  return [
    {
      chainId: CHAIN_HEX,
      chainName: NETWORK_NAME,
      rpcUrls: RPC_URLS,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
  ];
}

/**
 * Thêm / chuyển MetaMask sang BookMarket Private (chainId 54321).
 * Xử lý code 4902 dạng number|string và chờ eth_chainId ổn định.
 */
export async function ensureWalletNetwork() {
  const eth = getEthereum();
  const params = addChainParams();

  const current = await mmChainId(eth);
  if (current === CHAIN_ID) {
    return eth;
  }

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  } catch (err) {
    const code = errCode(err);
    const msg = errMessage(err);
    const needAdd =
      code === 4902 ||
      /unrecognized chain|chain.*(not|never).*added|try adding the chain/i.test(msg);

    if (code === 4001) {
      throw new Error("Bạn đã từ chối chuyển mạng MetaMask. Hãy chọn «BookMarket Private» (54321).");
    }
    // Đang có request MetaMask khác (user chưa đóng popup)
    if (code === -32002 || /already pending|request.*pending/i.test(msg)) {
      throw new Error(
        "MetaMask đang chờ xác nhận — mở extension, Approve/Reject popup cũ, rồi thử lại."
      );
    }

    if (!needAdd) {
      throw new Error(
        `Không chuyển được MetaMask sang chainId ${CHAIN_ID}. ` +
          `Settings → Networks → «${NETWORK_NAME}»: RPC ${RPC_URL}, Chain ID ${CHAIN_ID}.`
      );
    }

    try {
      await eth.request({
        method: "wallet_addEthereumChain",
        params,
      });
    } catch (addErr) {
      if (errCode(addErr) === 4001) {
        throw new Error(
          `Bạn đã từ chối thêm mạng. Thêm thủ công trong MetaMask: ` +
            `tên «${NETWORK_NAME}», RPC ${RPC_URL}, chainId ${CHAIN_ID}, symbol ETH.`
        );
      }
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_HEX }],
        });
      } catch {
        throw new Error(
          `Không chuyển được MetaMask sang chainId ${CHAIN_ID}. ` +
            `Settings → Networks → thêm «${NETWORK_NAME}»: RPC ${RPC_URL}, Chain ID ${CHAIN_ID}. ` +
            `Chrome: cho phép site truy cập mạng cục bộ (Local network access).`
        );
      }
    }
  }

  const settled = await waitForChainId(eth, CHAIN_ID);
  if (settled !== CHAIN_ID) {
    throw new Error(
      `Sai mạng MetaMask (chainId ${settled}). Cần ${CHAIN_ID} — «${NETWORK_NAME}», RPC ${RPC_URL}.`
    );
  }
  return eth;
}

/** RPC trực tiếp BookMarket — không phụ thuộc MetaMask */
export function getReadProvider() {
  return new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
}

async function waitForPurchaseReceipt(tx) {
  const receipt = await getReadProvider().waitForTransaction(tx.hash, 1, 120_000);
  if (!receipt) {
    throw new Error(
      `Giao dịch ${tx.hash} chưa được xác nhận. Kiểm tra Activity trong MetaMask trước khi thử lại.`
    );
  }
  if (Number(receipt.status) !== 1) {
    throw new Error(`Giao dịch ${tx.hash} đã bị revert trên blockchain.`);
  }
  return receipt;
}

/**
 * Xác nhận MetaMask đúng chain + RPC thấy được BookNFT.
 */
async function assertBookMarketRpc(provider) {
  requireAddresses();
  const eth = getEthereum();
  const liveId = await mmChainId(eth);
  if (liveId !== CHAIN_ID) {
    throw new Error(
      `Sai mạng MetaMask (chainId ${liveId}). Cần ${CHAIN_ID} — «${NETWORK_NAME}», RPC ${RPC_URL}.`
    );
  }

  let network;
  try {
    network = await provider.getNetwork();
  } catch {
    network = { chainId: liveId };
  }
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(
      `Sai mạng MetaMask (chainId ${network.chainId}). Cần ${CHAIN_ID} — «${NETWORK_NAME}», RPC ${RPC_URL}.`
    );
  }

  let mmCode = "0x";
  try {
    mmCode = await provider.getCode(NFT);
  } catch {
    mmCode = "0x";
  }

  if (!mmCode || mmCode === "0x") {
    // Đối chiếu RPC chuẩn — phân biệt "sai RPC trong MetaMask" vs "chưa deploy"
    let directCode = "0x";
    try {
      directCode = await getReadProvider().getCode(NFT);
    } catch {
      throw new Error(
        `Không kết nối được Geth tại ${RPC_URL}. Hãy chạy private-net (node1) rồi thử lại.`
      );
    }
    if (directCode && directCode !== "0x") {
      // Thử cập nhật RPC qua addEthereumChain
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: addChainParams(),
        });
        await waitForChainId(eth, CHAIN_ID);
        const again = await provider.getCode(NFT);
        if (again && again !== "0x") return;
      } catch {
        /* hướng dẫn thủ công bên dưới */
      }
      throw new Error(
        `MetaMask đang dùng sai RPC cho chain ${CHAIN_ID}. ` +
          `Vào Settings → Networks → ${NETWORK_NAME} → đặt RPC URL = ${RPC_URL} ` +
          `(không dùng :8545 / chainId 12345). Xóa mạng cũ rồi kết nối lại nếu cần.`
      );
    }
    throw new Error(
      `Không thấy BookNFT tại ${NFT} trên ${RPC_URL}. Deploy contract hoặc kiểm tra VITE_BOOK_NFT_ADDRESS.`
    );
  }
}

export async function connectWallet() {
  const eth = await ensureWalletNetwork();
  await eth.request({ method: "eth_requestAccounts" });
  // Ép network expected — ethers báo lỗi sớm nếu MM lệch chain
  const provider = new BrowserProvider(eth, CHAIN_ID);
  await assertBookMarketRpc(provider);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address, ethereum: eth };
}

export async function getSigner() {
  const { signer } = await connectWallet();
  return signer;
}

export async function getContracts(signerOrProvider) {
  requireAddresses();
  return {
    nft: new Contract(NFT, bookAbi, signerOrProvider),
    market: new Contract(MARKET, marketAbi, signerOrProvider),
  };
}

async function safeOwnerOf(nft, bookId) {
  try {
    return await nft.ownerOf(bookId);
  } catch (err) {
    if (err.code === "BAD_DATA" || /could not decode|ownerOf/i.test(err.message || "")) {
      throw new Error(
        `Không đọc được ownerOf(#${bookId}). Thường do MetaMask sai RPC (cần ${RPC_URL}, chainId ${CHAIN_ID}) ` +
          `hoặc bookId không tồn tại trên contract hiện tại. Bấm Sync / Resync admin rồi thử lại.`
      );
    }
    throw err;
  }
}

async function assertFunded(signer, valueWei) {
  const provider = signer.provider;
  const addr = await signer.getAddress();
  // Số dư ưu tiên RPC chuẩn (tránh MM cache)
  let bal;
  try {
    bal = await getReadProvider().getBalance(addr);
  } catch {
    bal = await provider.getBalance(addr);
  }
  const need = BigInt(valueWei) + parseEther("0.01");
  if (bal < need) {
    throw new Error(
      `Ví chỉ có ${formatEther(bal)} ETH, cần ~${formatEther(need)} ETH. Bấm «Nhận ETH faucet».`
    );
  }
}

/**
 * Đọc trạng thái bán — ưu tiên RPC BookMarket trực tiếp.
 */
export async function quoteBook(bookId) {
  try {
    requireAddresses();
    const id = Number(bookId);
    if (!Number.isFinite(id) || id < 1) throw new Error("bookId không hợp lệ");

    const read = getReadProvider();
    const code = await read.getCode(NFT);
    if (!code || code === "0x") {
      throw new Error(`Không kết nối được BookNFT trên ${RPC_URL}. Kiểm tra geth node1 đang chạy.`);
    }

    const { nft, market } = await getContracts(read);
    let owner;
    let info;
    try {
      owner = await nft.ownerOf(id);
      info = await nft.getBook(id);
    } catch (err) {
      if (err.code === "BAD_DATA" || /could not decode|execution reverted/i.test(String(err.message))) {
        throw new Error(
          `Sách #${id} không tồn tại trên chain BookMarket hiện tại. Admin hãy Resync hoặc mint lại.`
        );
      }
      throw err;
    }
    const listing = await market.getListing(id);
    const marketListed = Boolean(listing.active);
    const forSale = Boolean(info.forSale) && !marketListed;
    const priceWei = marketListed ? listing.price : forSale ? info.listedPrice : 0n;
    return {
      bookId: id,
      owner: owner.toLowerCase(),
      seller: marketListed ? String(listing.seller).toLowerCase() : owner.toLowerCase(),
      title: info.title,
      author: info.author,
      forSale,
      marketListed,
      priceWei,
      priceEth: formatEther(priceWei || 0n),
    };
  } catch (err) {
    throw new Error(explainContractError(err));
  }
}

export async function buyPrimaryBook(bookId) {
  try {
    const signer = await getSigner();
    await assertBookMarketRpc(signer.provider);
    const { nft } = await getContracts(signer);
    const id = Number(bookId);
    const me = (await signer.getAddress()).toLowerCase();

    // Giá / trạng thái từ RPC chuẩn — tránh MetaMask RPC lệch
    const quote = await quoteBook(id);
    if (!quote.forSale) throw new Error("Sách không còn mở bán sơ cấp trên chain.");
    if (quote.owner === me) throw new Error("Bạn đang sở hữu sách này.");

    const value = quote.priceWei;
    if (!value || value === 0n) throw new Error("Sách không còn mở bán sơ cấp trên chain.");
    await assertFunded(signer, value);

    const tx = await nft.buyBook(id, { value });
    return waitForPurchaseReceipt(tx);
  } catch (err) {
    throw new Error(explainContractError(err));
  }
}

export async function buyFromMarket(bookId) {
  try {
    const signer = await getSigner();
    await assertBookMarketRpc(signer.provider);
    const { market } = await getContracts(signer);
    const id = Number(bookId);
    const me = (await signer.getAddress()).toLowerCase();
    const quote = await quoteBook(id);
    if (!quote.marketListed) {
      throw new Error("Listing marketplace không còn active trên chain.");
    }
    if (quote.seller === me) {
      throw new Error("Không thể tự mua listing của chính mình.");
    }
    const value = quote.priceWei;
    await assertFunded(signer, value);

    const tx = await market.buyListedBook(id, { value });
    return waitForPurchaseReceipt(tx);
  } catch (err) {
    throw new Error(explainContractError(err));
  }
}

export async function buyBookSmart(bookId) {
  const q = await quoteBook(bookId);
  await ensureWalletNetwork();
  if (q.marketListed) return buyFromMarket(bookId);
  if (q.forSale) return buyPrimaryBook(bookId);
  throw new Error("Sách hiện không mở bán trên chain.");
}

const MAX_BUY_BATCH = 20;

/**
 * Mua nhiều sách sơ cấp (BookNFT.buyBooks), tự chia ≤ 20 id / tx.
 * bookIds phải đang forSale primary (không phải marketplace escrow).
 */
export async function buyBooksBatch(bookIds) {
  try {
    const ids = [...new Set((bookIds || []).map((x) => Number(x)).filter((x) => x > 0))];
    if (!ids.length) throw new Error("Giỏ hàng trống");
    if (ids.length === 1) return buyPrimaryBook(ids[0]);

    // Nhiều hơn MAX_BUY_BATCH → nhiều MetaMask tx tuần tự
    if (ids.length > MAX_BUY_BATCH) {
      let last;
      for (let i = 0; i < ids.length; i += MAX_BUY_BATCH) {
        last = await buyBooksBatch(ids.slice(i, i + MAX_BUY_BATCH));
      }
      return last;
    }

    const signer = await getSigner();
    await assertBookMarketRpc(signer.provider);
    const { nft } = await getContracts(signer);

    let total = 0n;
    for (const id of ids) {
      const quote = await quoteBook(id);
      if (quote.marketListed) {
        throw new Error(
          `Sách #${id} đang trên marketplace — hãy mua riêng hoặc bỏ khỏi giỏ batch.`
        );
      }
      if (!quote.forSale || !quote.priceWei) {
        throw new Error(`Sách #${id} không còn mở bán sơ cấp.`);
      }
      total += BigInt(quote.priceWei);
    }

    await assertFunded(signer, total);

    if (typeof nft.buyBooks === "function") {
      try {
        const tx = await nft.buyBooks(ids, { value: total });
        return await waitForPurchaseReceipt(tx);
      } catch (batchErr) {
        const m = String(batchErr?.shortMessage || batchErr?.message || "");
        // Chỉ fallback khi ABI có buyBooks nhưng bytecode cũ thiếu selector
        const looksMissingSelector =
          /unknown function|no matching fragment|is not a function/i.test(m) ||
          (/missing revert data/i.test(m) &&
            !batchErr?.data &&
            !/IncorrectPayment|BookNotForSale|BatchTooLarge/i.test(m));
        if (!looksMissingSelector) throw batchErr;
      }
    }

    let last;
    for (const id of ids) {
      last = await buyPrimaryBook(id);
    }
    return last;
  } catch (err) {
    throw new Error(explainContractError(err));
  }
}

/** Sau mua: ép backend sync Mongo từ chain (không chờ listener). */
export async function refreshBooksAfterBuy(bookIds) {
  const ids = [...new Set((bookIds || []).map(Number).filter((x) => x > 0))];
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5002/api").replace(
    /\/$/,
    ""
  );
  await Promise.allSettled(
    ids.map((id) =>
      fetch(`${base}/books/${id}/refresh`, { method: "POST" }).catch(() => null)
    )
  );
}

export async function listOnMarket(bookId, priceEth) {
  try {
    const priceStr = String(priceEth ?? "").trim();
    if (!priceStr || Number(priceStr) <= 0) {
      throw new Error("Nhập giá bán lại > 0 (ETH)");
    }
    let price;
    try {
      price = parseEther(priceStr);
    } catch {
      throw new Error("Giá ETH không hợp lệ");
    }

    const signer = await getSigner();
    await assertBookMarketRpc(signer.provider);
    const { nft, market } = await getContracts(signer);
    const id = Number(bookId);
    const me = (await signer.getAddress()).toLowerCase();
    const owner = (await safeOwnerOf(nft, id)).toLowerCase();
    if (owner !== me) throw new Error("Chỉ chủ sở hữu mới treo bán được.");

    const info = await nft.getBook(id);
    if (info.forSale) {
      try {
        const u = await nft.unlistPrimary(id);
        await u.wait();
      } catch {
        /* marketplace.clearPrimaryListing sẽ xử lý */
      }
    }

    const approved = await nft.getApproved(id);
    const opsAll = await nft.isApprovedForAll(me, MARKET);
    if (String(approved).toLowerCase() !== String(MARKET).toLowerCase() && !opsAll) {
      const approveTx = await nft.approve(MARKET, id);
      await approveTx.wait();
    }

    const tx = await market.listBook(id, price);
    return tx.wait();
  } catch (err) {
    throw new Error(explainContractError(err));
  }
}

export async function listPrimary(bookId, priceEth) {
  try {
    const price = parseEther(String(priceEth));
    if (price <= 0n) throw new Error("Giá phải > 0");
    const signer = await getSigner();
    await assertBookMarketRpc(signer.provider);
    const { nft, market } = await getContracts(signer);
    const id = Number(bookId);
    const listing = await market.getListing(id);
    if (listing.active) {
      throw new Error("Sách đang escrow trên marketplace — hãy hủy listing trước.");
    }
    const tx = await nft.listPrimary(id, price);
    return tx.wait();
  } catch (err) {
    throw new Error(explainContractError(err));
  }
}

export async function cancelMarketListing(bookId) {
  try {
    const signer = await getSigner();
    await assertBookMarketRpc(signer.provider);
    const { market } = await getContracts(signer);
    const tx = await market.cancelListing(Number(bookId));
    return tx.wait();
  } catch (err) {
    throw new Error(explainContractError(err));
  }
}

export async function getWalletBalance(address) {
  if (!address) return 0n;
  try {
    return await getReadProvider().getBalance(address);
  } catch {
    if (!window.ethereum) return 0n;
    const provider = new BrowserProvider(getEthereum(), CHAIN_ID);
    return provider.getBalance(address);
  }
}

export { NFT, MARKET, CHAIN_ID, RPC_URL, NETWORK_NAME, CHAIN_HEX };
