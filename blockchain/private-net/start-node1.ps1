# Start Geth node1 (miner/signer) — RPC http://127.0.0.1:8547
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$geth = Get-Command geth -ErrorAction SilentlyContinue
if (-not $geth) {
  if (Test-Path "C:\geth\geth.exe") { $env:Path = "C:\geth;$env:Path" }
  else { throw "Geth was not found in PATH. Install Geth and try again." }
}

$listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 8547 }
if ($listening) {
  Write-Host "RPC :8547 is already listening (PID $($listening.OwningProcess)). Skipping start."
  exit 0
}

Write-Host "Starting BookMarket Geth node1 on :8547 ..."
& geth --datadir node1 --networkid 54321 --port 30313 --http `
  --http.addr 127.0.0.1 --http.port 8547 `
  --http.api eth,net,web3,admin,txpool,miner,personal --http.corsdomain "*" `
  --authrpc.port 8561 --nodiscover `
  --unlock 0xd18624683f144a400317Fc7ec8437a8deDeEE906 `
  --password password.txt --allow-insecure-unlock `
  --mine --miner.etherbase 0xd18624683f144a400317Fc7ec8437a8deDeEE906 `
  --ipcdisable `
  --verbosity 3
