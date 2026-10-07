# Frontend — BookMarket UI

Hướng dẫn cài đặt, luồng hoạt động, và cách lấy từng tham số trong file [`.env`](./.env) / [`.env.example`](./.env.example).

```text
frontend/
├── src/
│   ├── main.jsx / App.jsx     # Router + Auth / Wallet / Cart
│   ├── user/                  # Sàn sách, giỏ, kệ, ledger, login
│   ├── admin/                 # Admin console (RBAC theo role)
│   ├── context/               # AuthContext, WalletContext, CartContext
│   ├── services/
│   │   ├── api.js             # Axios → backend (VITE_API_BASE_URL)
│   │   ├── contract.js        # ethers + MetaMask (VITE_CHAIN_* / NFT)
│   │   └── abi/               # BookNFT.json, BookMarketplace.json (do deploy copy)
│   └── hooks/useLedgerLive.js # SSE ledger từ API
├── vite.config.js
└── .env                       # Sao chép từ .env.example rồi điền
```

Dev server: **http://localhost:5174** (cấu hình trong `vite.config.js`; đổi cổng nếu bị chiếm).

---

## 1. Yêu cầu

| Thành phần | Ghi chú |
|------------|---------|
| Node.js ≥ 18 | + npm |
| Backend API | `http://localhost:5002` — xem `backend/README.md` |
| Geth private-net | RPC `:8547`, chainId `54321` |
| Smart contract đã deploy | Địa chỉ NFT + Marketplace |
| MetaMask | Mua sách / kết nối ví (đọc thử không bắt buộc ví) |

Thứ tự khuyến nghị:

```text
1. private-net (Geth)
2. smart-contract → npm run deploy:local   # tự ghi VITE_* vào frontend/.env
3. backend → npm run dev
4. frontend → npm i · npm run dev
```

---

## 2. Cài đặt

```bash
cd frontend
cp .env.example .env          # lần đầu
npm install
npm run dev                   # http://localhost:5174
```

Sau `deploy:local`, file `.env` thường đã có `VITE_BOOK_NFT_ADDRESS` và `VITE_BOOK_MARKETPLACE_ADDRESS`. Kiểm tra `VITE_API_BASE_URL` trùng cổng backend.

`vite.config.js` có **proxy** `/api` → `http://127.0.0.1:5002`. Có thể để `VITE_API_BASE_URL=/api` (qua proxy) hoặc URL tuyệt đối `http://localhost:5002/api`.

### Scripts npm

| Lệnh | Việc làm |
|------|----------|
| `npm run dev` | Vite HMR |
| `npm run build` | Build production → `dist/` |
| `npm run preview` | Xem bản build local |

### Tài khoản demo (sau `backend` seed)

| Email | Password | Vào đâu |
|-------|----------|---------|
| `admin@bookmarket.local` | `admin123` | `/admin` (toàn quyền) |
| `staff@…` / `warehouse@…` / `accountant@…` | `admin123` | `/admin` (theo role) |
| `user@bookmarket.local` | `user123` | Sàn `/` |

---

## 3. Luồng hoạt động

### 3.1. Kiến trúc UI

```text
Browser
  ├─ React Router
  │    ├─ / … Layout (sàn, sách, giỏ, my-books, ledger)
  │    ├─ /login
  │    ├─ /books/:id/read     (reader PDF)
  │    └─ /admin/*            (console RBAC)
  │
  ├─ AuthContext ── JWT (localStorage bm_token) ──► VITE_API_BASE_URL
  ├─ CartContext ── giỏ local ──► mua hàng loạt qua contract
  └─ WalletContext ── MetaMask ──► VITE_RPC_URL / CHAIN_ID / NFT / MARKET
         │
         ▼
    contract.js · ethers
         ├─ JsonRpcProvider (đọc chain, không phụ thuộc mạng MM)
         └─ BrowserProvider (ký mua / list)
```

### 3.2. Luồng người dùng (sàn)

