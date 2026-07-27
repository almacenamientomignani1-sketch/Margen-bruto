import { createContext, useContext, useState, useCallback } from "react";

const RemarketsCtx = createContext(null);

export function RemarketsProvider({ children }) {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState(null);

  const [instruments, setInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [instrumentsError, setInstrumentsError] = useState(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setConnError(null);
    try {
      const res = await fetch("/api/remarkets/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || `El proxy respondió ${res.status}`);
      setToken(data.token);
      return true;
    } catch (e) {
      setConnError(e.message);
      return false;
    } finally {
      setConnecting(false);
    }
  }, [username, password]);

  const disconnect = useCallback(() => {
    setToken(null);
    setInstruments([]);
  }, []);

  const loadInstruments = useCallback(async () => {
    if (!token) return;
    setLoadingInstruments(true);
    setInstrumentsError(null);
    try {
      const res = await fetch(`/api/remarkets/instruments?token=${encodeURIComponent(token)}&segment=DDA`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `El proxy respondió ${res.status}`);
      setInstruments(data.instruments || []);
    } catch (e) {
      setInstrumentsError(e.message);
    } finally {
      setLoadingInstruments(false);
    }
  }, [token]);

  // Trae la market data de un símbolo puntual. No guarda estado acá:
  // cada componente que lo llama decide qué hacer con el resultado.
  const fetchQuote = useCallback(
    async (symbol, entries = "BI,OF,LA,SE,CL") => {
      if (!token || !symbol) return null;
      try {
        const res = await fetch(
          `/api/remarkets/marketdata?token=${encodeURIComponent(token)}&symbol=${encodeURIComponent(
            symbol
          )}&entries=${encodeURIComponent(entries)}`
        );
        const data = await res.json();
        if (!res.ok) return null;
        return data.marketData || null;
      } catch {
        return null;
      }
    },
    [token]
  );

  const value = {
    token,
    username,
    setUsername,
    password,
    setPassword,
    connecting,
    connError,
    connect,
    disconnect,
    instruments,
    loadingInstruments,
    instrumentsError,
    loadInstruments,
    fetchQuote,
  };

  return <RemarketsCtx.Provider value={value}>{children}</RemarketsCtx.Provider>;
}

export function useRemarkets() {
  const ctx = useContext(RemarketsCtx);
  if (!ctx) throw new Error("useRemarkets debe usarse dentro de <RemarketsProvider>");
  return ctx;
}

// Helper de precio: prioriza último operado hoy > cierre anterior > ajuste.
export function resolvePrice(md) {
  if (!md) return { precio: null, etiqueta: "sin datos" };
  const priceLA = md?.LA?.price ?? null;
  const priceCL = md?.CL?.price ?? null;
  const priceSE = md?.SE?.price ?? null;
  if (priceLA != null) return { precio: priceLA, etiqueta: "último operado hoy" };
  if (priceCL != null) return { precio: priceCL, etiqueta: "cierre anterior" };
  if (priceSE != null) return { precio: priceSE, etiqueta: "ajuste" };
  return { precio: null, etiqueta: "sin datos" };
}
