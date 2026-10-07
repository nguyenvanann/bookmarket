import { createContext, useContext, useEffect, useState } from "react";
import {
  CHAIN_ID,
  CHAIN_HEX,
  connectWallet,
  getEthereum,
} from "../services/contract";
import { useAuth } from "./AuthContext";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { user, linkWallet } = useAuth();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let eth;
    try {
      eth = getEthereum();
    } catch {
      return undefined;
    }

    const syncAccounts = (accs) => setAddress(accs?.[0] || "");
    const syncChain = (hex) => {
      try {
        setChainId(Number.parseInt(hex, 16));
      } catch {
        setChainId(null);
      }
    };

    eth.request({ method: "eth_accounts" }).then(syncAccounts).catch(() => {});
    eth.request({ method: "eth_chainId" }).then(syncChain).catch(() => {});

    eth.on?.("accountsChanged", syncAccounts);
    eth.on?.("chainChanged", syncChain);
    return () => {
      eth.removeListener?.("accountsChanged", syncAccounts);
      eth.removeListener?.("chainChanged", syncChain);
    };
  }, []);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const { address: addr } = await connectWallet();
      setAddress(addr);
      setChainId(CHAIN_ID);
      if (user) await linkWallet(addr);
      return addr;
    } catch (e) {
      setError(e.message || "Không kết nối được ví");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  /** Luôn đảm bảo đúng mạng trước khi mua / ký tx */
  async function ensureReady() {
    setBusy(true);
    setError("");
    try {
      const { address: addr } = await connectWallet();
      setAddress(addr);
      setChainId(CHAIN_ID);
      if (user) {
        try {
          await linkWallet(addr);
        } catch {
          /* link thất bại không chặn mua */
        }
      }
      return addr;
    } catch (e) {
      setError(e.message || "Không sẵn sàng ví");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const wrongNetwork = chainId != null && chainId !== CHAIN_ID;

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        wrongNetwork,
        expectedChainId: CHAIN_ID,
        expectedChainHex: CHAIN_HEX,
        busy,
        error,
        connect,
        ensureReady,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet phải dùng bên trong WalletProvider");
  }
  return ctx;
}
