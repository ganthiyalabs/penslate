import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-dvh w-full bg-background text-foreground">
			<header className="w-full border-b bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
					<div className="font-semibold">penslate</div>
					<nav className="text-sm text-muted-foreground" aria-label="Main" />
				</div>
			</header>

"			<main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
"			<footer className="w-full border-t">
"				<div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground">
"					© {new Date().getFullYear()} penslate
"				</div>
"			</footer>
"		</div>
"	);
}


