"use client";
import * as React from "react";
import { PlasmicRootProvider, PlasmicComponent } from "@plasmicapp/loader-nextjs";
import type { ComponentRenderData } from "@plasmicapp/loader-nextjs";
import { PLASMIC } from "@/app/plasmic-init.client";

type Props = {
  prefetchedData?: ComponentRenderData;
  title: string;
  mastery: Record<string, number>;
  deckId: number;
};

export default function PlasmicDeckStudyClient({ prefetchedData, title, mastery, deckId }: Props) {
  return (
    <PlasmicRootProvider loader={PLASMIC} prefetchedData={prefetchedData}>
      <PlasmicComponent
        component="DeckStudy"
        componentProps={{
          AgentBriefing: { title },
          MasteryPills: { mastery, threshold: 80 },
          StudyModesGrid: { deckId },
        }}
      />
    </PlasmicRootProvider>
  );
}
