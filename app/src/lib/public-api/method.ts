import type { NextApiRequest, NextApiResponse } from "next";

export function requireMethod(
  req: NextApiRequest,
  res: NextApiResponse,
  allowed: string | string[],
): boolean {
  const methods = Array.isArray(allowed) ? allowed : [allowed];
  if (methods.includes(req.method ?? "")) return true;
  res.setHeader("Allow", methods.join(", "));
  res.status(405).json({ error: "method_not_allowed" });
  return false;
}
