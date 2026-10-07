# Smart Contract — BookMarket

Hướng dẫn cài đặt, luồng hoạt động on-chain, và cách lấy từng tham số trong file `.env`.

```text
smart-contract/
├── contracts/
│   ├── BookNFT.sol           # ERC-721 sách + chuỗi TxNode provenance
│   └── BookMarketplace.sol   # Sàn bán lại (escrow) + phí treasury
├── scripts/deploy.js         # Deploy lên Geth private-net + ghi .env backend/frontend
├── test/                     # Hardhat unit tests
├── deployments/              # Địa chỉ contract sau deploy (localhost.json)
├── hardhat.config.js
└── .env                      # RPC + deployer (sao chép từ .env.example)
```

Mạng mục tiêu: **Geth Clique PoA** trong `blockchain/private-net/`

| Tham số | Giá trị hiện tại |
|---------|------------------|
| Chain ID | `54321` |
| RPC Node 1 | `http://127.0.0.1:8547` |
| RPC Node 2 | `http://127.0.0.1:8548` |
| Deployer (signer) | `0xd18624683f144a400317Fc7ec8437a8deDeEE906` |

> Không nhầm với mạng lab khác (`12345` / `:8545`). Hardhat chỉ deploy khi `chainId` ∈ `{54321, 12345, 31337}`.

---

## 1. Yêu cầu

- **Node.js** ≥ 18 + npm
- **Geth** trong `PATH` (`geth version`)
- Đã dựng / khởi động private-net (xem mục 3)
- (Tuỳ chọn) MongoDB + backend/frontend nếu chạy full stack

---

## 2. Cài đặt package

```bash
cd smart-contract
cp .env.example .env    # lần đầu
npm install
npx hardhat compile
npx hardhat test
```

Scripts npm:

| Lệnh | Việc làm |
|------|----------|
| `npm run compile` | Biên dịch Solidity → `artifacts/` |
| `npm test` | Chạy test trên Hardhat in-process |
| `npm run deploy:local` | Deploy lên RPC trong `.env` (`--network localhost`) |
| `npm run node` | Hardhat local node (chainId 31337 — không dùng cho Geth lab) |

---

## 3. Luồng hoạt động on-chain

### 3.1. Kiến trúc

```text
┌─────────────┐  mintBook / buyBook     ┌──────────────┐
│   Admin /   │ ──────────────────────► │   BookNFT    │  ERC-721 + TxNode chain
│   Backend   │                         └──────┬───────┘
└─────────────┘                                │ setMarketplace
                                               ▼
┌─────────────┐  listBook / buyListed   ┌──────────────┐
│  User +     │ ──────────────────────► │ Marketplace  │  escrow NFT, fee 5%
│  MetaMask   │                         └──────────────┘
└─────────────┘
        │
        ▼
  Mỗi Mint / Sale / Transfer / Faucet → 1 TxNode
  nodeHash = keccak256(index, bookId, from, to, price, action, timestamp, prevNodeHash)
```

### 3.2. Các bước nghiệp vụ

1. **Deploy**  
   - Deploy `BookNFT(owner, treasury)` → owner = deployer.  
   - Deploy `BookMarketplace(owner, bookNFT, treasury, feeBps=500)` (5%).  
   - Gọi `BookNFT.setMarketplace(market)`.  
   - Script mint 3 sách mẫu (demo) vào ví deployer.

2. **Phát hành (Mint)** — chỉ `owner`  
   `mintBook(to, title, author, genre, metadataURI, listedPrice)`  
   → mint NFT + **TxNode Mint** + (nếu `listedPrice > 0`) mở bán sơ cấp.

3. **Mua sơ cấp** — user  
   `buyBook(bookId)` gửi đúng `listedPrice` ETH  
   → chuyển NFT + **TxNode Sale** + trả ETH cho seller.

4. **Bán lại (secondary)**  
   - Seller: `marketplace.listBook(bookId, price)` → NFT vào escrow.  
   - Buyer: `marketplace.buyListedBook{value: price}(bookId)`  
   → phí `feeBps` về treasury, phần còn lại cho seller, `BookNFT.marketSettle` ghi **TxNode Sale**.

5. **Faucet lab** (owner)  
   `recordFaucet(to, amountWei)` → **TxNode Faucet** (bookId = 0), nối tip chuỗi.

6. **Backend sync**  
   Listener đọc tip / TxNode từ RPC → ghi Mongo → UI `/ledger`, kệ sách, admin.

