import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEngineActive, assertScope, engineIsActive } from "./permissions.server";
import { publishAndDispatch } from "./mesh.server";
import {
  materializeDailyPlanContext,
  protectedConflict,
  validateWindow,
} from "./daily-plan.server";

function localDate() {
  return new Date().toISOString().slice(0, 10);
}

async function emitDailyPlanChanged(
  context: { supabase: Parameters<typeof publishAndDispatch>[0]; userId: string },
  planId: string,
  planDate: string,
  reason: string,
) {
  if (!(await engineIsActive(context.supabase, context.userId, "daily-plan"))) return;
  await publishAndDispatch(context.supabase, context.userId, {
    type: "DailyPlanChanged",
    source_engine: "daily-plan",
    payload: {
      plan_id: planId,
      plan_date: planDate,
      reason,
    },
    idempotency_key: `daily-plan:${planId}:${reason}:${Date.now()}`,
  });
}

async function emitScheduleProposalResolved(
  context: { supabase: Parameters<typeof publishAndDispatch>[0]; userId: string },
  input: {
    proposalId: string;
    sourceEngine: string;
    externalProposalId: string;
    decision: "ACCEPT" | "REJECT";
  },
) {
  if (!(await engineIsActive(context.supabase, context.userId, "daily-plan"))) return;
  await publishAndDispatch(context.supabase, context.userId, {
    type: "ScheduleProposalResolved",
    source_engine: "daily-plan",
    payload: {
      proposal_id: input.proposalId,
      source_engine: input.sourceEngine,
      external_proposal_id: input.externalProposalId,
      decision: input.decision,
    },
    idempotency_key: `schedule-proposal:${input.proposalId}:${input.decision}`,
  });
}

async function planDateForId(
  context: { supabase: Parameters<typeof publishAndDispatch>[0]; userId: string },
  planId: string,
) {
  const { data, error } = await context.supabase
    .from("daily_plans")
    .select("plan_date")
    .eq("user_id", context.userId)
    .eq("id", planId)
    .single();
  if (error) throw new Error(error.message);
  return data.plan_date;
}

const DateInput = z.object({
  plan_date: z.string().date().optional(),
});

export const getDailyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const planDate = data.plan_date ?? localDate();
    const plan = await materializeDailyPlanContext(context.supabase, context.userId, planDate);

    const [{ data: items, error: itemsError }, { data: proposals, error: proposalsError }] =
      await Promise.all([
        context.supabase
          .from("daily_plan_items")
          .select("*")
          .eq("user_id", context.userId)
          .eq("plan_id", plan.id)
          .order("start_at", { ascending: true, nullsFirst: false })
          .order("priority", { ascending: true }),
        context.supabase
          .from("daily_plan_proposals")
          .select("*")
          .eq("user_id", context.userId)
          .eq("plan_date", planDate)
          .order("created_at", { ascending: true }),
      ]);

    if (itemsError) throw new Error(itemsError.message);
    if (proposalsError) throw new Error(proposalsError.message);
    return { plan, items: items ?? [], proposals: proposals ?? [] };
  });

