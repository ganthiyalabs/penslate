import { createFileRoute } from "@tanstack/react-router";
import Layout from "@/components/layout";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
        <Layout>
			<h1>penslate</h1>
        </Layout>
	);
}
