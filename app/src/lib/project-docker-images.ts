/** Options shown in the new-project dialog; values are Docker image refs except `automatic`. */
export const PROJECT_DOCKER_IMAGE_OPTIONS = [
  { value: "automatic", label: "Automatic (recommended)" },
  { value: "node:22-bookworm-slim", label: "Node.js 22 (Debian slim)" },
  { value: "python:3.12-slim", label: "Python 3.12 (slim)" },
  { value: "golang:1.23-bookworm", label: "Go 1.23 (Debian)" },
  { value: "nginx:1.27-alpine", label: "Nginx (Alpine)" },
  { value: "ubuntu:24.04", label: "Ubuntu 24.04 (generic)" },
] as const;

export type ProjectDockerImageSelectValue = (typeof PROJECT_DOCKER_IMAGE_OPTIONS)[number]["value"];

const ALLOWED_IMAGES = new Set(
  PROJECT_DOCKER_IMAGE_OPTIONS.map((o) => o.value).filter((v) => v !== "automatic"),
);

/** Maps UI/runtime select value to a Docker Hub image ref for environment-service. */
export function resolveProjectDockerImage(value: string | undefined): string {
  if (!value || value === "automatic") return "node:20-alpine";
  if (ALLOWED_IMAGES.has(value as Exclude<ProjectDockerImageSelectValue, "automatic">)) return value;
  return "node:20-alpine";
}
