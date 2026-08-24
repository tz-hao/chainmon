interface PhaseNoteProps {
  phase: string;
  text: string;
}

export function PhaseNote({ phase, text }: PhaseNoteProps) {
  return (
    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
      <span className="font-semibold">{phase}:</span> {text}
    </p>
  );
}
