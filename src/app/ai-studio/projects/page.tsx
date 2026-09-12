import type { Metadata } from "next";
import { ProjectWorkspace } from "@/components/studio/ProjectWorkspace";

export const metadata: Metadata = { title: "Projects · AI Content Studio", description: "One saved project from source artwork and camera plans to campaigns, films, sound and review." };
export default function ProjectsPage() { return <ProjectWorkspace />; }
