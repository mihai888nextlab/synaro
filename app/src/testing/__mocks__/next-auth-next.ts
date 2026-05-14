/** Jest-only stub so API route tests never pull `jose` ESM through `next-auth`. */
import { jest } from "@jest/globals";

export const getServerSession = jest.fn();
