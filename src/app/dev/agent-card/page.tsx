import AgentCard from '@/components/AgentCard';

export default function Page() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col items-center">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Dashboard (compact)</h2>
          <AgentCard displayName="Mock User" level={5} tokens={1250} variant="dashboard" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col items-center">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Default</h2>
          <AgentCard displayName="Mock User" level={5} tokens={1250} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col items-center">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Study (large)</h2>
          <AgentCard displayName="Mock User" level={5} tokens={1250} variant="study" />
        </div>
      </div>
    </div>
  );
}
