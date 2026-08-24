"use client";

import { useState, useTransition, type FormEvent } from "react";
import { exploreAction } from "@/actions/explore";

interface ExploreRegionFormProps {
  regionId: string;
  label: string;
}

export function ExploreRegionForm({ regionId, label }: ExploreRegionFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("regionId", regionId);
    startTransition(async () => {
      const result = await exploreAction(formData);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Exploring..." : `Explore ${label}`}
      </button>
      {error ? (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
