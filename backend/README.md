# Backend — BookMarket API

Hướng dẫn cài đặt, luồng hoạt động, và cách lấy từng tham số trong file [`.env`](./.env) / [`.env.example`](./.env.example).

```text
backend/
├── src/
│   ├── server.js              # Express boot, CORS, seed, listener
│   ├── routes/                # /api/*
│   ├── controllers/
│   ├── services/              # chain, stock, invoice, PDF sample…
│   ├── models/                # User, Book, Sale, StockMovement…
│   ├── middlewares/           # JWT, upload, RBAC scopes
│   ├── constants/roles.js     # Phân quyền admin
│   ├── abi/                   # BookNFT.json, BookMarketplace.json (do deploy copy)
│   └── scripts/               # seed users / catalog / anime books
├── package.json
└── .env                       # Sao chép từ .env.example rồi điền
```

API mặc định: **http://localhost:5002** · prefix `/api`

---

## 1. Yêu cầu

| Thành phần | Ghi chú |
|------------|---------|
| Node.js ≥ 18 | + npm |
| MongoDB | local `mongodb://127.0.0.1:27017` hoặc Docker `mongo:7` |
| Geth private-net | RPC `:8547`, chainId `54321` — xem `blockchain/private-net/` |
| Smart contract đã deploy | Địa chỉ NFT + Marketplace — xem `smart-contract/README.md` |

Thứ tự khuyến nghị:

```text
1. private-net (Geth)
2. smart-contract → npm run deploy:local   # tự ghi nhiều biến vào backend/.env
3. backend → npm i · seed · npm run dev
4. frontend
```

---

## 2. Cài đặt

```bash
cd backend
cp .env.example .env          # lần đầu — sau đó bổ sung địa chỉ contract
npm install

# Seed tài khoản (admin / staff / warehouse / accountant / user)
npm run seed

# (Tuỳ chọn) Seed lại danh mục + 20 sách manga/anime nếu chưa có
npm run seed:anime

npm run dev                   # nodemon · http://localhost:5002
# hoặc: npm start
```

Khi `deploy:local` đã chạy trước đó, `backend/.env` thường đã có `BOOK_NFT_ADDRESS`, `BOOK_MARKETPLACE_ADDRESS`, `RPC_URL`, `CHAIN_ID`. Chỉ cần bổ sung JWT/Mongo nếu thiếu.

### Scripts npm

| Lệnh | Việc làm |
|------|----------|
| `npm run dev` | API + seed catalog khi boot + blockchain listener |
| `npm start` | Chạy production-style (không nodemon) |
| `npm run seed` | User mẫu (admin123 / user123…) |
| `npm run seed:anime` | Categories + publishers + suppliers + 20 manga |

### Kiểm tra nhanh

```bash
curl -s http://localhost:5002/api/health | jq
# { ok, mongo, ledger: { chainId, bookNft, blockNumber, … } }
```

---

## 3. Luồng hoạt động

### 3.1. Kiến trúc

```text
 MetaMask / Frontend                MongoDB
        │                              ▲
        ▼                              │
   Express /api  ────── catalog ───────┘
        │
        ├─ auth (JWT) · RBAC scopes
        ├─ books (mint → chain + file L2)
        ├─ stock / sales / suppliers / catalog
        ├─ wallet faucet (ETH lab)
        └─ ledger (+ SSE stream)
                │
                ▼
         ethers.js → Geth RPC
         BookNFT · BookMarketplace
                │
         blockchainListener
         (poll tip → TxNode → Book / Sale)
```

### 3.2. Boot (`server.js`)

1. Load `.env` (`dotenv`).
2. Kết nối MongoDB (`MONGODB_URI`).
3. Migrate catalog sách cũ (nếu có).
4. Seed idempotent: categories → publishers → suppliers → anime books.
5. `startBlockchainListener()` — đồng bộ TxNode từ chain.
6. Listen `PORT` (mặc định `5002`).

### 3.3. Nghiệp vụ chính

