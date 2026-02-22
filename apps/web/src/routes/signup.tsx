import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/signup")({
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

import SignUpForm from "@/components/sign-up-form";

function RouteComponent() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <SignUpForm onSwitchToSignIn={() => window.location.href = "/signin"} />
    </div>
  );
}
