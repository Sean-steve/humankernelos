import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Trash2, GripVertical, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { getMyProfile, updateMyProfile } from "@/lib/history.functions";
import { useSession } from "@/hooks/use-session";
import { identityStatements as defaultStatements } from "@/lib/hos-extras";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Human OS" },
      {
        name: "description",
        content: "Configure your Human OS identity, standards, and operating preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

type ProfileForm = {
  name: string;
  becoming: string;
  primary_standard: string;
  identity_statements: string[];
};

function SettingsPage() {
  const { session, loading: sessionLoading } = useSession();
  const getProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileForm>({
    name: "Operator",
    becoming: "A calm, compounding version of myself",
    primary_standard: "I never break a standard twice.",
    identity_statements: [...defaultStatements],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    getProfile()
      .then((res) => {
        if (res.profile) {
          const statements = Array.isArray(res.profile.identity_statements)
            ? (res.profile.identity_statements as string[])
            : [...defaultStatements];
          setForm({
            name: res.profile.name,
            becoming: res.profile.becoming,
            primary_standard: res.profile.primary_standard,
            identity_statements: statements,
          });
        }
      })
      .catch(() => {
        toast.error("Could not load your profile.");
      })
      .finally(() => setLoading(false));
  }, [session, sessionLoading, getProfile]);

  async function save() {
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        data: {
          name: form.name.trim(),
          becoming: form.becoming.trim(),
          primary_standard: form.primary_standard.trim(),
          identity_statements: form.identity_statements.map((s) => s.trim()).filter(Boolean),
        },
      });
      toast.success("Profile updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading) {
    return (
      <Shell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <PageHeader
          eyebrow="Settings"
          title="Configure your Kernel."
          intro="Sign in to edit your identity, standards, and operating preferences."
        />
        <div className="mt-6 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <Link to="/auth" className="text-foreground/90 hover:underline">
            Sign in to access settings →
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Settings"
        title="Configure your Kernel."
        intro="These values shape what the Home page greets you with, what the Advisor knows about who you are becoming, and the identity statements that ground every decision."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Identity card */}
          <section className="rounded-2xl border hairline bg-surface p-6">
            <h2 className="font-display text-lg">Identity</h2>
            <div className="mt-5 space-y-4">
              <Field
                label="Name"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Operator"
              />
              <Field
                label="Becoming"
                value={form.becoming}
                onChange={(v) => setForm((f) => ({ ...f, becoming: v }))}
                placeholder="A calm, compounding version of myself"
              />
              <Field
                label="Primary standard"
                value={form.primary_standard}
                onChange={(v) => setForm((f) => ({ ...f, primary_standard: v }))}
                placeholder="I never break a standard twice."
              />
            </div>
          </section>

          {/* Identity statements */}
          <section className="rounded-2xl border hairline bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Identity statements</h2>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    identity_statements: [...f.identity_statements, ""],
                  }))
                }
                className="inline-flex items-center gap-1.5 rounded-md border hairline bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Add statement
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Read one of these aloud during the Morning Boot sequence.
            </p>

            <ul className="mt-5 space-y-2">
              {form.identity_statements.map((statement, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg border hairline bg-background/40 p-2"
                >
                  <GripVertical className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={statement}
                    onChange={(e) => {
                      const next = [...form.identity_statements];
                      next[i] = e.target.value;
                      setForm((f) => ({ ...f, identity_statements: next }));
                    }}
                    placeholder="I am someone who…"
                    className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.identity_statements.filter((_, idx) => idx !== i);
                      setForm((f) => ({ ...f, identity_statements: next }));
                    }}
                    className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove statement"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border hairline bg-surface p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Connected account
          </div>
          <div className="mt-2 text-sm text-foreground/90">
            {session.user.email ?? "signed in"}
          </div>
          <div className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Your profile, check-ins, and reflections are private to this account.
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border hairline bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
      />
    </div>
  );
}
