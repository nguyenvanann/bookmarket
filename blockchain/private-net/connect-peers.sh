#!/bin/bash
# Nối Node 2 → Node 1 (chạy sau khi cả 2 node đã start)
set -euo pipefail

NODE1_RPC="${NODE1_RPC:-http://127.0.0.1:8547}"
NODE2_RPC="${NODE2_RPC:-http://127.0.0.1:8548}"

ENODE=$(curl -s -X POST "$NODE1_RPC" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['enode'])")

# Ép host về 127.0.0.1 (tránh [::] trên một số máy)
ENODE=$(python3 -c "import re,sys; e=sys.argv[1]; print(re.sub(r'@[^:]+:', '@127.0.0.1:', e))" "$ENODE")

echo "addPeer → $ENODE"
curl -s -X POST "$NODE2_RPC" -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$ENODE\"],\"id\":1}"
echo

sleep 2
echo -n "peerCount (node2): "
curl -s -X POST "$NODE2_RPC" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":2}'
echo
echo -n "blockNumber (node1): "
curl -s -X POST "$NODE1_RPC" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":3}'
echo
echo -n "blockNumber (node2): "
curl -s -X POST "$NODE2_RPC" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":4}'
echo
