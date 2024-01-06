import { environment, getPreferenceValues } from "@raycast/api";
import path from "path";
import fs from "fs";
import { graphql } from "@octokit/graphql";
import fetch from "node-fetch";
import { showToast, Toast } from "@raycast/api";
import yaml from "js-yaml";

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

export type Config = {
  users: Shorthand;
  repos: Shorthand;
};

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

  return { users: {}, repos: {} };
}

export function initializeConfigFile(): void {
  fs.mkdirSync(environment.supportPath, { recursive: true });
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, defaultConfig);
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
