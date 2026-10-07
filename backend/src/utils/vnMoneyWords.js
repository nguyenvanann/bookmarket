/**
 * Đọc số tiền tiếng Việt (đơn giản) — dùng cho tổng thanh toán hóa đơn.
 */
const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readTriple(n, full) {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  let s = "";
  if (tram > 0 || full) {
    s += `${DIGITS[tram]} trăm`;
    if (chuc === 0 && donvi > 0) s += " linh";
  }
  if (chuc > 1) {
    s += `${s ? " " : ""}${DIGITS[chuc]} mươi`;
    if (donvi === 1) s += " mốt";
    else if (donvi === 5) s += " lăm";
    else if (donvi > 0) s += ` ${DIGITS[donvi]}`;
  } else if (chuc === 1) {
    s += `${s ? " " : ""}mười`;
    if (donvi === 1) s += " một";
    else if (donvi === 5) s += " lăm";
    else if (donvi > 0) s += ` ${DIGITS[donvi]}`;
  } else if (donvi > 0 && chuc === 0) {
    if (!tram && !full) s += DIGITS[donvi];
    else if (tram) s += ` ${DIGITS[donvi]}`;
    else s += DIGITS[donvi];
  }
  return s.trim();
}

function readInteger(n) {
  if (!Number.isFinite(n) || n < 0) return "không";
  n = Math.floor(n);
  if (n === 0) return "không";
  const units = ["", " nghìn", " triệu", " tỷ"];
  const parts = [];
  let i = 0;
  while (n > 0 && i < units.length) {
    const triple = n % 1000;
    if (triple > 0) {
      const full = n >= 1000;
      parts.unshift(readTriple(triple, full) + units[i]);
    }
    n = Math.floor(n / 1000);
    i += 1;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** ETH với tối đa 6 chữ số thập phân */
function ethToWords(amountEth) {
  const n = Number(amountEth) || 0;
  const intPart = Math.floor(n);
  const frac = Math.round((n - intPart) * 1e6);
  let s;
  if (intPart === 0 && frac > 0) {
    s = `${readInteger(frac)} phần triệu đồng ETH chẵn`;
  } else {
    s = `${readInteger(intPart)} đồng ETH`;
    if (frac > 0) s += ` và ${readInteger(frac)} phần triệu`;
    s += " chẵn";
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function vndToWords(amountVnd) {
  const n = Math.round(Number(amountVnd) || 0);
  const s = `${readInteger(n)} đồng chẵn`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { ethToWords, vndToWords, readInteger };
