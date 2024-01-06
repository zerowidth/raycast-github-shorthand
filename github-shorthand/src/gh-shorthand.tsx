import { useEffect, useState } from "react";
import { Config, loadConfig, getGraphqlWithAuth } from "./utils";
import { Image, Icon, Color, ActionPanel, Action, List } from "@raycast/api";

const ISSUE_COUNT = 50;

export default function Main() {
  const config = loadConfig();
  return <CombinedList config={config} />;
}

// CombinedList shows the configured shorthand users and repos along with the user-entered user prefix, if applicable
function CombinedList({ config }: { config: Config }) {
  const [searchText, setSearchText] = useState("");
  const exactMatch = Object.entries(config.users).some(([shorthand]) => shorthand == searchText);
  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering={true}
      searchBarPlaceholder="Shorthand or user..."
    >
      {!exactMatch && searchText.length > 0 && !searchText.includes("/") && !searchText.includes(" ") && (
        <User key={`search-${searchText}`} config={config} user={searchText} />
      )}
      {Object.entries(config.users).map(([shorthand, full]) => (
        <User key={`user-${shorthand}`} config={config} user={full} shorthand={shorthand} />
      ))}
      {Object.entries(config.repos).map(([shorthand, full]) => (
        <Repo key={`repo-${shorthand}`} repo={full} shorthand={shorthand} />
      ))}
    </List>
  );
}

// RepoList shows the repos for a given owner along with a user-entered repo, if applicable
function RepoList({ config, owner }: { config: Config; owner: string }) {
  const [searchText, setSearchText] = useState("");
  const filtered = Object.entries(config.repos).filter(([, full]) => {
    return full.split("/")[0] == owner;
  });
  const exactMatch = Object.entries(filtered).some(([, [shorthand]]) => shorthand == searchText);
  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering={true}
      searchBarPlaceholder={`Search repos in ${owner}/...`}
    >
      {searchText.length > 0 && !exactMatch && (
        <Repo key={`repo-search-${searchText}`} repo={`${owner}/${searchText}`} />
      )}
      {filtered.map(([shorthand, full]) => (
        <Repo key={`repo-${shorthand}`} repo={full} shorthand={shorthand} />
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
          search(query: $searchText, type: ISSUE, first: ${ISSUE_COUNT}) {
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

function User({ config, user, shorthand }: { config: Config; user: string; shorthand?: string }) {
  return (
    <List.Item
      title={shorthand ? `${shorthand}/` : user}
      subtitle={`${user}/...`}
      icon={{ source: "person.png", tintColor: Color.PrimaryText }}
      actions={
        <ActionPanel>
          <Action.Push title="Search Repositories" target={<RepoList owner={user} config={config} />} />
        </ActionPanel>
      }
    />
  );
}

function Repo({ repo, shorthand }: { repo: string; shorthand?: string }) {
  return (
    <List.Item
      title={shorthand ? shorthand : repo}
      subtitle={shorthand ? repo : undefined}
      icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
      keywords={repo.split("/")}
      actions={
        <ActionPanel>
          <Action.Push title="Search Issues" target={<IssueSearch scope={`repo:${repo}`} />} />
        </ActionPanel>
      }
    />
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
          <Action.OpenInBrowser title="Open on GitHub" url={issue.url} />
          <Action.CopyToClipboard title="Copy URL" content={issue.url} />
        </ActionPanel>
      }
    />
  );
}
