import { Interface, formatEther } from "ethers";
import bookAbi from "../services/abi/BookNFT.json";
import marketAbi from "../services/abi/BookMarketplace.json";

const bookIface = new Interface(bookAbi);
const marketIface = new Interface(marketAbi);

const VI = {
  BookNotForSale: () => "Sách không còn mở bán trên chain (đã bán hoặc đã gỡ).",
  CannotBuyOwnBook: () => "Bạn đang là chủ sở hữu — không thể tự mua.",
  CannotBuyOwnListing: () => "Không thể tự mua listing của chính mình.",
  NotBookOwner: () => "Ví không phải chủ sở hữu sách này trên chain.",
  NotOwner: () => "Ví không có quyền thực hiện thao tác này.",
  NotListed: () => "Listing marketplace không còn hiệu lực.",
  IncorrectPayment: (args) => {
    const exp = args?.expected != null ? formatEther(args.expected) : "?";
    const sent = args?.sent != null ? formatEther(args.sent) : "?";
    return `Số ETH không khớp. Cần đúng ${exp} ETH (đã gửi ${sent} ETH).`;
  },
  BatchTooLarge: () => "Quá 20 sách trong một giao dịch. Hệ thống sẽ tách lô — thử lại.",
  InvalidPrice: () => "Giá phải lớn hơn 0.",
  ZeroAddress: () => "Địa chỉ không hợp lệ.",
  OnlyMarketplace: () => "Chỉ marketplace được gọi hàm này.",
  ERC721InsufficientApproval: () =>
    "Chưa approve marketplace. Thử treo bán lại (sẽ approve rồi list).",
  ERC721IncorrectOwner: () => "Ví không còn sở hữu NFT này trên chain.",
  ERC721InvalidReceiver: () => "Địa chỉ nhận NFT không hợp lệ.",
};

function tryParse(iface, data) {
  try {
    return iface.parseError(data);
  } catch {
    return null;
  }
}

function extractRevertHex(err) {
  const seen = new Set();
  const queue = [err];
  while (queue.length) {
    const cur = queue.shift();
    if (cur == null || seen.has(cur)) continue;
    if (typeof cur === "string") {
      const m = cur.match(/0x[0-9a-fA-F]{8,}/);
      if (m && m[0].length >= 10) return m[0];
      continue;
    }
    if (typeof cur !== "object") continue;
    seen.add(cur);
    for (const key of Object.keys(cur)) {
      try {
        queue.push(cur[key]);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export function explainContractError(err) {
  if (!err) return "Lỗi không xác định";
  if (typeof err === "string") return err;

  const hex = extractRevertHex(err);
  let parsed = null;
  if (hex) parsed = tryParse(marketIface, hex) || tryParse(bookIface, hex);
  if (!parsed && err.revert?.name) {
    parsed = { name: err.revert.name, args: err.revert.args || err.revert };
  }
  if (parsed?.name && VI[parsed.name]) {
    try {
      return VI[parsed.name](parsed.args);
    } catch {
      return `Contract revert: ${parsed.name}`;
    }
  }
  if (parsed?.name) return `Contract revert: ${parsed.name}`;

  if (err.code === "BAD_DATA" || /could not decode result data/i.test(String(err.message))) {
    const method = err.info?.method || err.info?.signature || "eth_call";
    return (
      `Không đọc được dữ liệu chain (${method}). ` +
      `MetaMask đang trỏ sai RPC hoặc sách không tồn tại trên contract. ` +
      `Dùng mạng «BookMarket Private» — chainId 54321 — RPC http://127.0.0.1:8547 ` +
      `(không dùng :8545 / chainId 12345 của ticket).`
    );
  }

  const raw =
    err.shortMessage ||
    err.reason ||
    err.info?.error?.message ||
    err.error?.message ||
    err.message ||
    String(err);

  if (/user rejected|ACTION_REJECTED|denied transaction|User denied/i.test(raw)) {
    return "Bạn đã từ chối giao dịch trên MetaMask.";
  }
  if (/insufficient funds/i.test(raw)) {
    return "Ví không đủ ETH (giá sách + phí gas). Bấm «Nhận ETH faucet» rồi thử lại.";
  }
  if (/unrecognized chain|try adding the chain|4902/i.test(raw)) {
    return (
      `MetaMask chưa có mạng BookMarket. Bấm «Kết nối ví» để thêm tự động, hoặc thêm thủ công: ` +
      `RPC http://127.0.0.1:8547 · Chain ID 54321 · Symbol ETH · tên «BookMarket Private».`
    );
  }
  if (/network|chain|chainId|sai RPC|BookMarket Private|0xd431/i.test(raw)) {
    // Giữ nguyên nếu đã có hướng dẫn cụ thể
    if (/54321|8547|BookMarket|RPC/i.test(raw) && raw.length < 400) return raw;
    return (
      `Sai mạng MetaMask. Cần chainId 54321 (BookMarket Private, RPC http://127.0.0.1:8547). ` +
      `Bấm «Kết nối ví» để chuyển/thêm mạng, rồi mua lại.`
    );
  }
  if (/nonce/i.test(raw)) {
    return "Lỗi nonce MetaMask — reset account trong MetaMask → Settings → Advanced.";
  }

  return raw;
}
