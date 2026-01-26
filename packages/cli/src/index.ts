#!/usr/bin/env node

import { Command } from "commander";
import { exportCommand } from "./commands/export.js";
import { initCommand } from "./commands/init.js";
import { syncCommand } from "./commands/sync.js";

const program = new Command();

program
  .name("discolink")
  .description("DiscoLink CLI - Export Discord content to static websites")
  .version("0.1.0");

// Register commands
program.addCommand(exportCommand);
program.addCommand(initCommand);
program.addCommand(syncCommand);

program.parse();
