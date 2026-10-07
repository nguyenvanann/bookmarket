#!/bin/bash
cd "$(dirname "$0")"
geth --datadir node1 --networkid 54321 --port 30313 --http \
  --http.addr 127.0.0.1 --http.port 8547 \
  --http.api eth,net,web3,admin,txpool,miner,personal --http.corsdomain "*" \
  --authrpc.port 8561 --nodiscover \
  --unlock 0xd18624683f144a400317Fc7ec8437a8deDeEE906 \
  --password password.txt --allow-insecure-unlock \
  --mine --miner.etherbase 0xd18624683f144a400317Fc7ec8437a8deDeEE906 \
  --ipcpath /tmp/geth-bookmarket-node1.ipc \
  --verbosity 3
