import { List } from "@raycast/api";
import { useEffect, useState } from "react";
import fs from "fs";
import yaml from "js-yaml";
import { configPath } from "./utils";

type Config = {
  users?: { [shorthand: string]: string };
  repos?: { [shorthand: string]: string };
};

export default function Main() {
  const [config, setConfig] = useState<Config>({ users: {}, repos: {} });

  useEffect(() => {
    fs.readFile(configPath, "utf-8", (err, data) => {
      if (err) {
        console.error("Failed to load config:", err);
      } else {
        setConfig(yaml.load(data) as Config);
      }
    });
  }, []);

  if (!config) {
    return <List isLoading={true} />;
  }

  return (
    <List>
      {config.users && Object.entries(config.users).map(([shorthand, full]) => (
        <List.Item key={shorthand} title={`${shorthand} -> ${full}`} />
      ))}
      {config.repos && Object.entries(config.repos).map(([shorthand, full]) => (
        <List.Item key={shorthand} title={`${shorthand} -> ${full}`} />
      ))}
    </List>
  );
}
