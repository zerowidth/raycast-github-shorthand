import { environment, getPreferenceValues } from "@raycast/api";
import path from "path";
import fs from "fs";
import { graphql } from "@octokit/graphql";
import fetch from "node-fetch";
import { showToast, Toast } from "@raycast/api";
import yaml from "js-yaml";

const defaultConfigFile = `---
# Configuration file for GitHub Shorthand
#
# Default search scope for issues.
default_scope: "is:open"

# This is a map of user shorthand to their full GitHub login:
users:
  # "z": "zerowidth"

# This is map of repository shorthands to their full path on GitHub:
repos:
  # "rs": "raycast/script-commands"
  # "df": "zerowidth/dotfiles"
`;

export const configPath = path.join(environment.supportPath, "gh-shorthand.yaml");

export type Config = {
  defaultScope: string;
  users: Shorthand;
  repos: Shorthand;
};
export const defaultConfig = {
  defaultScope: "",
  users: {},
  repos: {},
} as Config;

export type Shorthand = { [shorthand: string]: string };

export function loadConfig(): Config {
  let data;
  try {
    data = fs.readFileSync(configPath, "utf-8");
  } catch (err) {
    showToast({
      style: Toast.Style.Failure,
      title: "Failed to load config: " + (err as Error).message,
    });
  }

  if (data) {
    try {
      const config = yaml.load(data) as Config;
      config.defaultScope = config.defaultScope || "";
      config.users = config.users || {};
      config.repos = config.repos || {};
      return config;
    } catch (err) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to decode config: " + (err as Error).message,
      });
    }
  }

  return defaultConfig;
}

export function initializeConfigFile(): void {
  fs.mkdirSync(environment.supportPath, { recursive: true });
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, defaultConfigFile);
  }
}

export function getGraphqlWithAuth() {
  interface AuthConfig {
    githubApiKey: string;
  }
  const authConfig = getPreferenceValues() as AuthConfig;
  return graphql.defaults({
    request: {
      fetch: fetch,
    },
    headers: {
      authorization: `token ${authConfig.githubApiKey}`,
    },
  });
}
