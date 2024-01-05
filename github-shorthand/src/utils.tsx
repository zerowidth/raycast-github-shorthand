import { environment } from "@raycast/api";
import path from "path";
import fs from "fs";

const defaultConfig = `---
# Configure your GitHub shorthand users, organizations, and repos here
users:
  # this is a map of users (or organizations) shorthand to their full GitHub login:
  #
  # "gh": "github"
  # "z": "zerowidth"
repos:
  # This is map of repository shorthands to their full GitHub path:
  #
  # "rs": "raycast/script-commands"
  # "df": "zerowidth/dotfiles"
`;

export const configPath = path.join(environment.supportPath, "gh-shorthand.yaml");
export function initializeConfigFile(): void {
  fs.mkdirSync(environment.supportPath, { recursive: true });
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, defaultConfig);
  }
}