| Luồng | Mô tả ngắn |
|-------|------------|
| **Đăng ký / đăng nhập** | JWT (`JWT_SECRET`), role mặc định `user`; staff do admin gán |
| **Mint sách (admin)** | Unlock deployer → `mintBook` on-chain → sync Mongo + lưu PDF L2 (hash `sha256:…`) |
| **Đọc thử** | `GET /books/:id/sample` — tối đa 10 trang PDF |
| **Mua / sở hữu** | User mua qua MetaMask; listener ghi Sale + xuất kho; file full cần auth + quyền sở hữu |
| **Kho** | Nhập/xuất → phiếu 01-VT / 02-VT (PDF), dùng thông tin `WAREHOUSE_*` / `SELLER_*` |
| **Hóa đơn** | Sale → PDF GTGT (`VAT_*`, `INVOICE_*`, `SELLER_*`, `ETH_VND_RATE`) |
| **Faucet** | Cấp ETH lab từ deployer; giới hạn `FAUCET_*` |
| **Ledger** | `GET /ledger`, SSE `/ledger/stream` — tip + verify chuỗi TxNode |
| **RBAC admin** | Scopes theo role: admin / staff / warehouse / accountant |

### 3.4. API (prefix `/api`)

| Nhóm | Ví dụ |
|------|--------|
| Health | `GET /health` |
| Auth | `POST /auth/login`, `/register`, `GET /auth/me` |
| Books | `GET /books`, `POST /books/admin/mint`, sample/file |
| Ledger | `GET /ledger`, `/ledger/status`, `/ledger/stream` |
| Admin | `/admin/dashboard`, `/admin/users` (CRUD), faucet, resync |
| Catalog | `/categories`, `/publishers`, `/suppliers` |
| Stock / Sales | `/stock/*`, `/sales/*` |
| Wallet | `/wallet/balance/:addr`, faucet public |

Chi tiết phân quyền scope: `src/constants/roles.js`.

### 3.5. Tài khoản seed (`npm run seed`)

| Email | Password | Role |
|-------|----------|------|
| `admin@bookmarket.local` | `admin123` | admin |
| `staff@bookmarket.local` | `admin123` | staff |
| `warehouse@bookmarket.local` | `admin123` | warehouse |
| `accountant@bookmarket.local` | `admin123` | accountant |
| `user@bookmarket.local` | `user123` | user |

---

## 4. Lấy tham số cho `backend/.env`

Sao chép mẫu:

```bash
cp .env.example .env
```

Dưới đây: **ý nghĩa → cách lấy → giá trị lab điển hình**.

### 4.1. Server & Mongo

| Biến | Ý nghĩa | Cách lấy | Lab |
|------|---------|----------|-----|
| `PORT` | Cổng HTTP API | Tự chọn; tránh trùng (5001 thường bị app khác) | `5002` |
| `NODE_ENV` | Môi trường | `development` / `production` | `development` |
| `MONGODB_URI` | Chuỗi kết nối Mongo | Local: cài Mongo hoặc `docker run -d -p 27017:27017 mongo:7` | `mongodb://127.0.0.1:27017/bookmarket` |
| `CLIENT_ORIGIN` | Origin CORS cho frontend | Cổng Vite in ra khi `npm run dev` (có thể nhiều, cách nhau dấu phẩy) | `http://localhost:5173,http://localhost:5174` |

Kiểm tra Mongo:

```bash
mongosh "mongodb://127.0.0.1:27017/bookmarket" --eval 'db.runCommand({ ping: 1 })'
```

### 4.2. JWT

| Biến | Ý nghĩa | Cách lấy | Lab |
|------|---------|----------|-----|
| `JWT_SECRET` | Khoá ký token | Chuỗi ngẫu nhiên đủ dài (`openssl rand -hex 32`) | `bookmarket-dev-secret` (chỉ lab) |
| `JWT_EXPIRES_IN` | Thời hạn token | Chuỗi `jsonwebtoken` hiểu được | `7d` |

### 4.3. Blockchain / contract (bắt buộc để mint & ledger)

