import { useEffect, useState } from "react";
import fs from "fs";
import yaml from "js-yaml";
import { configPath } from "./utils";
import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";

type Shorthand = { [shorthand: string]: string };

type Config = {
  users: Shorthand;
  repos: Shorthand;
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

  return <CombinedList users={config.users} repos={config.repos} />;
}

interface CombinedListProps {
  users: Shorthand;
  repos: Shorthand;
}

function CombinedList({ users, repos }: CombinedListProps) {
  const [searchText, setSearchText] = useState("");
  const exactMatch = Object.entries(users).some(([shorthand]) => shorthand == searchText);
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
                <Action.Push title="View Repositories" target={<RepoList owner={searchText} repos={repos} />} />
              </ActionPanel>
            }
          />
        )}
        {Object.entries(users).map(([shorthand, full]) => (
          <List.Item
            key={shorthand}
            title={`${shorthand}/`}
            subtitle={full + "/..."}
            keywords={[full]}
            actions={
              <ActionPanel>
                <Action.Push title="View Repositories" target={<RepoList owner={full} repos={repos} />} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      <List.Section title="Repositories">
        {Object.entries(repos).map(([shorthand, full]) => (
          <List.Item key={shorthand} title={shorthand} subtitle={full} keywords={full.split("/")} />
        ))}
      </List.Section>
    </List>
  );
}

interface RepoListProps {
  owner: string;
  repos: Shorthand;
}

function RepoList({ owner: owner, repos: repos }: RepoListProps) {
  const [searchText, setSearchText] = useState("");
  const filtered = Object.entries(repos).filter(([, full]) => {
    return full.split("/")[0] == owner;
  });
  useEffect(() => {
    filtered.filter(([, full]) => {
      return full.includes(searchText);
    });
  }, [searchText]);
  const exactMatch = Object.entries(filtered).some(([, [shorthand]]) => shorthand == searchText);
  return (
    <List
      navigationTitle={`I AM A NAVIGATION TITLE {owner}/...`}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering={true}
      throttle={true}
      searchBarPlaceholder={`Search repos in ${owner}/...`}
    >
      {searchText.length > 0 && !exactMatch && (
        <List.Item key={`search-${searchText}`} title={`${owner}/${searchText}`} />
      )}
      {filtered.map(([shorthand, full]) => (
        <List.Item key={shorthand} title={shorthand} subtitle={full} keywords={full.split("/")} />
      ))}
    </List>
  );
}