1. **Duyệt kệ** (`/`) — `GET /api/books`, lọc bán / tìm kiếm.
2. **Chi tiết sách** — đọc thử 10 trang (`/sample`), thêm giỏ, mua bằng MetaMask.
3. **Kết nối ví** — `wallet_switchEthereumChain` / `wallet_addEthereumChain` theo `VITE_CHAIN_ID` + `VITE_RPC_URL`; gắn ví vào user (`POST /auth/link-wallet`).
4. **Mua** — gọi `buyBook` hoặc marketplace; backend listener sync Sale + tồn kho.
5. **Sách của tôi** — sách `ownerWallet` = ví; đọc full PDF (auth).
6. **Ledger** — tip + danh sách TxNode; live SSE `/api/ledger/stream`.

### 3.3. Luồng admin

1. Đăng nhập role staff (`canAccessAdmin`) → `/admin`.
2. Sidebar lọc tab theo scope (admin / staff / warehouse / accountant).
3. Mint / kho / danh mục / sales / faucet / users… gọi API có `Authorization: Bearer`.
4. Mint on-chain vẫn do **backend** ký bằng deployer; frontend chỉ upload form + gọi API.

### 3.4. Routes chính

| Path | Mô tả |
|------|--------|
| `/` | Sàn sách |
| `/books/:bookId` | Chi tiết + mua / đọc thử |
| `/books/:bookId/read` | Reader PDF |
| `/cart` | Giỏ hàng |
| `/my-books` | Sách đã sở hữu |
| `/ledger` | Chuỗi TxNode |
| `/login` | Đăng nhập / đăng ký |
| `/admin/*` | Admin console |

---

## 4. Lấy tham số cho `frontend/.env`

Mọi biến Vite **bắt buộc** tiền tố `VITE_` (chỉ các biến này được bundle vào client).

```bash
cp .env.example .env
```

> Sau khi sửa `.env`, **restart** `npm run dev` (Vite không hot-reload env).

### 4.1. `VITE_API_BASE_URL`

**Ý nghĩa:** Base URL Axios gọi backend.

**Cách lấy:**

1. Chạy backend → log `BookMarket API http://localhost:PORT`.
2. Ghép `/api` vào cuối.

| Cách | Giá trị |
|------|---------|
| URL tuyệt đối (khuyến nghị rõ ràng) | `http://localhost:5002/api` |
| Qua Vite proxy (`vite.config.js`) | `/api` |
| Backend đổi `PORT=5003` | `http://localhost:5003/api` (+ sửa proxy nếu dùng) |

Đồng bộ CORS khi dùng URL tuyệt đối: thêm `http://localhost:5174` vào backend `CLIENT_ORIGIN` (lab đã nới mọi `localhost:*`).

### 4.2. `VITE_NETWORK_NAME`

**Ý nghĩa:** Tên mạng hiện trên MetaMask khi `wallet_addEthereumChain`.

**Cách lấy:** Tự đặt; nên trùng `backend` `NETWORK_NAME`.

**Lab:** `BookMarket Private`

### 4.3. `VITE_CHAIN_ID`

**Ý nghĩa:** Chain ID mạng Geth (số thập phân). MetaMask dùng dạng hex nội bộ (`0xd431` = 54321).

**Cách lấy:**

```bash
# Từ genesis
grep chainId ../blockchain/private-net/genesis.json

# Từ RPC
curl -s -X POST http://127.0.0.1:8547 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# "0xd431" → 54321
```

**Lab:** `54321`  
**Không dùng** `12345` (mạng lab khác / ticket) — sẽ lỗi `ownerOf` / BAD_DATA.

### 4.4. `VITE_RPC_URL`

**Ý nghĩa:** HTTP RPC Node1 — dùng cho `JsonRpcProvider` đọc chain và đăng ký MetaMask.

**Cách lấy:** `blockchain/private-net/start-node1.sh` → `--http.port 8547`.

**Lab:** `http://127.0.0.1:8547`

Kiểm tra:

