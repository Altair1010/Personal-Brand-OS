// Canonical-seed builder — reusable by seed.ts (CLI) and the M10 reset action.
// IDEMPOTENT: upsert on stable id/slug/key only. NO PrismaClient here, NO process.argv.
// Accepts either a full PrismaClient or a $transaction client (reset action passes tx).
import type { Prisma, PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OBJECTIVES, OBJECTIVE_COLORS } from "../lib/constants";

// A client usable both as PrismaClient and inside $transaction.
export type SeedDb = PrismaClient | Prisma.TransactionClient;

// --- fixed ids (stable keys → idempotent) ---
const USER_ID = "local";
const GOAL_ID = "goal-default";
const APPSTATE_ID = "singleton";
const AIMODEL_ID = "aimodel-default";

type SeedData = {
  domain: string;
  profile: { name: string; headline?: string; bio?: string };
  brandDna: Record<string, unknown> & {
    whoAmI?: string;
    field?: string;
    threeWords?: string[];
    coreBeliefs?: string;
    differentiation?: string;
    personalStory?: string;
    expertise?: string;
    customerProfile?: string;
    customerPain?: string;
    customerMisunderstanding?: string;
    marketEducationGoal?: string;
    companyName?: string;
    offers?: string[];
    usp?: string;
    region?: string;
  };
  goal: {
    name: string;
    goalType: string;
    targetAudience?: string;
    mainOffer?: string;
    mainMessage?: string;
  };
};

function loadData(domain: string): SeedData {
  const file = join(__dirname, "..", "data", "seed", `${domain}.json`);
  return JSON.parse(readFileSync(file, "utf-8")) as SeedData;
}

// --- Vietnamese labels for the 6 canonical objectives ---
const OBJECTIVE_LABELS: Record<string, string> = {
  seo: "SEO / Tìm kiếm",
  educate: "Giáo dục",
  trust: "Xây niềm tin",
  conversion: "Chuyển đổi",
  story: "Kể chuyện",
  community: "Cộng đồng",
};

const OBJECTIVE_DESC: Record<string, string> = {
  seo: "Nội dung phủ từ khóa, tăng khả năng được tìm thấy.",
  educate: "Cung cấp kiến thức, giải thích khái niệm cho khán giả.",
  trust: "Chứng minh năng lực, minh bạch để tạo lòng tin.",
  conversion: "Kêu gọi hành động, dẫn tới sản phẩm/dịch vụ.",
  story: "Kể câu chuyện cá nhân, chạm cảm xúc.",
  community: "Tương tác, gắn kết và nuôi dưỡng cộng đồng.",
};

