import { WalletLoginPanel } from "@/components/WalletLoginPanel";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md animate-fade-in-up pt-10">
      <WalletLoginPanel />
    </div>
  );
}
