# Private Net — Go Ethereum (Geth) Clique PoA

Hướng dẫn dựng mạng Ethereum riêng tư **2 node** (1 miner/signer + 1 peer) dùng **Clique PoA**, `chainId = 12345`.

## Yêu cầu

- [Geth](https://geth.ethereum.org/downloads) đã cài và có trong `PATH` (`geth version`)
- Hai cửa sổ terminal (hoặc tmux/iTerm split)

## Trạng thái hiện tại (đã dựng sẵn)

| | Node 1 (miner/signer) | Node 2 (peer) |
|--|----------------------|---------------|
| Địa chỉ | `0xd18624683f144a400317Fc7ec8437a8deDeEE906` | `0xDe6941E4eD3cfd2c1CdC7363BFdf9000Ce19B158` |
| P2P port | `30313` | `30314` |
| HTTP RPC | `http://127.0.0.1:8547` | `http://127.0.0.1:8548` |
| AuthRPC | `8561` | `8562` |
| Số dư alloc | 1000 ETH | 1000 ETH |

> Cổng `30303`/`8545` đang bị dự án khác chiếm nên BookMarket dùng `30313`/`8547`.

Khởi động lại nhanh:

```bash
cd blockchain/private-net
./start-node1.sh   # terminal 1
./start-node2.sh   # terminal 2

# Nối peer (một lần sau khi cả 2 đã chạy)
curl -s -X POST http://127.0.0.1:8548 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"admin_addPeer","params":["enode://c9c4313ddab4af2d0ac9418a6985e5f8dd3552b8699e419ca249d0acbf94b051b87871dc183b3ae25ffdf446097e7f362d55369151440f1c5c087c83b0d84672@127.0.0.1:30313?discport=0"],"id":1}'
```

Lưu ý: chuỗi `enode://...` đổi nếu xóa `node1/` và init lại — lấy lại bằng:

```bash
curl -s -X POST http://127.0.0.1:8547 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}'
```

## Cấu trúc thư mục

```text
blockchain/private-net/
├── genesis.json      # chainId 12345, Clique PoA
├── password.txt      # Password signer (KHÔNG commit)
├── start-node1.sh
├── start-node2.sh
├── README.md
├── node1/            # datadir (không commit)
└── node2/            # datadir (không commit)
```

## Bước 1 — Password signer

File `password.txt` đã có sẵn nội dung mặc định `password`. Đổi nếu muốn:

```bash
cd blockchain/private-net
echo "password" > password.txt
```

> File này nằm trong `.gitignore`. Không commit lên git.

## Bước 2 — Tạo ví cho 2 node

```bash
cd blockchain/private-net

geth --datadir node1 account new --password password.txt
geth --datadir node2 account new --password password.txt
```

Ghi lại 2 địa chỉ (bỏ tiền tố `0x` khi ghép `extraData`):

| Vai trò | Biến trong README | Ví dụ |
|--------|-------------------|--------|
| Node 1 (signer / miner) | `SIGNER` | `f029ebe080aeacb5606902352d366e7ae9271e8d` |
| Node 2 (peer) | `NODE2` | `7ef6aaeb54172a6ec8ed063954c598bb990ead74` |

Liệt kê lại địa chỉ:

```bash
geth --datadir node1 account list
geth --datadir node2 account list
```

## Bước 3 — Điền `genesis.json`

Mở `genesis.json` và thay placeholder:

### 3.1. `extraData` (Clique)

Công thức:

```text
0x
+ 64 ký tự hex zero          (32 byte)
+ SIGNER (40 ký tự hex, KHÔNG có 0x, thường viết thường)
+ 130 ký tự hex zero         (65 byte)
```

Ví dụ nếu signer là `f029ebe080aeacb5606902352d366e7ae9271e8d`:

```text
0x0000000000000000000000000000000000000000000000000000000000000000f029ebe080aeacb5606902352d366e7ae9271e8d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
```

### 3.2. `alloc`

Cấp 1000 ETH (= `1000000000000000000000` Wei) cho cả hai ví:

```json
"alloc": {
  "0xSIGNER_ADDRESS": { "balance": "1000000000000000000000" },
  "0xNODE2_ADDRESS":  { "balance": "1000000000000000000000" }
}
```

### Tham số quan trọng

| Trường | Giá trị | Ý nghĩa |
|--------|---------|---------|
| `chainId` | `12345` | ID mạng riêng (MetaMask / Hardhat dùng cùng ID) |
| `clique.period` | `5` | Sinh block mỗi 5 giây (kể cả khi không có tx) |
| `clique.epoch` | `30000` | Chu kỳ reset vote Clique |
| `gasLimit` | `0x1C9C380` | ~30M gas / block |

## Bước 4 — Khởi tạo genesis cho cả 2 node

```bash
cd blockchain/private-net

geth --datadir node1 init genesis.json
geth --datadir node2 init genesis.json
```

Hai lệnh **phải** in cùng một **Genesis hash**. Nếu khác nhau → file genesis lệch nhau hoặc đã init trước đó với cấu hình cũ (xóa `node1`/`node2` rồi tạo account + init lại).

## Bước 5 — Chạy Node 1 (miner / signer)

Thay `0xSIGNER` bằng địa chỉ Node 1:

```bash
cd blockchain/private-net

geth --datadir node1 --networkid 12345 --port 30303 --http \
  --http.addr 127.0.0.1 --http.port 8545 \
  --http.api eth,net,web3,admin,txpool,miner --http.corsdomain "*" \
  --authrpc.port 8551 --nodiscover \
  --unlock 0xSIGNER \
  --password password.txt --allow-insecure-unlock \
  --mine --miner.etherbase 0xSIGNER \
  console
```

Kiểm tra nhanh trong console Node 1:

```javascript
eth.accounts
eth.blockNumber   // tăng dần ~ mỗi 5 giây
miner.mining      // true
```

RPC HTTP: `http://127.0.0.1:8545`

## Bước 6 — Chạy Node 2 (peer)

Mở terminal thứ hai:

```bash
cd blockchain/private-net

geth --datadir node2 --networkid 12345 --port 30304 --http \
  --http.addr 127.0.0.1 --http.port 8546 \
  --http.api eth,net,web3,admin,txpool --http.corsdomain "*" \
  --authrpc.port 8552 --nodiscover \
  console
```

RPC HTTP: `http://127.0.0.1:8546`

## Bước 7 — Nối hai node

Trên console **Node 1**:

```javascript
admin.nodeInfo.enode
```

Copy chuỗi `enode://...@127.0.0.1:30303?...`. Nếu thấy IP khác `127.0.0.1`, sửa lại thành `127.0.0.1` trước khi add peer.

Trên console **Node 2**:

```javascript
admin.addPeer("enode://...@127.0.0.1:30303?discport=0")
net.peerCount      // kỳ vọng: 1
eth.blockNumber    // đồng bộ theo Node 1 sau vài giây
```

## Bước 8 — (Tuỳ chọn) MetaMask

1. MetaMask → **Add network** → **Add a network manually**
2. Điền:
   - Network name: `BookMarket Private`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `12345`
   - Currency symbol: `ETH`
3. Import / tạo ví, rồi gửi ETH từ Node 1:

```javascript
// Trên console Node 1
eth.sendTransaction({
  from: eth.accounts[0],
  to: "0xDIA_CHI_METAMASK",
  value: web3.toWei(50, "ether")
})
```

## Bước 9 — Kiểm tra giao dịch & biên nhận

```javascript
// Gửi thử
var tx = eth.sendTransaction({
  from: eth.accounts[0],
  to: eth.accounts[0], // hoặc địa chỉ Node 2
  value: web3.toWei(1, "ether")
})

// Đợi 1 block rồi đọc biên nhận
eth.getTransactionReceipt(tx)
```

`status: "0x1"` = thành công; `gasUsed` transfer thường = `21000`.

## Reset mạng (làm lại từ đầu)

```bash
cd blockchain/private-net
rm -rf node1 node2
# Quay lại Bước 2 → tạo account mới → cập nhật genesis.json → init → start
```

## Kết nối từ Hardhat / app BookMarket

Khi deploy smart contract lên mạng này, cấu hình network tương đương:

```ts
// ví dụ hardhat.config.ts
networks: {
  bookmarket: {
    url: "http://127.0.0.1:8545",
    chainId: 12345,
    accounts: ["0xPRIVATE_KEY_CUA_SIGNER"], // lấy từ keystore nếu cần
  },
}
```

## Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|------------|---------------------------|
| `Genesis mismatch` / peer drop ngay sau `addPeer` | Hai node init khác genesis → xóa datadir, init lại cùng một `genesis.json` |
| Không ra block | Sai `extraData` (địa chỉ signer), quên `--mine` / `--unlock`, hoặc password sai |
| `account unlock with HTTP access is forbidden` | Thêm `--allow-insecure-unlock` (chỉ dùng local) |
| Port đã dùng | Đổi `--port` / `--http.port` / `--authrpc.port` |
| MetaMask không kết nối | Node 1 phải chạy với `--http` và CORS; Chain ID phải đúng `12345` |

## Ghi chú bảo mật

- Mạng này chỉ dành cho **lab / local**. Không dùng password / key thật trên mainnet.
- Không commit `password.txt`, `node1/`, `node2/` (đã có trong `.gitignore`).
