import "dotenv/config";
import { EnvSchema } from "@amgi/shared";

export const env = EnvSchema.parse(process.env);
