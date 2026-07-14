export interface ReActStep {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  observation: string;
}
