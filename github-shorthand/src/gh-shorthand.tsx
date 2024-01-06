import { useEffect, useState } from "react";
import fs from "fs";
import yaml from "js-yaml";
import { configPath, getGraphqlWithAuth } from "./utils";
import { Image, Icon, Color, ActionPanel, Action, List, showToast, Toast } from "@raycast/api";

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

function CombinedList({ users, repos }: { users: Shorthand; repos: Shorthand }) {
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
            icon={{ source: "person.png", tintColor: Color.PrimaryText }}
            actions={
              <ActionPanel>
                <Action.Push title="Search Repositories" target={<RepoList owner={searchText} repos={repos} />} />
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
            icon={{ source: "person.png", tintColor: Color.PrimaryText }}
            actions={
              <ActionPanel>
                <Action.Push title="Search Repositories" target={<RepoList owner={full} repos={repos} />} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      <List.Section title="Repositories">
        {Object.entries(repos).map(([shorthand, full]) => (
          <List.Item
            key={shorthand}
            title={shorthand}
            subtitle={full}
            keywords={full.split("/")}
            icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
            actions={
              <ActionPanel>
                <Action.Push title="Search Issues" target={<IssueSearch scope={`repo:${full}`} />} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function RepoList({ owner, repos }: { owner: string; repos: Shorthand }) {
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
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering={true}
      searchBarPlaceholder={`Search repos in ${owner}/...`}
    >
      {searchText.length > 0 && !exactMatch && (
        <List.Item
          key={`search-${searchText}`}
          title={`${owner}/${searchText}`}
          icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
          actions={
            <ActionPanel>
              <Action.Push title="Search Issues" target={<IssueSearch scope={`repo:${owner}/${searchText}`} />} />
            </ActionPanel>
          }
        />
      )}
      {filtered.map(([shorthand, full]) => (
        <List.Item
          key={shorthand}
          title={shorthand}
          subtitle={full}
          keywords={full.split("/")}
          icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
          actions={
            <ActionPanel>
              <Action.Push title="Search Issues" target={<IssueSearch scope={`repo:${full}`} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

interface IssueOrPr {
  title: string;
  number: number;
  url: string;
  state: string;
  stateReason?: string;
  isDraft?: boolean;
  __typename: "Issue" | "PullRequest";
  repository: {
    nameWithOwner: string;
  };
}

function issueReference(issue: IssueOrPr) {
  return `${issue.repository.nameWithOwner}#${issue.number}`;
}

function iconForIssue(issue: IssueOrPr): Image {
  if (issue.__typename == "PullRequest") {
    switch (issue.state) {
      case "OPEN":
        return issue.isDraft
          ? { source: "git-pull-request-draft.png", tintColor: Color.SecondaryText }
          : { source: "git-pull-request.png", tintColor: Color.Green };
      case "CLOSED":
        return { source: "git-pull-request-closed.png", tintColor: Color.Red };
      case "MERGED":
        return { source: "git-merge.png", tintColor: Color.Purple };
      default:
        return { source: Icon.QuestionMark, tintColor: Color.Red };
    }
  }
  switch (issue.state) {
    case "OPEN":
      return { source: "issue-opened.png", tintColor: Color.Green };
    case "CLOSED":
      return issue.stateReason == "NOT_PLANNED"
        ? { source: "skip.png", tintColor: Color.SecondaryText }
        : { source: "issue-closed.png", tintColor: Color.Red };
    default:
      return { source: Icon.QuestionMark, tintColor: Color.Red };
  }
}

function IssueSearch({ scope: scope }: { scope: string }) {
  const graphqlWithAuth = getGraphqlWithAuth();
  const [searchText, setSearchText] = useState(`is:open `);
  const [issues, setIssues] = useState([] as IssueOrPr[]);

  useEffect(() => {
    const fetchIssues = async () => {
      const result = await graphqlWithAuth<{
        search: { nodes: IssueOrPr[] };
      }>(
        `query ($searchText: String!) {
          search(query: $searchText, type: ISSUE, first: 10) {
            nodes {
              ... on Issue {
                number
                title
                url
                state
                stateReason
                __typename
                repository {
                  nameWithOwner
                }
              }
              ... on PullRequest {
                number
                title
                url
                isDraft
                state
                __typename
                repository {
                  nameWithOwner
                }
              }
            }
          }
        }`,
        {
          searchText: `${scope} ${searchText}`,
        },
      );
      setIssues(result.search.nodes);
    };
    fetchIssues();
  }, [searchText]);

  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle={true}
      searchBarPlaceholder={`Search issues in ${scope}...`}
    >
      {issues.map((issue) => (
        <Issue key={issueReference(issue)} issue={issue} />
      ))}
    </List>
  );
}

function Issue({ issue }: { issue: IssueOrPr }) {
  return (
    <List.Item
      title={issue.title}
      icon={iconForIssue(issue)}
      accessories={[{ text: issueReference(issue) }]}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in GitHub" url={issue.url} />
          <Action.CopyToClipboard title="Copy URL" content={issue.url} />
        </ActionPanel>
      }
    />
  );
}
