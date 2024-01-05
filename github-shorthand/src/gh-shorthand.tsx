import { List } from "@raycast/api";
import { useEffect, useState } from "react";
import fs from "fs";
import yaml from "js-yaml";
import { configPath } from "./utils";
import { showToast, Toast } from "@raycast/api";

type Config = {
  users?: { [shorthand: string]: string };
  repos?: { [shorthand: string]: string };
};

export default function Main() {
  const [config, setConfig] = useState<Config>({ users: {}, repos: {} });

  useEffect(() => {
    fs.readFile(configPath, "utf-8", (err, data) => {
      if (err) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load config: " + err.message,
        });
      } else {
        try {
          setConfig(yaml.load(data) as Config);
        } catch (err) {
          showToast({
            style: Toast.Style.Failure,
            title: "Failed to load config: " + (err as Error).message,
          });
        }
      }
    });
  }, []);

  if (!config) {
    return <List isLoading={true} />;
  }

  return (
    <List>
      {config.users &&
        Object.entries(config.users).map(([shorthand, full]) => (
          <List.Item key={shorthand} title={`${shorthand}/`} subtitle={full} />
        ))}
      {config.repos &&
        Object.entries(config.repos).map(([shorthand, full]) => (
          <List.Item key={shorthand} title={shorthand} subtitle={full} />
        ))}
    </List>
  );
}
