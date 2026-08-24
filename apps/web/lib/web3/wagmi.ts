import { createConfig, http, injected } from "wagmi";
import { chainmonChain } from "./chain";

/** Client-safe wagmi config (injected wallets only — Phase 7 scope). */
export const wagmiConfig = createConfig({
  chains: [chainmonChain],
  connectors: [injected()],
  transports: {
    [chainmonChain.id]: http(),
  },
});
