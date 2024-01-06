import { createContext, useContext, useEffect, useState } from "react";
import { Config, defaultConfig, loadConfig, getGraphqlWithAuth } from "./utils";
import { Image, Icon, Color, ActionPanel, Action, List, Keyboard } from "@raycast/api";

const ISSUE_COUNT = 50;
const ConfigContext = createContext<Config>(defaultConfig);

export default function Main() {
  return (
    <ConfigContext.Provider value={loadConfig()}>
      <CombinedList />
    </ConfigContext.Provider>
  );
}

// CombinedList shows the configured shorthand users and repos along with the user-entered user prefix, if applicable
function CombinedList() {
  const config = useContext(ConfigContext);
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
        <User key={`search-${searchText}`} user={searchText} />
      )}
      {Object.entries(config.users).map(([shorthand, full]) => (
        <User key={`user-${shorthand}`} user={full} shorthand={shorthand} />
      ))}
      {Object.entries(config.repos).map(([shorthand, full]) => (
        <Repo key={`repo-${shorthand}`} repo={full} shorthand={shorthand} />
      ))}
    </List>
  );
}

// RepoList shows the repos for a given owner along with a user-entered repo, if applicable
function RepoList({ owner }: { owner: string }) {
  const config = useContext(ConfigContext);
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

function IssueSearch({ scope }: { scope: string }) {
  const graphqlWithAuth = getGraphqlWithAuth();
  const config = useContext(ConfigContext);
  const [searchText, setSearchText] = useState(config.defaultScope.length > 0 ? `${config.defaultScope} ` : "");
  const [issues, setIssues] = useState([] as IssueOrPr[]);
  const [isLoading, setIsLoading] = useState(false);
  const [cache, setCache] = useState({} as { [key: string]: IssueOrPr[] });

  useEffect(() => {
    const fetchIssues = async () => {
      setIsLoading(true);
      if (cache[searchText]) {
        setIssues(cache[searchText]);
        setIsLoading(false);
        return;
      }
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
      setCache((prevCache) => ({ ...prevCache, [searchText]: result.search.nodes }));
      setIssues(result.search.nodes);
      setIsLoading(false);
    };
    fetchIssues();
  }, [searchText]);

  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle={true}
      isLoading={isLoading}
      searchBarPlaceholder={`Search issues in ${scope}...`}
    >
      {issues.map((issue) => (
        <Issue key={issueReference(issue)} issue={issue} />
      ))}
    </List>
  );
}

function User({ user, shorthand }: { user: string; shorthand?: string }) {
  return (
    <List.Item
      title={shorthand ? `${shorthand}/` : user}
      subtitle={`${user}/...`}
      icon={{ source: "person.png", tintColor: Color.PrimaryText }}
      actions={
        <ActionPanel>
          <Action.Push
            title="Search Repositories"
            target={
              <ConfigContext.Provider value={useContext(ConfigContext)}>
                <RepoList owner={user} />
              </ConfigContext.Provider>
            }
          />
        </ActionPanel>
      }
    />
  );
}

function Repo({ repo, shorthand }: { repo: string; shorthand?: string }) {
  const url = `https://github.com/${repo}`;
  return (
    <List.Item
      title={shorthand ? shorthand : repo}
      subtitle={shorthand ? repo : undefined}
      icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
      keywords={repo.split("/")}
      actions={
        <ActionPanel>
          <Action.Push
            title="Search Issues"
            icon={Icon.MagnifyingGlass}
            target={
              <ConfigContext.Provider value={useContext(ConfigContext)}>
                <IssueSearch scope={`repo:${repo}`} />
              </ConfigContext.Provider>
            }
          />
          <Action.OpenInBrowser
            title="Open Repo on GitHub"
            url={url}
            icon={{ source: "repo.png", tintColor: Color.PrimaryText }}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
          <Action.OpenInBrowser
            title="Open Issues on GitHub"
            url={`${url}/issues`}
            icon={{ source: "issue-opened.png", tintColor: Color.PrimaryText }}
            shortcut={{ modifiers: ["cmd"], key: "i" }}
          />
          <Action.OpenInBrowser
            title="Open PRs on GitHub"
            url={`${url}/pulls`}
            icon={{ source: "git-pull-request.png", tintColor: Color.PrimaryText }}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          <Action.OpenInBrowser
            title="Create New Issue on GitHub"
            url={`${url}/issues/new`}
            icon={{ source: "plus.png", tintColor: Color.PrimaryText }}
            shortcut={Keyboard.Shortcut.Common.New}
          />
          <Action.CopyToClipboard title="Copy URL" content={url} shortcut={Keyboard.Shortcut.Common.Copy} />
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
          <Action.CopyToClipboard title="Copy URL" content={issue.url} shortcut={Keyboard.Shortcut.Common.Copy} />
        </ActionPanel>
      }
    />
  );
}
