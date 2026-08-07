"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signupSchema, type SignupInput } from "@/lib/auth/schemas";

export default function SignupPage() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ defaultValues: { name: "", email: "", password: "" } });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as keyof SignupInput, { message: issue.message });
      }
      return;
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setFormError(body?.error ?? "That account couldn't be created. Try again.");
      return;
    }

    router.push("/login?created=1");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>An owner adds you to a workspace after you sign up.</CardDescription>
      </CardHeader>
      <CardBody>
        {formError ? (
          <p role="alert" className="mb-4 rounded-sm border border-red-line bg-red-bg px-3 py-2 text-label text-red-fg">
            {formError}
          </p>
        ) : null}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Name" error={errors.name?.message}>
            <Input autoComplete="name" {...register("name")} />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </FormField>
          <FormField label="Password" description="At least 8 characters." error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...register("password")} />
          </FormField>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-body text-fg-100">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-fg hover:underline">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
