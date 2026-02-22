import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  loader: async () => {
    throw redirect({
      to: "/signin",
    });
  },
});
