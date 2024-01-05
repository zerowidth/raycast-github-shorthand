import { useEffect, useState } from "react";
import fs from "fs";
import yaml from "js-yaml";
import { configPath } from "./utils";
import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";

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
    const [searchText, setSearchText] = useState("");
    const exactMatch = Object.entries(config.users).some(([shorthand,]) => shorthand == searchText);
    return (
      <List searchText={searchText} onSearchTextChange={setSearchText} filtering={true}
      searchBarPlaceholder="Shorthand or user...">
        {Object.keys(config.users).length > 0 && (
          <List.Section title="Users">
            {!exactMatch && searchText.length > 0 && !searchText.includes("/") && (
              <List.Item
                key={`search-${searchText}`}
                title={`${searchText}`}
                subtitle={searchText + "/..."}
                actions={
                  <ActionPanel>
                    <Action.Push title="View Repositories" target={<RepoList owner={searchText} />} />
                  </ActionPanel>
                }
              />
            )}
            {Object.entries(config.users).map(([shorthand, full]) => (
              <List.Item
                key={shorthand}
                title={`${shorthand}/`}
                subtitle={full + "/..."}
                keywords={[full]}
                actions={
                  <ActionPanel>
                    <Action.Push title="View Repositories" target={<RepoList owner={full} />} />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        )}
        {Object.keys(config.repos).length > 0 && (
          <List.Section title="Repositories">
            {Object.entries(config.repos).map(([shorthand, full]) => (
              <List.Item key={shorthand} title={shorthand} subtitle={full} keywords={full.split("/")} />
            ))}
          </List.Section>
        )}
      </List>
    );
  }

  interface RepoListProps {
    owner: string;
  }

  function RepoList({ owner: owner }: RepoListProps) {
    const [searchText, setSearchText] = useState("");
    const items = Object.entries(config.repos).filter(([, full]) => {
      return full.split("/")[0] == owner;
    });
    useEffect(() => {
      items.filter(([, full]) => {
        return full.includes(searchText);
      });
    }, [searchText]);
    const exactMatch = Object.entries(items).some(([, [shorthand]]) => shorthand == searchText);
    return (
      <List searchText={searchText} onSearchTextChange={setSearchText} filtering={true}>
        {searchText.length > 0 && !exactMatch && <List.Item key={`search-${searchText}`} title={`${owner}/${searchText}`} />}
        {Object.entries(items).map(([, [shorthand, full]]) => (
          <List.Item key={shorthand} title={shorthand} subtitle={full} keywords={full.split("/")} />
        ))}
      </List>
    );
  }

  return <FullList />;
}
