import React from "react";

export default function GradientBackgroundWrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#4DA6FF]/10 via-[#34C759]/10 to-[#9D4EDD]/10">
      {children}
    </main>
  );
}
