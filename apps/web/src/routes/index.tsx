import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { getUser } from "@/functions/get-user";
import { authClient } from "@/lib/auth-client";
import TopNav from "@/components/top-nav";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: HomeComponent,
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/signin" });
    }
  },
});

const MOCK_PROJECTS = [
  {
    id: "1",
    name: "Marketing Website",
    description: "Landing pages and blog for the main product",
    updatedAt: "2 hours ago",
  },
  {
    id: "2",
    name: "Mobile App",
    description: "React Native app for iOS and Android",
    updatedAt: "5 hours ago",
  },
  {
    id: "3",
    name: "Design System",
    description: "Shared component library and design tokens",
    updatedAt: "1 day ago",
  },
  {
    id: "4",
    name: "API Gateway",
    description: "Centralized API management and routing",
    updatedAt: "2 days ago",
  },
  {
    id: "5",
    name: "Analytics Dashboard",
    description: "Real-time metrics and reporting interface",
    updatedAt: "3 days ago",
  },
  {
    id: "6",
    name: "Documentation",
    description: "Internal and external documentation portal",
    updatedAt: "1 week ago",
  },
];

function HomeComponent() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "settings">(
    "overview"
  );

  const user = session?.user;

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={() => {
          authClient.signOut({
            fetchOptions: {
              onSuccess: () => {
                navigate({ to: "/signin" });
              },
            },
          });
        }}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {activeTab === "overview" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Projects</h2>
              <Button size="sm">
                <PlusIcon className="mr-1 h-4 w-4" />
                New Project
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MOCK_PROJECTS.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <CardHeader>
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {project.description}
                    </CardDescription>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Updated {project.updatedAt}
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Settings</h2>
            <p className="text-muted-foreground">
              Settings content will go here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