| Biến | Ý nghĩa | Cách lấy | Lab |
|------|---------|----------|-----|
| `NETWORK_NAME` | Tên hiển thị mạng | Trùng MetaMask / frontend | `BookMarket Private` |
| `CHAIN_ID` | ID mạng Geth | `genesis.json` → `config.chainId` hoặc `eth_chainId` | `54321` |
| `RPC_URL` | RPC Node 1 (miner) | `start-node1.sh` → `--http.port 8547` | `http://127.0.0.1:8547` |
| `RPC_URL_2` | RPC Node 2 (peer, tuỳ chọn) | `start-node2.sh` → `8548` | `http://127.0.0.1:8548` |
| `BOOK_NFT_ADDRESS` | Địa chỉ BookNFT | **Sau deploy:** console Hardhat, hoặc `smart-contract/deployments/localhost.json` → `BookNFT`, hoặc do `deploy.js` ghi sẵn vào `.env` | `0xF03F…` (đổi mỗi lần deploy lại) |
| `BOOK_MARKETPLACE_ADDRESS` | Địa chỉ Marketplace | Cùng nguồn → field `BookMarketplace` | `0x38B2…` |
| `DEPLOYER_ADDRESS` | Ví owner / faucet / mint | `genesis.json` alloc / `start-node1.sh --unlock` | `0xd18624683f144a400317Fc7ec8437a8deDeEE906` |
| `GETH_PASSWORD` | Mật khẩu unlock keystore Node1 | File `blockchain/private-net/password.txt` | `password` |
| `DEPLOYER_PRIVATE_KEY` | PK ký thay unlock (tuỳ chọn) | Export keystore lab — **không commit** | để trống nếu dùng `personal_unlockAccount` |

**Lấy địa chỉ contract nhanh:**

```bash
# Sau khi đã deploy
cat ../smart-contract/deployments/localhost.json

# Hoặc kiểm tra RPC sống
curl -s -X POST http://127.0.0.1:8547 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# "0xd431" = 54321
```

**Deploy tự ghi `.env`:**

```bash
cd ../smart-contract && npm run deploy:local
# → cập nhật BOOK_NFT_ADDRESS, BOOK_MARKETPLACE_ADDRESS, CHAIN_ID, RPC_URL…
```

ABI phải khớp address: file trong `src/abi/` được copy khi deploy. Nếu đổi contract mà không deploy lại → mint/ledger lỗi.

### 4.4. Faucet ETH (lab)

| Biến | Ý nghĩa | Lab |
|------|---------|-----|
| `FAUCET_AMOUNT_ETH` | Mức cấp mặc định / lần | `1` |
| `FAUCET_MAX_PUBLIC_ETH` | Trần 1 lần (user) | `5` |
| `FAUCET_MAX_ADMIN_ETH` | Trần 1 lần (admin faucet) | `100` |
| `FAUCET_SKIP_IF_BALANCE_ETH` | Bỏ qua nếu ví đã ≥ mức này | `2` |

Cần deployer còn ETH (alloc genesis) và unlock/`PRIVATE_KEY` hợp lệ.

### 4.5. Hóa đơn GTGT (sales PDF)

| Biến | Ý nghĩa | Cách lấy |
|------|---------|----------|
| `VAT_RATE_PERCENT` | % VAT trên PDF | Theo chính sách demo — lab `10` |
| `ETH_VND_RATE` | Tỷ giá quy đổi ETH→VND trên chứng từ | `0` = không quy đổi; hoặc điền số (vd `60000000`) |
| `INVOICE_TEMPLATE_CODE` | Mã mẫu hoá đơn | Tuỳ cấu hình kế toán demo |
| `INVOICE_SYMBOL` | Ký hiệu | vd `C26TAA` |
| `INVOICE_FORM` | Mẫu số | vd `01GTKT0/001` |
| `SELLER_LEGAL_NAME` | Tên người bán | Thông tin công ty demo |
| `SELLER_TAX_CODE` | MST | Demo |
| `SELLER_ADDRESS` / `PHONE` / `EMAIL` | Liên hệ trên PDF | Demo |
| `SELLER_BANK_ACCOUNT` / `SELLER_BANK_NAME` | TK ngân hàng (tuỳ chọn) | Để trống nếu không cần |

