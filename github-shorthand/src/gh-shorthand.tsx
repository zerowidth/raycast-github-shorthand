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
          const config = yaml.load(data) as Config;
          config.users = config.users || {};
          config.repos = config.repos || {};
          setConfig(config);
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
    const exactMatch = Object.entries(config.users).some(([shorthand]) => shorthand == searchText);
    return (
      <List
        searchText={searchText}
        onSearchTextChange={setSearchText}
        filtering={true}
        searchBarPlaceholder="Shorthand or user..."
      >
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
          {Object.entries(config.users).length == 0 && (
            <List.Item key="no-users" title="No user shorthand configured" subtitle="add users to your config file" />
          )}
        </List.Section>
        <List.Section title="Repositories">
          {Object.entries(config.repos).map(([shorthand, full]) => (
            <List.Item key={shorthand} title={shorthand} subtitle={full} keywords={full.split("/")} />
          ))}
          {Object.entries(config.repos).length == 0 && (
            <List.Item key="no-repos" title="No repo shorthand configured" subtitle="add repos to your config file" />
          )}
        </List.Section>
      </List>
    );
  }

  interface RepoListProps {
    owner: string;
  }

  function RepoList({ owner: owner }: RepoListProps) {
    const [searchText, setSearchText] = useState("");
    const repos = Object.entries(config.repos).filter(([, full]) => {
      return full.split("/")[0] == owner;
    });
    useEffect(() => {
      repos.filter(([, full]) => {
        return full.includes(searchText);
      });
    }, [searchText]);
    const exactMatch = Object.entries(repos).some(([, [shorthand]]) => shorthand == searchText);
    return (
      <List
        searchText={searchText}
        onSearchTextChange={setSearchText}
        filtering={true}
        searchBarPlaceholder={`Search repos in ${owner}/...`}
      >
        {searchText.length > 0 && !exactMatch && (
          <List.Item key={`search-${searchText}`} title={`${owner}/${searchText}`} />
        )}
        {repos.map(([shorthand, full]) => (
          <List.Item key={shorthand} title={shorthand} subtitle={full} keywords={full.split("/")} />
        ))}
        {repos.length == 0 && (
            <List.Item key="no-repos" title={`No repo shorthand for ${owner} configured`} subtitle="add repos to your config file" />
          )}
      </List>
    );
  }

  return <FullList />;
}
