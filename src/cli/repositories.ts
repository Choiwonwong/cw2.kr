import type { AppConfig } from "../config.js";
import {
  openAppRepositories,
  type AppRepositories
} from "../repositories/app-repositories.js";

export type CliRepositories = AppRepositories;

export function openCliRepositories(config: AppConfig): CliRepositories {
  return openAppRepositories(config);
}