// --- 4 canonical frameworks (domain-agnostic, tiếng Việt) ---
const FRAMEWORKS = [
  {
    slug: "aida",
    name: "AIDA",
    summary: "Attention – Interest – Desire – Action: dẫn dắt từ chú ý tới hành động.",
    steps: [
      "Attention: mở đầu gây chú ý, chạm nỗi đau hoặc điều bất ngờ.",
      "Interest: khơi gợi hứng thú bằng thông tin/góc nhìn liên quan.",
      "Desire: tạo khao khát bằng lợi ích, bằng chứng, câu chuyện.",
      "Action: kêu gọi hành động rõ ràng.",
    ],
    whenToUse: "Bài bán hàng, giới thiệu offer, chuyển đổi nhanh.",
    example: "Mở bằng câu hỏi nhức nhối → nêu insight → chứng minh kết quả → CTA đăng ký.",
  },
  {
    slug: "pas",
    name: "PAS",
    summary: "Problem – Agitate – Solution: khoét sâu vấn đề rồi đưa giải pháp.",
    steps: [
      "Problem: gọi tên vấn đề khán giả đang gặp.",
      "Agitate: làm rõ hậu quả, khoét sâu nỗi đau.",
      "Solution: giới thiệu giải pháp và bằng chứng.",
    ],
    whenToUse: "Nội dung chạm nỗi đau, thuyết phục người còn do dự.",
    example: "Bạn liên tục thất bại? → hậu quả nếu tiếp diễn → phương pháp giải quyết.",
  },
  {
    slug: "bab",
    name: "BAB",
    summary: "Before – After – Bridge: vẽ hiện trạng, kết quả mong muốn và cầu nối.",
    steps: [
      "Before: mô tả tình trạng hiện tại đầy khó khăn.",
      "After: hình dung trạng thái lý tưởng sau khi giải quyết.",
      "Bridge: chỉ ra cách/giải pháp để đi từ Before tới After.",
    ],
    whenToUse: "Kể chuyển hóa, truyền cảm hứng, giới thiệu lộ trình.",
    example: "Trước đây loay hoay → sau khi áp dụng thấy khác biệt → đây là cách.",
  },
  {
    slug: "storybrand",
    name: "StoryBrand",
    summary: "Khách hàng là nhân vật chính, thương hiệu là người dẫn đường.",
    steps: [
      "Nhân vật: xác định khách hàng và mong muốn của họ.",
      "Vấn đề: nêu trở ngại họ đối mặt.",
      "Người dẫn đường: thương hiệu xuất hiện với sự thấu hiểu và năng lực.",
      "Kế hoạch: đưa ra lộ trình rõ ràng.",
      "Kêu gọi & kết quả: CTA và hình dung thành công.",
    ],
    whenToUse: "Định vị thương hiệu, nội dung xây dựng vai trò chuyên gia.",
    example: "Bạn muốn X nhưng vướng Y → tôi đã giúp nhiều người → làm theo 3 bước này.",
  },
];

// --- 3–5 content templates covering several objectives ---
const TEMPLATES = [
  {
    id: "tpl-educate-howto",
    name: "Hướng dẫn từng bước",
    objectiveKey: "educate",
    description: "Chia nhỏ một quy trình thành các bước dễ làm theo.",
    structure: {
      hook: "Nêu vấn đề người xem muốn giải quyết",
      body: ["Bước 1", "Bước 2", "Bước 3"],
      ending: "Tóm tắt và mời áp dụng",
    },
    exampleOutput: "3 bước để bắt đầu đúng cách ngay hôm nay...",
  },
  {
    id: "tpl-trust-casestudy",
    name: "Câu chuyện kết quả (case study)",
    objectiveKey: "trust",
    description: "Kể một trường hợp thực tế để chứng minh năng lực.",
    structure: {
      hook: "Tình huống ban đầu của khách hàng",
      body: ["Vấn đề gặp phải", "Cách xử lý", "Kết quả đạt được"],
      ending: "Bài học rút ra",
    },
    exampleOutput: "Một học viên từng thất bại, sau khi áp dụng đã...",
  },
  {
    id: "tpl-story-personal",
    name: "Chuyện cá nhân",
    objectiveKey: "story",
    description: "Chia sẻ trải nghiệm cá nhân để tạo kết nối cảm xúc.",
    structure: {
      hook: "Khoảnh khắc bước ngoặt",
      body: ["Bối cảnh", "Thử thách", "Thay đổi"],
      ending: "Thông điệp gửi gắm",
    },
    exampleOutput: "Có một lần tôi đã sai lầm lớn, và nó dạy tôi rằng...",
  },
  {
    id: "tpl-conversion-offer",
    name: "Giới thiệu offer",
    objectiveKey: "conversion",
    description: "Dẫn dắt tới sản phẩm/dịch vụ với CTA rõ ràng.",
    structure: {
      hook: "Nỗi đau khán giả đang chịu",
      body: ["Giải pháp là gì", "Lợi ích chính", "Bằng chứng/ưu đãi"],
      ending: "Lời kêu gọi hành động",
    },
    exampleOutput: "Nếu bạn đang gặp X, đây là cách chúng tôi giúp...",
  },
  {
    id: "tpl-community-question",
    name: "Câu hỏi tương tác",
    objectiveKey: "community",
    description: "Đặt câu hỏi mở để khơi bình luận và gắn kết cộng đồng.",
    structure: {
      hook: "Câu hỏi hoặc chủ đề gây tranh luận nhẹ",
      body: ["Bối cảnh ngắn", "Góc nhìn của bạn"],
      ending: "Mời khán giả chia sẻ ý kiến",
    },
    exampleOutput: "Bạn nghĩ sao về điều này? Comment cho tôi biết nhé...",
  },
];

