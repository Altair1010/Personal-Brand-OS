import type { PromptModule } from "@/lib/ai/run";
import { audienceModule } from "./audience";
import { brandDnaModule } from "./brand-dna";
import { ctaModule } from "./cta";
import { contentRatioModule } from "./content-ratio";
import { hookModule } from "./hook";
import { performanceModule } from "./performance";
import { pillarsModule } from "./pillars";
import { postWriterModule } from "./post-writer";
import { revisionModule } from "./revision";
import { strategyModule } from "./strategy";
import { toneModule } from "./tone";
import { weeklyPlanModule } from "./weekly-plan";

type AnyPromptModule = PromptModule<unknown, unknown>;

const modules = [
  audienceModule,
  brandDnaModule,
  contentRatioModule,
  ctaModule,
  hookModule,
  performanceModule,
  pillarsModule,
  postWriterModule,
  revisionModule,
  strategyModule,
  toneModule,
  weeklyPlanModule,
] as readonly PromptModule<any, any>[];

const byKey = new Map<string, PromptModule<any, any>>(
  modules.map((module) => [module.key, module]),
);

export function getPromptModule(key: string): AnyPromptModule | null {
  return (byKey.get(key) as AnyPromptModule | undefined) ?? null;
}
