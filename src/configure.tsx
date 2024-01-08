import { configPath, initializeConfigFile } from "./utils";
import open from "open";
import { Application, getPreferenceValues, closeMainWindow } from "@raycast/api";

initializeConfigFile();
const prefs: { editor: Application } = getPreferenceValues();
open(configPath, { app: { name: prefs.editor.name } });
closeMainWindow();