// --- 12 canonical PromptTemplate rows (moduleKey → name/instruction) ---
const PROMPT_TEMPLATES: { moduleKey: string; name: string; systemInstruction: string }[] = [
  {
    moduleKey: "brand-dna",
    name: "Brand DNA Analyzer",
    systemInstruction:
      "D.1 Brand DNA Analyzer — canonical prompt lives in lib/prompts/brand-dna.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "audience",
    name: "Audience Persona Builder",
    systemInstruction:
      "Audience Persona Builder — canonical prompt lives in lib/prompts/audience.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "pillars",
    name: "Content Pillar Generator",
    systemInstruction:
      "Content Pillar Generator — canonical prompt lives in lib/prompts/pillars.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "strategy",
    name: "Strategy Arc 30d",
    systemInstruction:
      "Strategy Arc 30d — canonical prompt lives in lib/prompts/strategy.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "weekly-plan",
    name: "Weekly to Daily Planner",
    systemInstruction:
      "Weekly to Daily Planner — canonical prompt lives in lib/prompts/weekly-plan.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "content-idea",
    name: "Daily Idea Generator",
    systemInstruction:
      "Daily Idea Generator — canonical prompt lives in lib/prompts/content-idea.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "post-writer",
    name: "Post Writer",
    systemInstruction:
      "Post Writer — canonical prompt lives in lib/prompts/post-writer.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "hook",
    name: "Hook Generator",
    systemInstruction:
      "Hook Generator — canonical prompt lives in lib/prompts/hook.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "cta",
    name: "CTA Writer",
    systemInstruction:
      "CTA Writer — canonical prompt lives in lib/prompts/cta.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "tone",
    name: "Tone Adjuster",
    systemInstruction:
      "Tone Adjuster — canonical prompt lives in lib/prompts/tone.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "performance",
    name: "Performance Analyzer",
    systemInstruction:
      "Performance Analyzer — canonical prompt lives in lib/prompts/performance.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
  {
    moduleKey: "revision",
    name: "Revision Engine",
    systemInstruction:
      "Revision Engine — canonical logic lives in lib/strategy-engine/applyRevision.ts (source of truth); this row exists so PromptRun can reference a template.",
  },
];

/**
 * Build the canonical seed for a domain. Idempotent (upsert on stable keys).
 * Safe to call with a PrismaClient (CLI) or a $transaction client (reset action).
 */
export async function seedCore(db: SeedDb, domain: string): Promise<void> {
  const data = loadData(domain);

  // 1. UserProfile (singleton "local")
  await db.userProfile.upsert({
    where: { id: USER_ID },
    update: {
      name: data.profile.name,
      headline: data.profile.headline ?? null,
      bio: data.profile.bio ?? null,
    },
    create: {
      id: USER_ID,
      name: data.profile.name,
      headline: data.profile.headline ?? null,
      bio: data.profile.bio ?? null,
    },
  });

  // 2. BrandDNA (userId unique)
  const dna = data.brandDna;
  await db.brandDNA.upsert({
    where: { userId: USER_ID },
    update: {
      whoAmI: dna.whoAmI,
      field: dna.field,
      threeWords: dna.threeWords ?? undefined,
      coreBeliefs: dna.coreBeliefs,
      differentiation: dna.differentiation,
      personalStory: dna.personalStory,
      expertise: dna.expertise,
      customerProfile: dna.customerProfile,
      customerPain: dna.customerPain,
      customerMisunderstanding: dna.customerMisunderstanding,
      marketEducationGoal: dna.marketEducationGoal,
      companyName: dna.companyName,
      offers: dna.offers ?? undefined,
      usp: dna.usp,
      region: dna.region,
    },
    create: {
      userId: USER_ID,
      whoAmI: dna.whoAmI,
      field: dna.field,
      threeWords: dna.threeWords ?? undefined,
      coreBeliefs: dna.coreBeliefs,
      differentiation: dna.differentiation,
      personalStory: dna.personalStory,
      expertise: dna.expertise,
      customerProfile: dna.customerProfile,
      customerPain: dna.customerPain,
      customerMisunderstanding: dna.customerMisunderstanding,
      marketEducationGoal: dna.marketEducationGoal,
      companyName: dna.companyName,
      offers: dna.offers ?? undefined,
      usp: dna.usp,
      region: dna.region,
    },
  });

  // 3. Goal (fixed id)
  await db.goal.upsert({
    where: { id: GOAL_ID },
    update: {
      name: data.goal.name,
      goalType: data.goal.goalType,
      targetAudience: data.goal.targetAudience,
      mainOffer: data.goal.mainOffer,
      mainMessage: data.goal.mainMessage,
    },
    create: {
      id: GOAL_ID,
      userId: USER_ID,
      name: data.goal.name,
      goalType: data.goal.goalType,
      targetAudience: data.goal.targetAudience,
      mainOffer: data.goal.mainOffer,
      mainMessage: data.goal.mainMessage,
    },
  });

  // 4. AppState singleton → activeGoalId
  await db.appState.upsert({
    where: { id: APPSTATE_ID },
    update: { activeGoalId: GOAL_ID },
    create: { id: APPSTATE_ID, activeGoalId: GOAL_ID },
  });

  // 5. 6 ContentObjective — keys strictly from OBJECTIVES
  for (const key of OBJECTIVES) {
    await db.contentObjective.upsert({
      where: { key },
      update: {
        label: OBJECTIVE_LABELS[key],
        description: OBJECTIVE_DESC[key],
        color: OBJECTIVE_COLORS[key],
      },
      create: {
        key,
        label: OBJECTIVE_LABELS[key],
        description: OBJECTIVE_DESC[key],
        color: OBJECTIVE_COLORS[key],
      },
    });
  }

  // 6. 4 Framework (upsert by slug)
  for (const fw of FRAMEWORKS) {
    await db.framework.upsert({
      where: { slug: fw.slug },
      update: {
        name: fw.name,
        summary: fw.summary,
        steps: fw.steps,
        whenToUse: fw.whenToUse,
        example: fw.example,
      },
      create: {
        name: fw.name,
        slug: fw.slug,
        summary: fw.summary,
        steps: fw.steps,
        whenToUse: fw.whenToUse,
        example: fw.example,
      },
    });
  }

  // 7. ContentTemplate (upsert by fixed id; objectiveKey ∈ ContentObjective.key)
  for (const tpl of TEMPLATES) {
    await db.contentTemplate.upsert({
      where: { id: tpl.id },
      update: {
        name: tpl.name,
        objectiveKey: tpl.objectiveKey,
        structure: tpl.structure,
        description: tpl.description,
        exampleOutput: tpl.exampleOutput,
      },
      create: {
        id: tpl.id,
        name: tpl.name,
        objectiveKey: tpl.objectiveKey,
        structure: tpl.structure,
        description: tpl.description,
        exampleOutput: tpl.exampleOutput,
      },
    });
  }

  // 8. AIModelConfig — provider anthropic, model EMPTY (never hardcode), isDefault
  await db.aIModelConfig.upsert({
    where: { id: AIMODEL_ID },
    update: { provider: "anthropic", model: "", isDefault: true },
    create: {
      id: AIMODEL_ID,
      provider: "anthropic",
      model: "",
      isDefault: true,
    },
  });

  // 9. PromptTemplate — 12 canonical rows (canonical prompts live in code).
  //    Upsert on compound unique @@unique([moduleKey, version]) → moduleKey_version.
  for (const pt of PROMPT_TEMPLATES) {
    await db.promptTemplate.upsert({
      where: { moduleKey_version: { moduleKey: pt.moduleKey, version: 1 } },
      update: {},
      create: {
        moduleKey: pt.moduleKey,
        version: 1,
        name: pt.name,
        isActive: true,
        systemInstruction: pt.systemInstruction,
        userTemplate: "",
      },
    });
  }
}
