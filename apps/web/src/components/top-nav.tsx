import { useState } from "react";
import { DashboardSquare03Icon, Settings01Icon } from "hugeicons-react";
import { Menu01Icon, Notification03Icon } from "hugeicons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavProps {
    user?: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    } | null;
    onSignOut?: () => void;
    activeTab?: "overview" | "settings";
    onTabChange?: (tab: "overview" | "settings") => void;
}

const tabs = [
    { id: "overview" as const, label: "Overview", icon: DashboardSquare03Icon },
    { id: "settings" as const, label: "Settings", icon: Settings01Icon },
];

export default function TopNav({
    user,
    onSignOut,
    activeTab: controlledTab,
    onTabChange,
}: TopNavProps) {
    const [internalTab, setInternalTab] = useState<"overview" | "settings">(
        "overview"
    );

    const activeTab = controlledTab ?? internalTab;
    const setActiveTab = onTabChange ?? setInternalTab;

    return (
        <header className="border-b border-border bg-background">
            {/* Top row */}
            <div className="flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Menu01Icon size={18} />
                    </Button>
                    <span className="text-base font-semibold tracking-tight">
                        Penslate
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Notification03Icon size={18} />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <button className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                    <Avatar size="sm">
                                        <AvatarImage
                                            src={user?.image ?? undefined}
                                            alt={user?.name ?? undefined}
                                        />
                                        <AvatarFallback>
                                            {user?.name?.charAt(0) ?? "U"}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                            }
                        />
                        <DropdownMenuContent align="end" className="w-56 bg-card">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {user?.name}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user?.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Profile</DropdownMenuItem>
                            <DropdownMenuItem>Account</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={onSignOut}
                            >
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Tab row */}
            <div className="flex gap-0 px-4">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${isActive
                                    ? "text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                            )}
                        </button>
                    );
                })}
            </div>
        </header>
    );
}
