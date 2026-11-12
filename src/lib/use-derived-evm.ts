// src/lib/use-derived-evm.ts
// React client hook to fetch and cache deterministic EVM addresses derived via NEAR Chain Signatures MPC

import { useState, useEffect } from "react";

interface DerivedEvmState {
  evmAddress: string | null;
  checksumAddress: string | null;
  derivationPath: string;
  mpcContractId: string;
  isLoading: boolean;
  error: string | null;
}

const memoryCache: Record<string, { evmAddress: string; checksumAddress: string; derivationPath: string; mpcContractId: string }> = {};

export function useDerivedEvm(nearAccountId?: string, derivationPath: string = "ethereum,1"): DerivedEvmState {
  const [state, setState] = useState<DerivedEvmState>({
    evmAddress: null,
    checksumAddress: null,
    derivationPath,
    mpcContractId: "v1.signer-prod.testnet",
    isLoading: !!nearAccountId,
    error: null,
  });

  useEffect(() => {
    if (!nearAccountId) {
      setState((prev) => ({ ...prev, isLoading: false, evmAddress: null, checksumAddress: null }));
      return;
    }

    const cacheKey = `${nearAccountId.toLowerCase()}:${derivationPath}`;
    if (memoryCache[cacheKey]) {
      setState({
        ...memoryCache[cacheKey],
        isLoading: false,
        error: null,
      });
      return;
    }

    let isMounted = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetch(`/api/near/chain-signatures/derive?accountId=${encodeURIComponent(nearAccountId)}&path=${encodeURIComponent(derivationPath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          const resData = {
            evmAddress: data.data.evmAddress,
            checksumAddress: data.data.checksumAddress,
            derivationPath: data.data.derivationPath,
            mpcContractId: data.data.mpcContractId,
          };
          memoryCache[cacheKey] = resData;
          setState({
            ...resData,
            isLoading: false,
            error: null,
          });
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.error || "Failed to derive EVM address",
          }));
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message || "Network error deriving EVM address",
        }));
      });

    return () => {
      isMounted = false;
    };
  }, [nearAccountId, derivationPath]);

  return state;
}
