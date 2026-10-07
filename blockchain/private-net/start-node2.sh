#!/bin/bash
cd "$(dirname "$0")"
geth --datadir node2 --networkid 54321 --port 30314 --http \
  --http.addr 127.0.0.1 --http.port 8548 \
  --http.api eth,net,web3,admin,txpool --http.corsdomain "*" \
  --authrpc.port 8562 --nodiscover \
  --ipcpath /tmp/geth-bookmarket-node2.ipc \
  --verbosity 3
