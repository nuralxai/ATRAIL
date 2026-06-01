import { createRequire } from "module";

const require = createRequire(import.meta.url);
const prismaModule = require("./generated/client/index.js");

export const PrismaClient = prismaModule.PrismaClient;
export const Prisma = prismaModule.Prisma;
export const $Enums = prismaModule.$Enums;

export * from "./generated/client/index.js";
