import { environment, getPreferenceValues } from "@raycast/api";
import path from "path";
import fs from "fs";
import { graphql } from "@octokit/graphql";
import fetch from "node-fetch";
import { showToast, Toast } from "@raycast/api";
import yaml from "js-yaml";
import { createContext } from "react";

const defaultConfigFile = `---
# Configuration file for GitHub Shorthand
#
# Default search scope for issues.
defaultScope: "is:open"

# This is a map of user shorthand to their full GitHub login:
users:
  # "z": "zerowidth"

# Same thing for organizations. There's no functional difference from users, this just
# changes the icon shown in the list.
orgs:
  # "r": "rails"

# This is map of repository shorthands to their full path on GitHub:
repos:
  # "rs": "raycast/script-commands"
  # "df": "zerowidth/dotfiles"
`;

export const configPath = path.join(environment.supportPath, "gh-shorthand.yaml");

export type Config = {
  defaultScope: string;
  users: Shorthand;
  orgs: Shorthand;
  repos: Shorthand;
  usersAndOrgs: Shorthand;
};

export const defaultConfig = {
  defaultScope: "",
  users: {},
  orgs: {},
  repos: {},
  get usersAndOrgs() {
    return { ...this.users, ...this.orgs };
  },
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
      const loaded = yaml.load(data) as Partial<Config>;
      const config: Config = {
        ...defaultConfig,
        ...loaded,
      }
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

export const ConfigContext = createContext<Config>(defaultConfig);

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
