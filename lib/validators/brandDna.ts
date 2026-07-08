import { z } from "zod";

// BrandDNA = 11 core personal fields + company context (companyName/offers/usp/region).
// All optional: onboarding can be saved partially and resumed. threeWords/offers are Json
// arrays in the schema; sourceFiles records uploaded file names for provenance.

const trimmedString = z.string().trim().max(5000);

export const brandDnaSchema = z.object({
  // --- lõi cá nhân ---
  whoAmI: trimmedString.optional(),
  field: trimmedString.optional(),
  threeWords: z.array(z.string().trim().min(1).max(40)).max(3).optional(),
  coreBeliefs: trimmedString.optional(),
  differentiation: trimmedString.optional(),
  personalStory: trimmedString.optional(),
  expertise: trimmedString.optional(),
  customerProfile: trimmedString.optional(),
  customerPain: trimmedString.optional(),
  customerMisunderstanding: trimmedString.optional(),
  marketEducationGoal: trimmedString.optional(),
  // --- bối cảnh doanh nghiệp (gộp company) ---
  companyName: trimmedString.optional(),
  offers: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  usp: trimmedString.optional(),
  region: trimmedString.optional(),
  // --- meta ---
  sourceFiles: z.array(z.string().max(300)).max(50).optional(),
});

export type BrandDnaInput = z.infer<typeof brandDnaSchema>;
