# BookMarket — Sàn sách truyện trên blockchain

Sàn giao dịch sách / manga dạng NFT: mỗi giao dịch tạo một **TxNode** liên kết hash với node trước (chuỗi provenance on-chain). Catalog, kho, hóa đơn và PDF đọc thử nằm ở Mongo; sở hữu & thanh toán nằm trên Geth private-net.

```text
BookMarket/
├── blockchain/private-net/   # Geth Clique PoA (chainId 54321, RPC :8547)
├── smart-contract/           # Solidity + Hardhat (BookNFT, BookMarketplace)
├── backend/                  # Express + MongoDB + chain listener
└── frontend/                 # React + Vite (User + Admin RBAC)
```

## Mục lục

1. [Tổng quan thành phần](#1-tổng-quan-thành-phần)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Luồng hoạt động chi tiết](#3-luồng-hoạt-động-chi-tiết)
   - [3.1. Khởi động & deploy](#31-khởi-động--deploy)
   - [3.2. Đăng nhập / phân quyền](#32-đăng-nhập--phân-quyền)
   - [3.3. Phát hành sách (mint)](#33-phát-hành-sách-mint)
   - [3.4. Duyệt kệ & đọc thử](#34-duyệt-kệ--đọc-thử)
   - [3.5. Mua sách (sơ cấp)](#35-mua-sách-sơ-cấp)
   - [3.6. Bán lại (marketplace)](#36-bán-lại-marketplace)
   - [3.7. Kho & hóa đơn](#37-kho--hóa-đơn)
   - [3.8. Faucet ETH lab](#38-faucet-eth-lab)
   - [3.9. Ledger / provenance](#39-ledger--provenance)
4. [Luồng đi của dữ liệu](#4-luồng-đi-của-dữ-liệu)
   - [4.1. Bản đồ dữ liệu theo lớp](#41-bản-đồ-dữ-liệu-theo-lớp)
   - [4.2. Đồng bộ chain → Mongo](#42-đồng-bộ-chain--mongo)
   - [4.3. File PDF (L2)](#43-file-pdf-l2)
   - [4.4. TxNode hash chain](#44-txnode-hash-chain)
5. [Cách chạy dự án](#5-cách-chạy-dự-án)
   - [5.0. Yêu cầu môi trường](#50-yêu-cầu-môi-trường)
   - [5.1. Private net (Geth)](#51-private-net-geth)
   - [5.2. Deploy smart contract](#52-deploy-smart-contract)
   - [5.3. Backend](#53-backend)
   - [5.4. Frontend](#54-frontend)
   - [5.5. Checklist & mua sách được](#55-checklist--mua-sách-được)
   - [5.6. Khi giao dịch lỗi](#56-khi-giao-dịch-lỗi)
6. [Tài khoản & MetaMask](#6-tài-khoản--metamask)
   - [6.1. Tài khoản web](#61-tài-khoản-web)
   - [6.2. Các bước kết nối MetaMask](#62-các-bước-kết-nối-metamask)
   - [6.3. Thêm mạng thủ công](#63-thêm-mạng-thủ-công)
   - [6.4. Nhận ETH faucet & mua sách](#64-nhận-eth-faucet--mua-sách)
   - [6.5. Lỗi thường gặp](#65-lỗi-thường-gặp)
7. [API chính](#7-api-chính)
8. [Tài liệu chi tiết từng phần](#8-tài-liệu-chi-tiết-từng-phần)

---

## 1. Tổng quan thành phần

| Thư mục | Vai trò | Cổng / ID |
|---------|---------|-----------|
| `blockchain/private-net` | 2 node Geth Clique PoA | RPC `:8547` / `:8548`, chainId **54321** |
| `smart-contract` | `BookNFT` (ERC-721 + TxNode), `BookMarketplace` (escrow) | Deploy → ghi `.env` backend/frontend |
| `backend` | REST API, JWT, RBAC, kho, hóa đơn, PDF, listener | `:5002` |
| `frontend` | Sàn user + admin console | Vite `:5174` |

---

## 2. Kiến trúc hệ thống

```text
  Browser (React)
  Auth JWT · Cart · Wallet/MetaMask · Admin RBAC
       |                              |
       | HTTP /api                    | eth_sendTransaction
       v                              v
  Backend (Express)  <--- RPC --->  Geth private-net
  Controllers/services              BookNFT · BookMarketplace
  blockchainListener                TxNode tip
       |
       v
  MongoDB
  User · Book · Transaction · Sale · StockMovement
  Book.fileData (PDF L2)
```

- **On-chain:** quyền sở hữu NFT, giá bán, chuỗi TxNode (Mint / Sale / Transfer / Faucet).
- **Off-chain (Mongo):** metadata catalog, tồn kho, NCC/NXB/danh mục, hóa đơn, PDF đầy đủ / mẫu đọc thử.
- **Frontend:** đọc catalog qua API; giao dịch mua ký bằng MetaMask trực tiếp lên contract.

---

## 3. Luồng hoạt động chi tiết

### 3.1. Khởi động & deploy

```text
[1] start-node1/2 + peers
        |
        v
[2] hardhat deploy:local
        - BookNFT(owner, treasury)
        - BookMarketplace(owner, nft, treasury, feeBps=500)
        - setMarketplace
        - mint 3 sách demo (tuỳ script)
        - ghi ABI + BOOK_* / VITE_* vào .env
        |
        v
[3] backend boot
        - connect Mongo · seed catalog/users
        - startBlockchainListener (poll tip)
        |
        v
[4] frontend Vite · MetaMask mạng 54321
```

### 3.2. Đăng nhập / phân quyền

```text
User form --> POST /api/auth/login
         --> JWT (bm_token) --> localStorage
         --> role: user | admin | staff | warehouse | accountant

canAccessAdmin?
  - Có  --> link Admin + /admin (sidebar lọc theo scope)
  - Không --> chỉ sàn người dùng
```

| Role | Scope chính |
|------|-------------|
| admin | `*` (toàn bộ) |
| staff | dashboard, mint, books, stock, catalog |
| warehouse | dashboard, books, stock, catalog |
| accountant | dashboard, sales, ledger |
| user | không vào admin |

### 3.3. Phát hành sách (mint)

```text
Admin UI (Mint / Books)
  --> multipart: metadata + cover + PDF
  --> POST /api/books/admin/mint  (scope: mint)
        |
        |-- sha256(PDF) --> metadataURI = sha256:<hash>
        |-- unlock deployer (GETH_PASSWORD hoặc PRIVATE_KEY)
        |-- BookNFT.mintBook(to, title, author, genre, uri, priceWei)
        |      · _safeMint · _appendNode(Mint)
        |-- đợi tip / syncBookFromChain(bookId)
        +-- ghi Mongo Book: catalog + fileData + quantity + forSale
```

Kết quả: NFT trên chain + bản ghi catalog + PDF L2 trong Mongo.

### 3.4. Duyệt kệ & đọc thử

```text
Home --> GET /api/books
BookDetail --> GET /api/books/:bookId (+ chain nodes)
Đọc thử --> GET /api/books/:bookId/sample
            · cắt PDF <= 10 trang (pdf-lib)
            · không cần mua / không cần ví
Đọc full --> GET /api/books/:bookId/file
            · JWT + ownerWallet khớp (hoặc quyền admin xem)
```

### 3.5. Mua sách (sơ cấp)

```text
User: Kết nối MetaMask (chain 54321)
  --> (tuỳ chọn) giỏ hàng local
  --> contract.buyBook(bookId) { value: listedPrice }
        |
        |-- on-chain: transfer NFT · TxNode Sale · trả ETH seller
        |
        +-- listener / backfill
              · upsert Transaction
              · cập nhật Book.ownerWallet, forSale=false
              · issue Sale invoice + phiếu xuất kho 02-VT
```

Frontend gọi contract trực tiếp; backend **không** giữ private key user.

### 3.6. Bán lại (marketplace)

```text
Seller (đã sở hữu NFT)
  --> marketplace.listBook(bookId, price)
        · clearPrimaryListing · transfer NFT --> escrow (contract)

Buyer
  --> marketplace.buyListedBook{value}(bookId)
        · fee = price * feeBps / 10000 --> treasury
        · seller nhận phần còn lại
        · BookNFT.marketSettle --> TxNode Sale (from = seller thật)
```

### 3.7. Kho & hóa đơn

```text
Nhập kho (admin/warehouse)
  --> POST /api/stock/...
  --> tăng Book.quantity · costPrice
  --> StockMovement type=in · PDF phiếu 01-VT

Xuất kho (khi bán)
  --> gắn saleId · type=out · PDF 02-VT

Hóa đơn GTGT
  --> Sale document · PDF (VAT, SELLER_*, ETH_VND_RATE)
```

Chứng từ dùng biến `WAREHOUSE_*` / `SELLER_*` / `INVOICE_*` (xem `backend/README.md`).

### 3.8. Faucet ETH lab

```text
Public / Admin faucet
  --> backend unlock deployer
  --> eth_sendTransaction ETH --> địa chỉ user
  --> BookNFT.recordFaucet(to, amount) · TxNode Faucet (bookId=0)
```

Giới hạn: `FAUCET_AMOUNT_ETH`, `FAUCET_MAX_*`, `FAUCET_SKIP_IF_BALANCE_ETH`.

### 3.9. Ledger / provenance

```text
GET /api/ledger · /ledger/status · SSE /ledger/stream
UI /ledger + admin tab Giao dịch
  · tip = latestNodeIndex / latestNodeHash
  · verifyChain(index) trên contract
  · mỗi node: action, bookId, from, to, price, prevNodeHash, nodeHash
```

---

## 4. Luồng đi của dữ liệu

### 4.1. Bản đồ dữ liệu theo lớp

```text
[ UI state ]
  React state / Cart (local) / JWT / MetaMask address
        | REST / SSE                | JSON-RPC
        v                           v
[ API layer ]                 [ Geth / contracts ]
  DTO JSON (book, user, sale)   ownership · listings · TxNode tip
        |
        v
[ MongoDB ]
  users · books (+ fileData) · transactions
  sales · stock_movements · categories · publishers · suppliers
```

| Thực thể | Nguồn sự thật | Bản sao / mở rộng |
|----------|---------------|-------------------|
| Owner NFT | Chain `ownerOf` | `Book.ownerWallet` (listener) |
| Giá / forSale sơ cấp | Chain `BookInfo` | `Book.listedPriceWei`, `forSale` |
| Listing secondary | Marketplace `listings` | `Book.marketListed`, `marketPriceWei` |
| Provenance | Chain TxNode | collection `transactions` |
| Tên / mô tả / ảnh / ISBN | Mongo catalog | on-chain title/author/genre lúc mint |
| PDF nội dung | Mongo `fileData` | on-chain chỉ `sha256:` URI |
| Tồn kho | Mongo `quantity` + StockMovement | không có trên chain |
| User / role | Mongo User | JWT (role lấy lại từ DB khi authorize) |

### 4.2. Đồng bộ chain → Mongo

```text
  mint / buy / faucet tx
        |
        v
  Geth tip tăng
        |
        v
  blockchainListener poll
        |
        +--> readTxNode(i) --> upsert Transaction
        |
        +--> bookId > 0 --> syncBookFromChain
        |         owner, forSale, market*
        |         nodeIndexes, latestHash
        |
        +--> Sale action --> issueSaleInvoice
        |         Sale + xuất kho
        |
        +--> liveHub SSE --> frontend ledger
```

Admin có **Resync / Refresh sách** (`/api/admin/resync`, `/books/:id/refresh`) khi Mongo lệch chain.

### 4.3. File PDF (L2)

```text
Upload mint
  --> buffer PDF
  --> contentHash = sha256(buffer)
  --> on-chain metadataURI = "sha256:" + contentHash
  --> Mongo: fileData, fileName, mimeType, fileSize

Đọc thử:  fileData --> pdf-lib cắt <= 10 trang --> stream
Đọc full: kiểm tra JWT + owner --> stream fileData gốc
```

Sách seed manga (`seed:anime`, bookId `9001+`) gắn PDF mẫu để demo UI/catalog; mint qua admin mới gắn đầy đủ tip chain.

### 4.4. TxNode hash chain

Mỗi node:

```text
nodeHash = keccak256(
  index, bookId, from, to, price, action, timestamp, prevNodeHash
)
```

```text
Genesis tip (0)
  --> Mint   #1  (prev = 0)
  --> Sale   #2  (prev = hash#1)
  --> Faucet #3  (prev = hash#2, bookId = 0)
  --> ...
```

`action`: `Mint` · `Transfer` · `Sale` · `Faucet`.  
UI ledger đọc Mongo (đã sync) và đối chiếu tip qua `/api/ledger/status`.

---

## 5. Cách chạy dự án

Chạy theo thứ tự dưới đây. Lab tối thiểu chỉ cần **Node1 Geth** — Node2 là tuỳ chọn.

> **Quan trọng (tránh lỗi mua/mint):**  
> 1) **Không** ghi đè `backend/.env` / `frontend/.env` bằng `.env.example` sau khi đã `deploy:local` — địa chỉ contract mẫu trong example **không** khớp chain của bạn.  
> 2) `npm run seed:anime` chỉ tạo catalog Mongo — sách **chưa có NFT on-chain** → MetaMask mua sẽ lỗi. Muốn mua demo manga: `npm run seed:anime:chain` (sau deploy) hoặc mint qua Admin.

### 5.0. Yêu cầu môi trường

| Công cụ | Ghi chú |
|---------|---------|
| **Node.js** ≥ 18 + npm | `node -v` |
| **Geth** trong `PATH` | `geth version` — [tải Geth](https://geth.ethereum.org/downloads). Windows có thể đặt tại `C:\geth\geth.exe` |
| **MongoDB** | Local `:27017` hoặc Docker: `docker run -d -p 27017:27017 --name bm-mongo mongo:7` |
| MetaMask | Mạng lab chainId **54321**, RPC `http://127.0.0.1:8547` (xem §6) |

Datadir `blockchain/private-net/node1` đã init sẵn — **không** xóa trừ khi cố ý reset chain (reset → phải deploy lại + mint lại).

### 5.1. Private net (Geth)

**Windows (PowerShell)** — terminal 1 (giữ mở):

```powershell
cd blockchain\private-net
.\start-node1.ps1
# RPC http://127.0.0.1:8547 · chainId 54321 · API personal + unlock deployer
```

**Linux / macOS / Git Bash:**

```bash
cd blockchain/private-net
./start-node1.sh          # bắt buộc — giữ terminal mở
./start-node2.sh          # tuỳ chọn
./connect-peers.sh        # chỉ khi chạy cả 2 node
```

Kiểm tra RPC — **PowerShell:**

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8547 -Method Post -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# Kỳ vọng: result = 0xd431  (= 54321)
```

**bash:**

```bash
curl -s -X POST http://127.0.0.1:8547 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

> Node1 phải có API `personal` (đã bật trong script). Thiếu `personal` → faucet / mint / deploy unlock fail.

### 5.2. Deploy smart contract

Làm **mỗi lần** khởi động lab mới, hoặc khi `eth_getCode(BOOK_NFT_ADDRESS)` trả `0x` (contract không còn trên chain):

```powershell
cd smart-contract
# Chỉ copy .env.example nếu CHƯA có smart-contract/.env
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npx hardhat compile
npm run deploy:local
```

`deploy:local` **tự ghi** địa chỉ + ABI vào `backend/.env` và `frontend/.env`.  
Sau deploy: **restart backend** (và reload frontend / Vite) để nạp địa chỉ mới.

### 5.3. Backend

```powershell
# MongoDB đang chạy
cd backend
# KHÔNG Copy-Item .env.example .env nếu đã deploy — sẽ mất BOOK_* thật
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run seed                 # users admin/user (bắt buộc lần đầu)
# Catalog demo có thể mua được trên chain:
npm run seed:anime:chain     # mint manga lên Geth + gắn bookId Mongo (cần Geth + contract)
# Hoặc chỉ UI catalog (KHÔNG mua được): npm run seed:anime
npm run dev                  # http://localhost:5002
```

Health: http://localhost:5002/api/health

### 5.4. Frontend

```powershell
cd frontend
# KHÔNG ghi đè .env sau deploy
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev                  # http://localhost:5174
```

Mở **http://localhost:5174** → đăng nhập (§6.1) → Kết nối MetaMask (§6.2) → faucet → mua.

### 5.5. Checklist & mua sách được

| Bước | Kỳ vọng |
|------|----------|
| Geth | `eth_chainId` = `0xd431`, RPC `:8547` đang listen |
| Deploy | `backend/.env` và `frontend/.env` cùng một `BOOK_NFT` / `VITE_BOOK_NFT` (không phải địa chỉ trong `.env.example`) |
| Code on-chain | `eth_getCode(VITE_BOOK_NFT_ADDRESS)` ≠ `0x` |
| Sách mua được | Đã `seed:anime:chain` **hoặc** Admin mint (có NFT + `forSale`) — không chỉ `seed:anime` |
| MetaMask | Chain **54321**, RPC `127.0.0.1:8547`, đã faucet, đủ ETH |
| Restart | Backend đã restart sau lần deploy gần nhất |

**Thứ tự đúng:** MongoDB → Geth node1 → `deploy:local` → backend `seed` + `seed:anime:chain` + `dev` → frontend `dev` → MetaMask faucet → mua.

### 5.6. Khi giao dịch lỗi

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|------------|------------------------|------------|
| `BAD_DATA` / `ownerOf` / «không tồn tại trên chain» | Địa chỉ contract trong `.env` lệch (copy nhầm `.env.example`) hoặc sách chỉ có trong Mongo (`seed:anime`) | Chạy lại `deploy:local`, **không** ghi đè `.env`; `seed:anime:chain` hoặc Admin mint; restart backend + hard-reload Vite |
| Faucet / mint «không unlock deployer» | Geth thiếu `personal` hoặc sai `GETH_PASSWORD` | Restart bằng `start-node1.ps1` / `.sh`; `GETH_PASSWORD` = nội dung `blockchain/private-net/password.txt` |
| «Sai mạng» / revert khi Confirm | MetaMask RPC/chainId sai (`:8545` / `12345`) | §6.3 — chỉ dùng `54321` + `:8547` |
| «không đủ ETH» | Chưa faucet | Bấm faucet trên header rồi mua lại |
| Mua OK nhưng không vào «Sách của tôi» | Listener chưa sync | Đợi vài giây; Admin Resync; kiểm tra backend còn nối RPC |

Chi tiết từng phần: [`blockchain/private-net/README.md`](blockchain/private-net/README.md) · [`smart-contract/README.md`](smart-contract/README.md) · [`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md).

---

## 6. Tài khoản & MetaMask

### 6.1. Tài khoản web

| Vai trò | Email | Password |
|---------|--------|----------|
| Admin | admin@bookmarket.local | admin123 |
| Staff / Warehouse / Accountant | `*@bookmarket.local` | admin123 |
| User | user@bookmarket.local | user123 |

Đăng nhập tại http://localhost:5174/login (sau khi đã chạy backend + seed users).

### 6.2. Các bước kết nối MetaMask

**Điều kiện trước:** Geth node1 đang chạy (`http://127.0.0.1:8547`), backend `:5002`, frontend `:5174`, contract đã deploy.

```text
[1] Cài MetaMask (Chrome / Edge / Firefox)
        |
        v
[2] Mở http://localhost:5174  →  Đăng nhập (tuỳ chọn nhưng nên có để link ví)
        |
        v
[3] Bấm «Kết nối ví» (góc phải header)
        |
        +-- MetaMask hỏi quyền kết nối site → Approve / Kết nối
        |
        +-- App gọi wallet_switchEthereumChain (chainId 54321)
        |         · Chưa có mạng → wallet_addEthereumChain
        |         · Hiện popup «Approve» thêm BookMarket Private → Approve
        |
        v
[4] Header hiện địa chỉ ví (0xAbcd…1234)
        · Đúng mạng: không còn banner «Sai mạng»
        · Sai mạng: bấm «Chuyển mạng» trên banner đỏ
        |
        v
[5] (Khuyến nghị) Nhận ETH faucet → rồi mua sách
```

Chi tiết từng bước:

1. **Cài extension** [MetaMask](https://metamask.io/download/) và tạo/import ví lab (không dùng ví chính có tiền thật).
2. **Chạy private-net** — Node1 RPC phải lắng nghe `http://127.0.0.1:8547`, `eth_chainId` = `0xd431` (= **54321**).
3. **Mở sàn** http://localhost:5174 — nên đăng nhập `user@bookmarket.local` / `user123` để app gắn ví vào tài khoản (`link-wallet`).
4. **Bấm «Kết nối ví»** trên header:
   - MetaMask: chọn tài khoản → **Next** → **Connect**.
   - Nếu chưa có mạng lab: popup **Add network** / **Approve** cho `BookMarket Private` → **Approve**.
   - Nếu đang ở Ethereum Mainnet / mạng khác: popup **Switch network** → **Switch**.
5. **Kiểm tra thành công:**
   - Chip ví hiện `0x….` (rút gọn).
   - Không còn dòng cảnh báo *«MetaMask đang sai mạng»*.
   - MetaMask (góc trên) đang chọn mạng **BookMarket Private** (hoặc tên bạn đặt), không phải Ethereum Mainnet.

> App tự thêm/chuyển mạng theo `frontend/.env`: `VITE_CHAIN_ID=54321`, `VITE_RPC_URL=http://127.0.0.1:8547`, `VITE_NETWORK_NAME=BookMarket Private`.

### 6.3. Thêm mạng thủ công

Khi popup tự động bị từ chối hoặc Chrome chặn local RPC, thêm tay trong MetaMask:

1. MetaMask → biểu tượng mạng (trên cùng) → **Add network** / **Add a custom network**.
2. Điền:

| Trường | Giá trị |
|--------|---------|
| Network name | `BookMarket Private` |
| Default RPC URL | `http://127.0.0.1:8547` |
| Chain ID | **`54321`** |
| Currency symbol | `ETH` |
| Block explorer | (để trống) |

3. **Save** → chọn mạng vừa tạo.
4. Quay lại trang BookMarket → bấm lại **Kết nối ví**.

> **Không dùng** Chain ID `12345` hay RPC `:8545` của mạng lab/ticket khác — sẽ lỗi `ownerOf` / BAD_DATA / «Sai mạng».

**Chrome / Edge:** lần đầu gọi `127.0.0.1`, trình duyệt có thể hỏi *Local network access* — chọn **Allow**. Nếu RPC không vào được: Settings site → cho phép mạng cục bộ, rồi reload.

### 6.4. Nhận ETH faucet & mua sách

Ví lab thường chưa có ETH trên private-net.

1. Sau khi kết nối đúng mạng, bấm icon **giọt nước** (faucet) trên header *hoặc* nút faucet trên trang chi tiết sách.
2. Backend gửi ETH từ deployer → ví MetaMask (cần Geth `personal` unlock trên node1).
3. Vào trang sách → **Mua** → MetaMask hiện Confirm giao dịch → **Confirm**.
4. Chờ mined → vào **Sách của tôi** để đọc PDF đầy đủ.

Import thêm tài khoản deployer (tuỳ chọn, đã có sẵn ETH trên genesis):

| | |
|--|--|
| Địa chỉ | `0xd18624683f144a400317Fc7ec8437a8deDeEE906` |
| Mật khẩu keystore node1 | xem `blockchain/private-net/password.txt` (mặc định lab: `password`) |

Thường **không cần** import deployer — dùng faucet từ UI là đủ.

### 6.5. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| «Sai mạng MetaMask… chainId 54321» | Bấm **Chuyển mạng** / **Kết nối ví**; hoặc thêm mạng thủ công (§6.3) |
| «Unrecognized chain ID» | Approve **Add network**; nếu đã từ chối thì thêm thủ công |
| Kết nối được nhưng mua lỗi BAD_DATA | MetaMask → Networks → sửa RPC = `http://127.0.0.1:8547` (xóa mạng cũ `12345` nếu có) |
| Faucet / mua báo không đủ ETH | Chạy lại faucet; kiểm tra Geth node1 + `GETH_PASSWORD` backend |
| MetaMask không thấy `127.0.0.1` | Cho phép Local network access; thử RPC `http://localhost:8547` |
| Chip ví có địa chỉ nhưng banner «Sai mạng» | Đang lệch chain — bấm **Chuyển mạng**, không mua khi còn banner đỏ |

---


## 7. API chính

| Nhóm | Endpoint |
|------|----------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login\|register` · `GET /me` |
| Books | `GET /api/books` · `GET /:id` · sample/file · `POST /admin/mint` |
| Ledger | `GET /api/ledger` · `/status` · `/stream` |
| Admin | `/api/admin/dashboard` · users CRUD · faucet · resync |
| Catalog | `/api/categories` · `/publishers` · `/suppliers` |
| Stock / Sales | `/api/stock/*` · `/api/sales/*` |
| Wallet | `/api/wallet/*` |

---

## 8. Tài liệu chi tiết từng phần

| Phần | File |
|------|------|
| Private net Geth | [`blockchain/private-net/README.md`](blockchain/private-net/README.md) |
| Smart contract · `.env` · deploy | [`smart-contract/README.md`](smart-contract/README.md) |
| Backend · `.env` · API | [`backend/README.md`](backend/README.md) |
| Frontend · `.env` · MetaMask | [`frontend/README.md`](frontend/README.md) |
