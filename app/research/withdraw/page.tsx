"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { InlineSpinner } from "@/app/research/_components/InlineSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previousTokenSchema } from "@/lib/validation";

const withdrawFormSchema = z.object({
  token: previousTokenSchema,
});

type WithdrawFormValues = z.infer<typeof withdrawFormSchema>;

export default function WithdrawPage() {
  const [withdrawnCount, setWithdrawnCount] = useState<number | null>(null);
  const {
    formState: { errors, isValid },
    handleSubmit,
    register,
  } = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawFormSchema),
    defaultValues: {
      token: "",
    },
    mode: "onBlur",
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = handleSubmit(async ({ token }) => {
    setSubmitting(true);
    setWithdrawnCount(null);

    try {
      const response = await fetch("/api/submissions/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = (await response.json()) as {
        error?: string;
        withdrawn_count?: number;
      };

      if (!response.ok) {
        toast.error(data.error || "The withdrawal request could not be completed.");
        return;
      }

      setWithdrawnCount(data.withdrawn_count ?? 0);
      toast.success("Withdrawal request completed.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The withdrawal request could not be completed.",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-[28px] border border-border/80 bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" />
            Withdrawal
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Withdraw submitted data</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Enter the withdrawal token you received after submission. This request marks
            all linked submissions as withdrawn before publication.
          </p>
        </div>

        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-3">
            <Label htmlFor="token">Withdrawal token</Label>
            <Input
              id="token"
              {...register("token")}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder="Paste your withdrawal token"
            />
            {errors.token ? (
              <p className="text-sm text-destructive">{errors.token.message}</p>
            ) : null}
          </div>

          {submitting ? (
            <div className="rounded-2xl border border-border/80 px-4 py-3 text-sm text-muted-foreground">
              <InlineSpinner label="Processing withdrawal..." />
            </div>
          ) : null}

          {withdrawnCount !== null ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-muted-foreground">
              {withdrawnCount > 0
                ? `Marked ${withdrawnCount} submission${withdrawnCount === 1 ? "" : "s"} as withdrawn.`
                : "No active submissions were found for that token."}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" asChild>
              <Link href="/research">Back to submission form</Link>
            </Button>
            <Button type="submit" disabled={submitting || !isValid}>
              Submit withdrawal request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
