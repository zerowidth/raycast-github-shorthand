import { configPath, initializeConfigFile } from "./utils";
import { Application, getPreferenceValues, closeMainWindow, open } from "@raycast/api";

export default async function Command() {
  initializeConfigFile();
  const prefs: { editor: Application } = getPreferenceValues();
  await open(configPath, prefs.editor);
  await closeMainWindow();
}
