import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data?.session) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
});

import SignInForm from "@/components/sign-in-form";

function RouteComponent() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <SignInForm onSwitchToSignUp={() => window.location.href = "/signup"} />
    </div>
  );
}