const PlanItemInput = z.object({
  id: z.string().uuid().optional(),
  plan_date: z.string().date().optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
  source_type: z.enum(["kernel", "goal", "recommendation", "calendar"]).default("kernel"),
  source_id: z.string().max(160).nullable().optional(),
  priority: z.number().int().min(0).max(1000).default(100),
  protected: z.boolean().default(false),
  flexibility: z.enum(["fixed", "flexible", "moveable"]).default("flexible"),
  status: z.enum(["planned", "current", "completed", "missed", "deferred", "cancelled"]).default("planned"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const upsertDailyPlanItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanItemInput.parse(input))
  .handler(async ({ data, context }) => {
    validateWindow(data.start_at, data.end_at);
    const planDate = data.plan_date ?? localDate();
    const plan = await materializeDailyPlanContext(context.supabase, context.userId, planDate);

    const { data: existing, error: existingError } = await context.supabase
      .from("daily_plan_items")
      .select("id, start_at, end_at, protected")
      .eq("user_id", context.userId)
      .eq("plan_id", plan.id);
    if (existingError) throw new Error(existingError.message);

    const conflict = protectedConflict(
      {
        start_at: data.start_at ?? null,
        end_at: data.end_at ?? null,
        protected: data.protected,
        id: data.id,
      },
      existing ?? [],
      data.id,
    );
    if (conflict) {
      throw new Error("This time conflicts with a protected commitment in the Daily Operating Plan.");
    }

    const row = {
      user_id: context.userId,
      plan_id: plan.id,
      title: data.title,
      description: data.description ?? null,
      start_at: data.start_at ?? null,
      end_at: data.end_at ?? null,
      source_type: data.source_type,
      source_id: data.source_id ?? null,
      source_engine: null,
      priority: data.priority,
      protected: data.protected,
      flexibility: data.flexibility,
      status: data.status,
      metadata: data.metadata as never,
    };

    if (data.id) {
      const { data: item, error } = await context.supabase
        .from("daily_plan_items")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      await emitDailyPlanChanged(
        context,
        plan.id,
        planDate,
        "plan_item_updated",
      );
      return { item };
    }

    const { data: item, error } = await context.supabase
      .from("daily_plan_items")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await emitDailyPlanChanged(
      context,
      plan.id,
      planDate,
      "plan_item_created",
    );
    return { item };
  });

export const setDailyPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["planned", "current", "completed", "missed", "deferred", "cancelled"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: item, error } = await context.supabase
      .from("daily_plan_items")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("plan_id")
      .single();
    if (error) throw new Error(error.message);
    const planDate = await planDateForId(context, item.plan_id);
    await emitDailyPlanChanged(
      context,
      item.plan_id,
      planDate,
      `plan_item_status_${data.status}`,
    );
    return { ok: true };
  });

const ProposalInput = z.object({
  plan_date: z.string().date().optional(),
  source_engine: z.string().min(1).max(64),
  source_id: z.string().max(160).nullable().optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  requested_start: z.string().datetime().nullable().optional(),
  requested_end: z.string().datetime().nullable().optional(),
  minimum_duration_min: z.number().int().positive().max(1440).nullable().optional(),
  preferred_duration_min: z.number().int().positive().max(1440).nullable().optional(),
  flexibility: z.enum(["fixed", "flexible", "moveable"]).default("flexible"),
  priority: z.number().int().min(0).max(1000).default(100),
  protected: z.boolean().default(false),
  correlation_id: z.string().uuid().optional(),
});

