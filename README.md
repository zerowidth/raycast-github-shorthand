# GitHub Shorthand Raycast Extension

## What is it?

This [Raycast](https://www.raycast.com) extension provides a way to quickly access issue search for a configured list of repositories, orgs, and users configured with a "shorthand" notation.

If you find yourself frequently looking through issues or PRs for, say, your `my-company/monolith` repo, you can configure it like this:

```yaml
repos:
  mm: "my-company/monolith"
```

When you run the `GitHub Shorthand Issue Search` command, you can type `mm`, hit enter, and immediately see the issues and PRs for that repo. This search starts with a configurable default scope which can be edited in the raycast window to refine the search results.

The default config file has examples for each feature, including users, orgs, repos, and multi-repo groups.

## Previous work

This is inspired by, but not a direct translation of, a set of Alfred tools for managing shorthand references: [gh-shorthand.alfredworkflow](https://github.com/zerowidth/gh-shorthand.alfredworkflow). That workflow and supporting tools had more features in a CLI style that was better suited for Alfred. This extension only reproduces the quick issue search feature, which is the main thing I've been reaching for these days.

## Installation

- Clone this repo
- `npm install && npm run build`
- Use the `Import Extension` command in Raycast to import this folder.
- Configure the extension with a GitHub personal access token. This token must:
  - have `repo` scope
  - have SSO authorization (if applicable) for private repos
- (Optional) choose the editor you want to use to edit the config file.

## Configuration

Run the `Configure GitHub Shorthand` action to open the config YAML file. Edit as needed.

## Why aren't there any search results?

It's probably a token permission issue. This extension uses the GitHub search API, which doesn't say whether or not you have access to anything you're requesting. If you have access (and there are matching issues) you'll get results, otherwise you won't.

If you've cleared the search input when looking at a search and still aren't seeing any issue results, try the "View Search on GitHub" action to open the search in your browser (this will show up when there's no results for an empty query).
