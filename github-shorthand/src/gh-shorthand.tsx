import { useEffect, useState } from "react";
import fs from "fs";
import yaml from "js-yaml";
import { configPath } from "./utils";
import { ActionPanel, Action, Detail, List, showToast, Toast } from "@raycast/api";

type Config = {
  users: { [shorthand: string]: string };
  repos: { [shorthand: string]: string };
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

  function FullList() {
    return (
      <List>
        {Object.keys(config.users).length > 0 && (
          <List.Section title="Users">
            {Object.entries(config.users).map(([shorthand, full]) => (
              <List.Item
                title={`${shorthand}/`}
                subtitle={full}
                keywords={[full]}
                actions={
                  <ActionPanel>
                    <Action.Push title="View Repositories" target={<RepoList user={full} />} />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        )}
        {Object.keys(config.repos).length > 0 && (
          <List.Section title="Repositories">
            {Object.entries(config.repos).map(([shorthand, full]) => (
              <List.Item title={shorthand} subtitle={full} keywords={full.split("/")} />
            ))}
          </List.Section>
        )}
      </List>
    );
  }

  interface RepoListProps {
    user: string;
  }

  function RepoList({ user: user }: RepoListProps) {
    const [searchText, setSearchText] = useState("");
    const items = Object.entries(config.repos).filter(([_, full]) => {
      return full.split("/")[0] == user;
    });
    useEffect(() => {
      items.filter(([, full]) => {
        return full.includes(searchText);
      })
    }, [searchText]);
    return (
      <List
        searchText={searchText}
        onSearchTextChange={setSearchText}
        // filtering={true}
      >
        {Object.entries(items).length == 0 ? (
          <List>
            <List.Item title={`No repositories found for ${searchText}`} />
          </List>
        ) : (
          <List.Section title={`Repositories for ${user}`}>
            {Object.entries(items).map(([, [shorthand, full]]) => (
              <List.Item title={shorthand} subtitle={full} keywords={[full]} />
            ))}
          </List.Section>
        )}
        ;
      </List>
    );
  }

  function RepoView() {
    return <List></List>;
  }

  return <FullList />;
}
