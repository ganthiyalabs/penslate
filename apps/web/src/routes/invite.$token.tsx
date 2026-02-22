import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";
import { trpc, queryClient } from "@/router";
import { Loader2, CheckCircle, XCircle, UserPlus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invite/$token")({
  component: InviteAcceptComponent,
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({
        to: "/signin",
      });
    }
  },
});

function InviteAcceptComponent() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);

  const acceptInvite = useMutation(
    trpc.invites.accept.mutationOptions({
      onSuccess: (data) => {
        setProjectId(data.projectId);
        if (data.alreadyMember) {
          setStatus("already");
        } else {
          setStatus("success");
          queryClient.invalidateQueries();
        }
      },
      onError: (error) => {
        setStatus("error");
        setErrorMessage(error.message || "Something went wrong");
      },
    })
  );

  useEffect(() => {
    acceptInvite.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <CardTitle>Accepting Invite...</CardTitle>
              <CardDescription>Please wait while we add you to the project.</CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle>You're In!</CardTitle>
              <CardDescription>You've been successfully added to the project.</CardDescription>
              <Button
                className="mt-4"
                onClick={() =>
                  navigate({
                    to: "/projects/$projectId",
                    params: { projectId: projectId! },
                  })
                }
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Go to Project
              </Button>
            </>
          )}

          {status === "already" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle>Already a Member</CardTitle>
              <CardDescription>You're already a member of this project.</CardDescription>
              <Button
                className="mt-4"
                onClick={() =>
                  navigate({
                    to: "/projects/$projectId",
                    params: { projectId: projectId! },
                  })
                }
              >
                Go to Project
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle>Invite Failed</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate({ to: "/" })}
              >
                Go Home
              </Button>
            </>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}