```bash
curl -s -X POST http://127.0.0.1:8547 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 4.5. `VITE_BOOK_NFT_ADDRESS` / `VITE_BOOK_MARKETPLACE_ADDRESS`

**Ý nghĩa:** Địa chỉ contract để ethers gọi mint/buy/list (qua MetaMask) và kiểm tra bytecode mạng.

**Cách lấy (theo thứ tự thuận tiện):**

1. **Deploy tự ghi** (khuyến nghị):

```bash
cd ../smart-contract && npm run deploy:local
# → cập nhật frontend/.env các dòng VITE_BOOK_*_ADDRESS
```

2. File deployment:

```bash
cat ../smart-contract/deployments/localhost.json
# BookNFT / BookMarketplace
```

3. Backend `.env` (cùng lần deploy):

```bash
grep BOOK_ ../backend/.env
# BOOK_NFT_ADDRESS=…  →  VITE_BOOK_NFT_ADDRESS=…
# BOOK_MARKETPLACE_ADDRESS=…  →  VITE_BOOK_MARKETPLACE_ADDRESS=…
```

ABI trong `src/services/abi/` phải khớp bản deploy (deploy script copy sẵn). Reset chain → deploy lại → restart Vite.

---

## 5. MetaMask

Khi bấm **Kết nối ví**, app sẽ switch/add mạng theo `.env`:

| Trường MetaMask | Nguồn |
|-----------------|--------|
| Network name | `VITE_NETWORK_NAME` |
| RPC URL | `VITE_RPC_URL` |
| Chain ID | `VITE_CHAIN_ID` |
| Symbol | ETH |

Thủ công (nếu cần):

1. MetaMask → Add network → Manual  
2. RPC `http://127.0.0.1:8547`, Chain ID `54321`  
3. Import / tạo ví → nhận ETH faucet (admin hoặc API wallet)

---

## 6. Sơ đồ lấy `.env` (tóm tắt)

```text
backend PORT ─────────────────────────────► VITE_API_BASE_URL (= …/api)

blockchain/private-net
  genesis chainId 54321 ──────────────────► VITE_CHAIN_ID
  start-node1 :8547 ──────────────────────► VITE_RPC_URL
  (tự đặt tên) ───────────────────────────► VITE_NETWORK_NAME

smart-contract npm run deploy:local
  BookNFT ────────────────────────────────► VITE_BOOK_NFT_ADDRESS
  Marketplace ────────────────────────────► VITE_BOOK_MARKETPLACE_ADDRESS
  + copy ABI → frontend/src/services/abi/
```

---

## 7. Checklist trước `npm run dev`

1. Backend `curl http://localhost:5002/api/health` OK.
2. Geth RPC `:8547`, chainId `54321`.
3. `.env` có đủ 2 địa chỉ contract (không để trống).
4. `src/services/abi/BookNFT.json` tồn tại.
5. Restart Vite sau mỗi lần sửa `.env`.

---

## 8. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| API 404 / Network Error | Sai `VITE_API_BASE_URL` hoặc backend chưa chạy |
| `Chưa cấu hình VITE_BOOK_*` | Deploy contract / copy địa chỉ vào `.env`, restart Vite |
| MetaMask sai mạng / BAD_DATA | Chain ID phải `54321`, RPC `:8547` — xóa mạng cũ `12345` nếu conflict |
| CORS | Thêm origin vào backend `CLIENT_ORIGIN` |
| Đọc thử được nhưng mua fail | Chưa connect ví / hết ETH / chưa switch đúng mạng |
| Admin redirect về `/` | User role `user` — đăng nhập tài khoản staff |
| Frontend cũ sau deploy lại | Restart Vite; hard refresh; kiểm tra address trong `.env` |

---

## 9. Bảo mật

- Biến `VITE_*` **public** trong bundle trình duyệt — không đặt secret/JWT/private key vào đây.
- Private key deployer chỉ thuộc `backend` / `smart-contract`, không đưa lên frontend.
- Lab local only; không trỏ RPC production với key thật.

---

## 10. Liên kết

- Backend & `.env` API: [`../backend/README.md`](../backend/README.md)
- Smart contract & deploy: [`../smart-contract/README.md`](../smart-contract/README.md)
- Private net: [`../blockchain/private-net/README.md`](../blockchain/private-net/README.md)
- Tổng quan: [`../README.md`](../README.md)
