"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}

// useSearchParams() opts a page out of static prerendering unless the
// component that calls it is wrapped in Suspense — split out so `next
// build` can still prerender the surrounding Card chrome.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSignedUp = searchParams.get("created") === "1";
  const noWorkspace = searchParams.get("no-workspace") === "1";
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as keyof LoginInput, { message: issue.message });
      }
      return;
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setFormError(body?.error ?? "Something kept that sign-in from going through. Try again.");
      return;
    }

    const body = (await response.json()) as { workspaceSlug: string | null };
    if (!body.workspaceSlug) {
      router.push("/login?no-workspace=1");
      return;
    }
    router.push(`/w/${body.workspaceSlug}/today`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to KILN</CardTitle>
        <CardDescription>Your agency's operating system.</CardDescription>
      </CardHeader>
      <CardBody>
        {justSignedUp ? (
          <p className="mb-4 rounded-sm border border-emerald-line bg-emerald-bg px-3 py-2 text-label text-emerald-fg">
            Account created. Sign in below.
          </p>
        ) : null}
        {noWorkspace ? (
          <p className="mb-4 rounded-sm border border-amber-line bg-amber-bg px-3 py-2 text-label text-amber-fg">
            You're signed in, but not a member of any workspace yet. Ask a workspace owner to add
            you.
          </p>
        ) : null}
        {formError ? (
          <p role="alert" className="mb-4 rounded-sm border border-red-line bg-red-bg px-3 py-2 text-label text-red-fg">
            {formError}
          </p>
        ) : null}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </FormField>
          <FormField label="Password" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...register("password")} />
          </FormField>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-body text-fg-100">
          New here?{" "}
          <Link href="/signup" className="text-blue-fg hover:underline">
            Create an account
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
