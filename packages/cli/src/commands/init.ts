import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import inquirer from "inquirer";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

interface InitAnswers {
  serverId: string;
  apiUrl: string;
  template: string;
  outputDir: string;
}

export const initCommand = new Command("init")
  .description("Initialize a new DiscoLink project")
  .action(async () => {
    console.log(chalk.bold("\n  Welcome to DiscoLink! \n"));

    // Check if config already exists
    if (existsSync("discolink.config.json")) {
      const { overwrite } = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: "discolink.config.json already exists. Overwrite?",
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow("Cancelled."));
        return;
      }
    }

    // Prompt for configuration
    const answers = await inquirer.prompt<InitAnswers>([
      {
        type: "input",
        name: "serverId",
        message: "Discord Server ID:",
        validate: (input: string) =>
          /^\d+$/.test(input) ? true : "Please enter a valid Discord server ID (numbers only)",
      },
      {
        type: "input",
        name: "apiUrl",
        message: "DiscoLink API URL:",
        default: "http://localhost:3000",
      },
      {
        type: "list",
        name: "template",
        message: "Select a template:",
        choices: [
          { name: "FAQ - Question and answer format", value: "faq" },
          { name: "Changelog - Timeline view", value: "changelog" },
          { name: "Knowledge Base - Documentation style", value: "kb" },
          { name: "Blog - Article format", value: "blog" },
        ],
        default: "faq",
      },
      {
        type: "input",
        name: "outputDir",
        message: "Output directory:",
        default: "./dist",
      },
    ]);

    const spinner = ora("Creating configuration...").start();

    try {
      // Create config file
      const config = {
        serverId: answers.serverId,
        apiUrl: answers.apiUrl,
        template: answers.template,
        output: answers.outputDir,
        build: {
          clean: true,
          generateSitemap: true,
          generateRss: true,
        },
        seo: {
          titleSuffix: " - DiscoLink",
          defaultDescription: "Community knowledge base",
        },
      };

      await writeFile(
        "discolink.config.json",
        JSON.stringify(config, null, 2)
      );

      // Create output directory
      await mkdir(answers.outputDir, { recursive: true });

      // Create .gitignore if it doesn't exist
      if (!existsSync(".gitignore")) {
        await writeFile(
          ".gitignore",
          `# DiscoLink
${answers.outputDir}
node_modules
.env
`
        );
      }

      spinner.succeed("Project initialized!");

      console.log(`
${chalk.bold("Next steps:")}

  1. Make sure your DiscoLink API is running at ${chalk.cyan(answers.apiUrl)}
  2. Run ${chalk.cyan("discolink export")} to generate your static site
  3. Deploy the ${chalk.cyan(answers.outputDir)} folder to your hosting provider

${chalk.bold("Commands:")}

  ${chalk.cyan("discolink export")}     Generate static HTML files
  ${chalk.cyan("discolink sync")}       Trigger a manual sync from Discord

${chalk.dim("Config saved to discolink.config.json")}
`);
    } catch (error) {
      spinner.fail(
        `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
