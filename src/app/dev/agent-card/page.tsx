import AgentCard from '@/components/AgentCard';

export default function Page() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <AgentCard displayName="Mock User" level={5} tokens={1250} />
      </div>
    </div>
  );
}
