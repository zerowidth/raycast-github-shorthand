import { useEffect, useState } from "react";
import fs from "fs";
import yaml from "js-yaml";
import { configPath } from "./utils";
import { List, showToast, Toast, useNavigation } from "@raycast/api";

type Config = {
  users: { [shorthand: string]: string };
  repos: { [shorthand: string]: string };
};

export default function Main() {
  const [config, setConfig] = useState<Config>({ users: {}, repos: {} });
  const { push } = useNavigation();

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
      {config.users && (
        <List.Section title="Users">
          {Object.entries(config.users).map(([shorthand, full]) => (
            <List.Item key={shorthand} title={`${shorthand}/`} subtitle={full} />
          ))}
        </List.Section>
      )}
      {config.repos && (
        <List.Section title="Repositories">
          {Object.entries(config.repos).map(([shorthand, full]) => (
            <List.Item key={shorthand} title={shorthand} subtitle={full} />
          ))}
        </List.Section>
      )}
    </List>
  );
}