### 3.3. Sau khi deploy, script còn làm gì?

`scripts/deploy.js` tự động:

- Ghi `deployments/localhost.json` (địa chỉ contract).
- Copy ABI → `backend/src/abi/` và `frontend/src/services/abi/`.
- Cập nhật `backend/.env` và `frontend/.env` với địa chỉ + RPC/chainId.

---

## 4. Lấy tham số cho `smart-contract/.env`

File mẫu: [`.env.example`](./.env.example).

```env
RPC_URL=http://127.0.0.1:8547
DEPLOYER_ADDRESS=0xd18624683f144a400317Fc7ec8437a8deDeEE906
DEPLOYER_PRIVATE_KEY=
```

### 4.1. `RPC_URL`

**Ý nghĩa:** HTTP JSON-RPC của Geth Node 1 (miner).

**Cách lấy (mạng đã dựng sẵn trong repo):**

1. Mở `blockchain/private-net/start-node1.sh` → dòng `--http.port 8547`.
2. Hoặc gọi thử:

```bash
curl -s -X POST http://127.0.0.1:8547 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

Kỳ vọng: `"result":"0xd431"` (= `54321`).

Nếu node chưa chạy:

```bash
cd blockchain/private-net
./start-node1.sh   # terminal 1
./start-node2.sh   # terminal 2
./connect-peers.sh # hoặc admin_addPeer theo README private-net
```

**Giá trị điền:** `RPC_URL=http://127.0.0.1:8547`

### 4.2. `DEPLOYER_ADDRESS`

**Ý nghĩa:** Ví signer/miner dùng để deploy & mint (owner contract).

**Cách lấy:**

| Nguồn | Lệnh / file |
|-------|-------------|
| Script start | `start-node1.sh` → `--unlock 0xd186…` |
| Genesis alloc | `blockchain/private-net/genesis.json` → key trong `"alloc"` |
| Keystore | `geth --datadir blockchain/private-net/node1 account list` |

Ví dụ:

```bash
cd blockchain/private-net
geth --datadir node1 account list
# Account #0: {d18624683f144a400317fc7ec8437a8deDeEE906} …
```

**Giá trị điền:** `DEPLOYER_ADDRESS=0xd18624683f144a400317Fc7ec8437a8deDeEE906`  
(viết hoa/thường checksum đều được; script dùng checksum sẵn có.)

### 4.3. `DEPLOYER_PRIVATE_KEY` (tuỳ chọn)

**Ý nghĩa:** Private key hex (có hoặc không tiền tố `0x`) để Hardhat ký transaction.

| Trường hợp | Cách làm |
|------------|----------|
| **Để trống (khuyến nghị lab)** | `deploy.js` gọi `personal_unlockAccount` trên Geth với mật khẩu trong `blockchain/private-net/password.txt` (mặc định `password`). Node1 phải bật API `personal` (đã có trong `start-node1.sh`). |
| **Điền private key** | Export từ keystore Geth (chỉ lab): |

```bash
# Cần mật khẩu trong password.txt
geth account update 0xd18624683f144a400317Fc7ec8437a8deDeEE906 \
  --datadir blockchain/private-net/node1
# hoặc dùng tool ethkey / tự decrypt keystore UTC--…--d186….

# Sau khi có hex key:
# DEPLOYER_PRIVATE_KEY=0x................................
```

> **Cảnh báo:** Không commit private key. File `.env` phải nằm trong `.gitignore`. Chỉ dùng key lab, không dùng ví mainnet.

Khi đã có `DEPLOYER_PRIVATE_KEY`, Hardhat dùng signer từ key (bỏ qua unlock `personal`).

### 4.4. Mật khẩu unlock (không nằm trong `.env` contract)

Đường dẫn cố định trong `deploy.js`:

```text
blockchain/private-net/password.txt
```

Nội dung mặc định: `password` (một dòng). Đổi file này nếu bạn đổi mật khẩu keystore Node 1 — đồng bộ với `--password` trong `start-node1.sh`.

---

## 5. Deploy lên private-net

### 5.1. Checklist trước deploy

1. Node1 RPC sống tại `RPC_URL`, `eth_chainId` = `54321`.
2. `smart-contract/.env` đã điền `RPC_URL` + `DEPLOYER_ADDRESS`.
3. Deployer còn ETH (`alloc` genesis = 1000 ETH).
4. Node1 đang mine (`--mine`).

Kiểm tra số dư:

```bash
curl -s -X POST http://127.0.0.1:8547 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xd18624683f144a400317Fc7ec8437a8deDeEE906","latest"],"id":1}'
```