Các giá trị mặc định đã có trong `.env.example` — chỉ sửa khi in hoá đơn “thật” cho demo.

### 4.6. Phiếu kho 01-VT / 02-VT

| Biến | Ý nghĩa | Lab |
|------|---------|-----|
| `WAREHOUSE_NAME` | Tên kho trên phiếu | `Kho sách NFT BookMarket` |
| `WAREHOUSE_ADDRESS` | Địa điểm kho | Địa chỉ demo |
| `WAREHOUSE_DEPARTMENT` | Bộ phận | `Bộ phận Kho vận` |

Dùng trong `stockVoucherService` khi nhập/xuất kho.

---

## 5. Sơ đồ lấy `.env` (tóm tắt)

```text
MongoDB local/docker ─────────────────────► MONGODB_URI
Vite port (frontend) ─────────────────────► CLIENT_ORIGIN
openssl / tự đặt ─────────────────────────► JWT_SECRET

blockchain/private-net
  genesis.json / start-node*.sh
        ├─ chainId 54321 ─────────────────► CHAIN_ID
        ├─ :8547 / :8548 ─────────────────► RPC_URL / RPC_URL_2
        ├─ unlock address ────────────────► DEPLOYER_ADDRESS
        └─ password.txt ──────────────────► GETH_PASSWORD

smart-contract npm run deploy:local
        ├─ BookNFT address ───────────────► BOOK_NFT_ADDRESS
        ├─ Marketplace address ───────────► BOOK_MARKETPLACE_ADDRESS
        └─ copy ABI → backend/src/abi/

Tuỳ chọn keystore export ─────────────────► DEPLOYER_PRIVATE_KEY
Form kế toán / kho (tự soạn) ─────────────► SELLER_* · INVOICE_* · WAREHOUSE_* · FAUCET_*
```

---

## 6. Checklist trước `npm run dev`

1. Mongo đang chạy và URI đúng.
2. Geth Node1: `curl` RPC + `eth_chainId` = `54321`.
3. `.env` có `BOOK_NFT_ADDRESS` + `BOOK_MARKETPLACE_ADDRESS` (sau deploy).
4. `src/abi/BookNFT.json` tồn tại (deploy đã copy).
5. `DEPLOYER_ADDRESS` + (`GETH_PASSWORD` hoặc `DEPLOYER_PRIVATE_KEY`).
6. `npm run seed` đã chạy ít nhất một lần (có admin đăng nhập).

```bash
curl -s http://localhost:5002/api/health
curl -s http://localhost:5002/api/ledger/status
```

---

## 7. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| `MongoServerError` / không connect | Start Mongo; kiểm tra `MONGODB_URI` |
| `Missing BOOK_NFT_ADDRESS` / mint fail | Deploy contract → cập nhật `.env` + restart backend |
| Unlock / faucet fail | Node1 bật `personal`; đúng `GETH_PASSWORD`; hoặc điền `DEPLOYER_PRIVATE_KEY` |
| Ledger tip = 0 mãi | Sai RPC/address/ABI; hoặc chain reset cần deploy lại |
| CORS chặn frontend | Thêm origin Vite vào `CLIENT_ORIGIN` (hoặc dùng localhost — server đã nới lab) |
| Port in use | Đổi `PORT` (vd `5003`) và sửa `VITE_API_BASE_URL` frontend |
| Sample PDF lỗi | Sách chưa có `fileData` PDF — mint kèm file hoặc chạy `seed:anime` |

---

## 8. Bảo mật

- Không commit `.env` / private key.
- `JWT_SECRET` và `DEPLOYER_PRIVATE_KEY` chỉ dùng lab.
- RPC `personal` + unlock chỉ an toàn trên máy local.
- Đổi mật khẩu seed trước khi demo công khai.

---

## 9. Liên kết

- Smart contract & lấy RPC/deployer: [`../smart-contract/README.md`](../smart-contract/README.md)
- Private net Geth: [`../blockchain/private-net/README.md`](../blockchain/private-net/README.md)
- Tổng quan repo: [`../README.md`](../README.md)
