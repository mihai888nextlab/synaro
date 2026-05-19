import NextAuth from "next-auth";

import { authOptions } from "@/lib/next-auth-options";

export { authOptions };
export default NextAuth(authOptions);
