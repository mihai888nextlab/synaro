import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { getUserSearchIndex } from "@/lib/search/get-search-index";
import type { SearchIndex } from "@/lib/search/search-index";

type SearchIndexResponse = SearchIndex | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchIndexResponse>,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const index = await getUserSearchIndex(userId);
  res.setHeader("Cache-Control", "private, max-age=60");
  return res.status(200).json(index);
}
