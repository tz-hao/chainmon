interface DemoModeNoteProps {
  text?: string;
}

export function DemoModeNote({
  text = "Running in Demo Mode — no PostgreSQL detected, data is kept in server memory and resets on restart. Configure DATABASE_URL and run npm run db:push + db:seed for persistent storage.",
}: DemoModeNoteProps) {
  return (
    <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-300/90">
      <span className="font-semibold">Demo Mode:</span> {text}
    </p>
  );
}
