import { configPath, initializeConfigFile } from "./utils";
import open from "open";
import { closeMainWindow } from "@raycast/api";

initializeConfigFile();
open(configPath, { app: { name: "/Applications/Visual Studio Code.app" } });
closeMainWindow();