export const submitDailyPlanProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProposalInput.parse(input))
  .handler(async ({ data, context }) => {
    validateWindow(data.requested_start, data.requested_end);
    await assertEngineActive(context.supabase, context.userId, data.source_engine);
    await assertScope(context.supabase, context.userId, data.source_engine, "daily_plan.propose");

    const { data: proposal, error } = await context.supabase
      .from("daily_plan_proposals")
      .insert({
        user_id: context.userId,
        plan_date: data.plan_date ?? localDate(),
        source_engine: data.source_engine,
        source_id: data.source_id ?? null,
        title: data.title,
        description: data.description ?? null,
        requested_start: data.requested_start ?? null,
        requested_end: data.requested_end ?? null,
        minimum_duration_min: data.minimum_duration_min ?? null,
        preferred_duration_min: data.preferred_duration_min ?? null,
        flexibility: data.flexibility,
        priority: data.priority,
        protected: data.protected,
        status: "pending",
        correlation_id: data.correlation_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { proposal };
  });

export const decideDailyPlanProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["accepted", "modified", "rejected", "deferred"]),
      start_at: z.string().datetime().nullable().optional(),
      end_at: z.string().datetime().nullable().optional(),
      title: z.string().min(1).max(160).optional(),
      note: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: proposal, error: readError } = await context.supabase
      .from("daily_plan_proposals")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (readError) throw new Error(readError.message);

    if (proposal.status !== "pending" && proposal.status !== "deferred") {
      throw new Error("This proposal has already been decided.");
    }

    const priorResolution =
      proposal.resolution && typeof proposal.resolution === "object"
        ? (proposal.resolution as Record<string, unknown>)
        : {};
    const externalProposalId =
      typeof priorResolution.external_proposal_id === "string"
        ? priorResolution.external_proposal_id
        : null;

    if (data.decision === "rejected" || data.decision === "deferred") {
      const { error } = await context.supabase
        .from("daily_plan_proposals")
        .update({
          status: data.decision,
          decided_at: new Date().toISOString(),
          resolution: {
            ...priorResolution,
            note: data.note ?? null,
          } as never,
        })
        .eq("id", proposal.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      if (
        data.decision === "rejected" &&
        externalProposalId &&
        proposal.source_engine === "execution-os"
      ) {
        await emitScheduleProposalResolved(context, {
          proposalId: proposal.id,
          sourceEngine: proposal.source_engine,
          externalProposalId,
          decision: "REJECT",
        });
      }
      return { decision: data.decision, item: null };
    }

    const startAt =
      data.decision === "modified" ? data.start_at ?? proposal.requested_start : proposal.requested_start;
    const endAt =
      data.decision === "modified" ? data.end_at ?? proposal.requested_end : proposal.requested_end;
    validateWindow(startAt, endAt);

    const plan = await materializeDailyPlanContext(context.supabase, context.userId, proposal.plan_date);
    const { data: existing, error: existingError } = await context.supabase
      .from("daily_plan_items")
      .select("id, start_at, end_at, protected")
      .eq("user_id", context.userId)
      .eq("plan_id", plan.id);
    if (existingError) throw new Error(existingError.message);

    const conflict = protectedConflict(
      { start_at: startAt, end_at: endAt, protected: proposal.protected },
      existing ?? [],
    );
    if (conflict) {
      throw new Error("The proposal conflicts with a protected commitment.");
    }

    const { data: item, error: itemError } = await context.supabase
      .from("daily_plan_items")
      .insert({
        user_id: context.userId,
        plan_id: plan.id,
        title: data.title ?? proposal.title,
        description: proposal.description,
        start_at: startAt,
        end_at: endAt,
        source_type: "engine",
        source_id: proposal.source_id,
        source_engine: proposal.source_engine,
        priority: proposal.priority,
        protected: proposal.protected,
        flexibility: proposal.flexibility,
        status: "planned",
        metadata: { proposal_id: proposal.id } as never,
      })
      .select()
      .single();
    if (itemError) throw new Error(itemError.message);

    const { error: updateError } = await context.supabase
      .from("daily_plan_proposals")
      .update({
        status: data.decision,
        accepted_item_id: item.id,
        decided_at: new Date().toISOString(),
        resolution: {
          ...priorResolution,
          start_at: startAt,
          end_at: endAt,
          note: data.note ?? null,
        } as never,
      })
      .eq("id", proposal.id)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);

    if (externalProposalId && proposal.source_engine === "execution-os") {
      await emitScheduleProposalResolved(context, {
        proposalId: proposal.id,
        sourceEngine: proposal.source_engine,
        externalProposalId,
        decision: "ACCEPT",
      });
    }
    await emitDailyPlanChanged(
      context,
      plan.id,
      proposal.plan_date,
      `schedule_proposal_${data.decision}`,
    );

    return { decision: data.decision, item };
  });

export const activateDailyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const plan = await materializeDailyPlanContext(context.supabase, context.userId, data.plan_date ?? localDate());
    const { data: active, error } = await context.supabase
      .from("daily_plans")
      .update({ status: "active", generated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { plan: active };
  });