### 5.2. Chạy deploy

```bash
cd smart-contract
npm run deploy:local
```

Console in ra dạng:

```text
Deployer: 0xd18624683f144a400317Fc7ec8437a8deDeEE906
Network chainId: 54321
BookNFT: 0x….
BookMarketplace: 0x….
--- .env hints ---
BOOK_NFT_ADDRESS=0x….
BOOK_MARKETPLACE_ADDRESS=0x….
```

### 5.3. Tham số sinh ra sau deploy (backend / frontend)

Không ghi vào `smart-contract/.env`, mà script ghi giúp:

**`backend/.env`**

| Biến | Nguồn |
|------|--------|
| `BOOK_NFT_ADDRESS` | Địa chỉ contract vừa deploy |
| `BOOK_MARKETPLACE_ADDRESS` | Địa chỉ marketplace vừa deploy |
| `CHAIN_ID` | `54321` |
| `RPC_URL` | `http://127.0.0.1:8547` |
| `RPC_URL_2` | `http://127.0.0.1:8548` |

Còn lại (JWT, Mongo…) lấy từ `backend/.env.example` nếu chưa có.

**`frontend/.env`**

| Biến | Nguồn |
|------|--------|
| `VITE_BOOK_NFT_ADDRESS` | = `BOOK_NFT_ADDRESS` |
| `VITE_BOOK_MARKETPLACE_ADDRESS` | = `BOOK_MARKETPLACE_ADDRESS` |
| `VITE_CHAIN_ID` | `54321` |
| `VITE_RPC_URL` | `http://127.0.0.1:8547` |
| `VITE_NETWORK_NAME` | `BookMarket Private` |

Địa chỉ cũng lưu tại `deployments/localhost.json` để đối chiếu.

### 5.4. MetaMask (user mua sách)

| Trường | Giá trị |
|--------|---------|
| Network name | BookMarket Private |
| RPC URL | `http://127.0.0.1:8547` |
| Chain ID | `54321` |
| Symbol | ETH |

Import ví lab hoặc nhận faucet từ admin → mua NFT trên sàn.

---

## 6. Thứ tự chạy full stack

```text
1. blockchain/private-net  →  start-node1 + node2 + peers
2. smart-contract          →  npm i · compile · deploy:local
3. backend                 →  .env (đã có địa chỉ) · npm run seed · npm run dev
4. frontend                →  .env (đã có VITE_*) · npm run dev
```

Chi tiết app: xem [`README.md`](../README.md) ở thư mục gốc và [`blockchain/private-net/README.md`](../blockchain/private-net/README.md).

---

## 7. Sơ đồ lấy `.env` (tóm tắt)

```text
genesis.json / start-node1.sh
        │
        ├─► RPC port 8547 ──────────────► RPC_URL
        ├─► unlock / alloc address ─────► DEPLOYER_ADDRESS
        └─► password.txt ───────────────► (unlock khi không có PRIVATE_KEY)

keystore (tuỳ chọn export) ─────────────► DEPLOYER_PRIVATE_KEY

npm run deploy:local
        │
        ├─► BOOK_NFT_ADDRESS              → backend/.env + frontend VITE_*
        ├─► BOOK_MARKETPLACE_ADDRESS
        ├─► CHAIN_ID / RPC_URL            → backend + frontend
        └─► deployments/localhost.json + ABI copy
```

---

## 8. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| `ECONNREFUSED 127.0.0.1:8547` | Chưa start Node1 → `./start-node1.sh` |
| `Unlock warning` / không gửi được tx | Bật `personal` trên Geth; đúng `password.txt`; hoặc điền `DEPLOYER_PRIVATE_KEY` |
| `Chỉ hỗ trợ deploy local` | Sai chainId — kiểm tra `eth_chainId` = `54321` |
| `ownerOf` / BAD_DATA trên UI | Frontend MetaMask đang trỏ mạng khác (`12345`/`8545`) |
| Contract address cũ sau reset chain | Deploy lại + restart backend/frontend để nhận ABI/.env mới |
| Số dư deployer = 0 | Sai địa chỉ hoặc genesis chưa alloc — đối chiếu `genesis.json` |

---

## 9. Bảo mật

- Chỉ dùng cho **lab / local**.
- Không commit `.env`, `password.txt`, keystore, private key.
- `personal` + `--allow-insecure-unlock` chỉ an toàn trên máy local, không expose RPC ra internet.
