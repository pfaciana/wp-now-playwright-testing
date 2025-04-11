# wp-now playwright testing

The purpose of this project is to quickly and easily integrate WordPress [Playground](https://wordpress.github.io/wordpress-playground/) environments with Microsoft's [Playwright](https://playwright.dev/) with minimal setup. It uses [`wp-now`](https://github.com/WordPress/playground-tools/tree/trunk/packages/wp-now) as the bridge for end-to-end testing of WordPress plugins and themes. This runs locally and does not require Docker or other global installs.

## Getting Started

```bash
npm i -D wp-now-playwright-testing
```

## Usage

In its most basic form, all you have to do is run the setup script once per project, then get the `projects` and `webServer` output from the `getPlaywrightConfig` function and pass it to your Playwright config. That's it!

1. Set up your local project with the following command...

```bash
node node_modules/wp-now-playwright-testing/setup-parallel-instances.js
```

...this brings the required files over to your local project to run multiple playgrounds at once.

2. Add `wp-now-playwright-testing` to your Playwright config...

```js
// playwright.config.js

import { defineConfig } from '@playwright/test'
import { getPlaywrightConfig } from 'wp-now-playwright-testing'

const { projects, webServer } = await getPlaywrightConfig()

// You can modify projects and webServer here, if needed

const config = {
	/* The rest of your config */
	// ...

	/* Configure projects for major browsers */
	projects,

	/* Run your local dev server before starting the tests */
	webServer,
}
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig(config)
```

3. Run your Playwright tests with additional environment variables...

```bash
cross-env USE_VERSIONS=8367,8266,8165 USE_BROWSERS=chrome,firefox,safari node node_modules/@playwright/test/cli.js test -c playwright.config.js
```

This command uses `cross-env` to set environment variables, but you can set the environment variables any way you'd like. This will spin up multiple environments at once and test them based on your project's Playwright tests. If you don't add the environment variables, it will default to just Chrome with the latest version of WordPress, and the oldest supported version of PHP. For a better understanding of the customizations via environment variables, we'll need to go over some of the basics of how this works, as seen in the next section.

## How it works

### wp-now-webserver.js

This project uses the `wp-now` repo to spin up the playground environments in the background. If you go to the `wp-now` docs, they show you how to use their code via npx or installed globally. However, we're not going to use it that way. Instead, what their docs don't show is that they **thankfully** export their functionality so that it can be used in a JavaScript app, which is what we're going to do. The file `wp-now-webserver.js`, in the root of this project, is just a wrapper and can be used the same way the `wp-now` docs outline. Think of it like replacing `npx @wp-now/wp-now start` or `wp-now start` with `node node_modules/wp-now-playwright-testing/wp-now-webserver.js`.

```bash
# Instead of...
npx @wp-now/wp-now start --wp=5.9 --php=7.4

# You can...
node node_modules/wp-now-playwright-testing/wp-now-webserver.js --wp=5.9 --php=7.4
```

`wp-now-webserver.js` supports the following optional `wp-now` arguments:

- `--path=<path>`: The path to the PHP file or WordPress project to use. If not provided, it will use the current working directory.
- `--php=<version>`: The version of PHP to use.
- `--port=<port>`: The port number on which the server will listen. The default port number is `8881`. If it's in use, `wp-now` picks an open port number.
- `--wp=<version>`: The version of WordPress to use.
- `--blueprint=<path>`: The path to a JSON file with the Blueprint steps (requires Node 20). See [Using Blueprints](#using-blueprints) for more details.
- `--reset`: Creates a fresh SQLite database.
- `--skip-browser`: Skip opening the browser after starting the server.

But, there is one additional optional argument (this is not supported in `wp-now`):

- `--versions=<versions[]>`: Comma-delimited set of custom shortcodes to launch multiple environments at once

An example of a `--versions` value is `81651234,8266,83` which gets converted to three environments...

* `81651234` = PHP: `8.1`, WordPress: `6.5` and Port: `1234`
* `8266` = PHP: `8.2`, WordPress: `6.6` and Port: `8266`
* `83` = PHP: `8.3`, WordPress: `Latest` and Port: `8399`

...they all get spun up with that single command.

Let's explain how `--versions` shortcodes work...

- The first 2 digits (required) represent the PHP version
- The next 2 digits (optional) represent the WP version
  - The patch version will always be the latest patch
  - If these 2 digits are missing, it defaults to the latest version of WordPress
- The next 4/5 digits (optional) represent the port
  - Anything less than 4 or more than 5 digits will be ignored
  - If missing, defaults to PHP and WP versions concatenated
    - Missing WordPress version defaults to the number 99 (as seen above)
- RC and beta versions have exceptions
  - You must use the full version (i.e. `6.7.1-RC1`) in replacement of the 3rd and 4th digits
    - e.g. `836.7.1-RC1` or `806.7-beta3`
  - The release candidate or beta version MUST be the latest optional available
    - If you need an outdated version of WordPress, you must use the previous `--wp` flag

For additional examples of how to use `--versions` shortcodes, see the `src/wp-now.test.js` test file

### Integration with Playwright

Now that you understand how to spin up multiple environments at once, we can integrate into our end-to-end testing. Everything from the last section will be done for you by passing the flags as environment variables to your Playwright test config. Both environment variables and flags work, so you can decide how you want to execute your tests. Here is the list of all env/flags available.

| CLI Flag           | process.env.*         | Default Value                 | Description                                                                         |
|--------------------|-----------------------|-------------------------------|-------------------------------------------------------------------------------------|
| `--reset`          | `RESET`               | `false`                       | Reset the state of the playground env before the server starts                      |
| `--clean`          | `CLEAN`               | `false`                       | Reset the state of the playground env after the server shuts down                   |
| `--skip-browser`   | `SKIP_BROWSER`        | `true`                        | Skip opening the browser after starting the server                                  |
| `--php`            | `PHP`                 | `null`                        | The version of PHP to use                                                           |
| `--wp`             | `WP`                  | `null`                        | The version of WordPress to use                                                     |
| `--port`           | `PORT`                | `null`                        | The port number on which the server will listen                                     |
| `--path`           | `ROOT`                | `process.cwd()`               | The path to the PHP file or WordPress project to use. Defaults to cwd               |
| `--versions`       | `USE_VERSIONS`        | `81`                          | PHP/WP/Port shortcodes                                                              |
| `--browsers`       | `USE_BROWSERS`        | `chrome`                      | Browsers shortcodes                                                                 |
| `--local-root`     | `LOCAL_ROOT`          | `process.cwd()`               | The root location of the WordPress project to use. Defaults to cwd                  |
| `--local-share`    | `LOCAL_SHARE`         | `.wp-now/shared`              | The path to where local files are copied from to be placed on the playground server |
| `--server-share`   | `SERVER_SHARE`        | `.wp-now`                     | The path on the server where the local share files are copied to                    |
| `--load-files`     | `LOAD_FILES`          | `loader.php`                  | Comma-separated files that auto-run on the server at startup                        |
| `--base-blueprint` | `BASE_BLUEPRINT_FILE` | `.wp-now/blueprint.base.json` | Your custom blueprint file                                                          |
| `--blueprint`      | `BLUEPRINT_FILE`      | `.wp-now/blueprint.json`      | The destination for the final blueprint file after autogenerated code is added      |
| `--server-cmd`     | `SERVER_CMD`          | `...playwright-webserver.js`^ | Command to run for the Playwright webserver                                         |

^ Full command: `node node_modules/wp-now-playwright-testing/playwright-webserver.js`

The command line flags are checked first, then fallback to ENV, then lastly, the default value. This project is designed to work best when most of the options are left to their default values, but it's important to note you do have the option to override things, if needed.

### Additional argument info

#### USE_BROWSERS / `--browsers`

Like USE_VERSIONS/`--versions`, this is a comma-separated list of shortcodes. These are slugified versions of Playwright's device names. You can use the `-l` suffix for landscape and skip the desktop prefix. Some examples of slugified strings are...

* `galaxy-s9+-l` for the  `Galaxy S9+ landscape` device
* `chrome-hidpi` for the `Desktop Chrome HiDPI` device
* For devices with multiple versions (like `iphone`, `ipad` and `pixel`), if no version is specified, the latest version will be used.
  * So if `iPhone 15 Pro Max` is the highest version of the iPhone at the time, `iphone` will be the same as `iphone-15-pro-max`
    This is designed so the most used shortcodes would be... `chrome,firefox,safari,pixel,iphone,ipad`
    You only need more complex shortcodes when your use case is more granular.

For more details on how shortcode works, see the `src/playwright.test.js` test file.

#### Sharing files between local and playground

In order to get multiple playground environments running at the same time, we need to run some code on the playground server so each environment has its own database to remove potential conflicts. The default code for this is provided in the `.wp-now` directory of this project. You can copy these files into your project with the command...

```bash
node node_modules/wp-now-playwright-testing/setup-parallel-instances.js
```

This will bring the files into the default `.wp-now` in the root of your project. If you want it saved to a different location, you can add a path as the first arg of the command.

```bash
node node_modules/wp-now-playwright-testing/setup-parallel-instances.js some-other-dir
```

NOTE: If you do change the destination path, you may need to update the code that references `.wp-now`

Once complete, you can update the default blueprint file, if needed. Now located here:  `.wp-now/blueprint.base.json` in your project. If you don't have custom blueprint code, you can leave this as is; it is still needed by the automated code later on.

This is where the `--local-root`, `--local-share`, `--server-share`, `--load-files`, `--base-blueprint` and `--blueprint` CLI flags/process.env.* variables come in. You can customize these settings to your liking, but if you are new to this, it is best to leave these alone. If you do change them, then you may need to also update the shared files to match the new values.

#### SERVER_CMD/`--server-cmd`

This, again, should probably not be altered. It is the command that runs when Playwright spins up a server for testing. If you want to make your own, you'll need your custom script to accept the `process.env.WP_NOW` variable which contains the `args` for the `wp-now` `getWpNowConfig()` function.

#### Cleanup script

Over time, old and outdated directories can build up on your system. It's best to clean them up from time to time. So this project comes with a script to help clean up old or outdated directories.

```bash
node node_modules/wp-now-playwright-testing/cleanup.js -wc -wp -pw --simulate
```

| Flag                  | Default Value | Description                                                               |
|-----------------------|---------------|---------------------------------------------------------------------------|
| `--wp-content`, `-wc` | `false`       | Remove WP-Now directories for the current project. Similar to (`--reset`) |
| `--wordpress`, `-wp`  | `false`       | Remove outdated WordPress installations                                   |
| `--playwright`, `-pw` | `false`       | Remove outdated Playwright browser installations                          |
| `--all`               | `false`       | Force delete ALL directories, even if they're not outdated                |
| `--simulate`          | `false`       | Run in simulation mode without actually deleting files                    |

You may want to run simulation mode `--simulate` first, to see what will actually get deleted.

#### Example scripts

Inside the `package.json`, under `extra`, there are some example scripts that can be copied into your project to get you started.

### Customizations without ENV and CLI flags

There is a third option that is less flexible. You can configure its usage directly in the `playwright.config.js` file

```js
// playwright.config.js

import { defineConfig } from '@playwright/test'
import { getPlaywrightConfig, getWpNowConfigs } from 'wp-now-playwright-testing'

await getWpNowConfigs({ versions: '8165,8367,8266' })
const { projects, webServer } = await getPlaywrightConfig({ browsers: 'chrome,firefox,safari' })

/* You can modify projects or webServer here for additional control */

const config = {
	/* Configure projects for major browsers */
	projects,
	/* Run your local dev server before starting the tests */
	webServer,
}
export default defineConfig(config)
```

Normally the `getWpNowConfigs()` function is called behind the scenes using the ENV and/or CLI flags. However, if you don't want to use it in that way, or you want to override it, you can call it directly (before calling `getPlaywrightConfig()` as shown above). You can also make customizations to the Playwright options here, as well. However, you may find this to be less flexible when automating different scripts.

### File Synchronization for Server Share

This project includes a file synchronization utility that automatically syncs files between your local shared directory and the server shared directory in the WordPress Playground environment.

While `wp-now` makes a symbolic link for your theme or plugin (so it is not necessary to create an extra step to synchronize those files), the custom shared folder is not. This additional script takes care of that.

The sync utility provides real-time feedback with emoji indicators:

- 📑🟢 New file added
- 📑🟡 File modified
- 📑🔴 File deleted
- 📂🟢 New directory added
- 📂🔴 Directory deleted

#### Using the File Sync Utility

The simplest way to start file synchronization is to run the `sync-shared-dirs` example script from this project's package.json:

```bash
node node_modules/wp-now-playwright-testing/sync-shared-dirs.js
```

However, you may need to customize it with a configuration to match your local environment.

#### Configuration Options

You can customize the synchronization behavior using environment variables or command-line flags:

| CLI Flag           | process.env.*    | Default Value    | Description                           |
|--------------------|------------------|------------------|---------------------------------------|
| `--local-root`     | `LOCAL_ROOT`     | `process.cwd()`  | Root directory of your local project  |
| `--local-share`    | `LOCAL_SHARE`    | `.wp-now/shared` | Source directory to watch for changes |
| `--server-share`   | `SERVER_SHARE`   | `.wp-now`        | Server directory to copy to           |
| `--ignore-initial` | `IGNORE_INITIAL` | `true`           | Skip initial copy of existing files   |
| `--verbose`        | `VERBOSE`        | `true`           | Show detailed logs of file changes    |

#### Examples

Custom local and server share directory: (Empty value means the root for either context)

```bash
cross-env LOCAL_SHARE=./my-files SERVER_SHARE= node sync-shared-dirs.js
```

Quiet mode (less verbose output):

```bash
cross-env VERBOSE=false node sync-shared-dirs.js
```

Initial sync of existing files:

```bash
cross-env IGNORE_INITIAL=false node sync-shared-dirs.js
```

The sync utility will maintain an active watch on your specified directories and automatically handle file creation, modification, and deletion events, ensuring your WordPress Playground environment stays in sync with your local development files.

## Quick recap

1. Install package

```bash
npm i -D wp-now-playwright-testing
```

2. Copy over scripts for parallel playground instances

```bash
node node_modules/wp-now-playwright-testing/setup-parallel-instances.js
```

3. Call from your Playwright config

```js
import { defineConfig } from '@playwright/test'
import { getPlaywrightConfig } from 'wp-now-playwright-testing'

const { projects, webServer } = await getPlaywrightConfig()
const config = {
	projects,
	webServer,
}
export default defineConfig(config)
```

4. Run your Playwright tests with environment variables set

```bash
cross-env USE_VERSIONS=8367,8266,8165 USE_BROWSERS=chrome,firefox,safari node node_modules/@playwright/test/cli.js test -c playwright.config.js
```

That's it, you're done!
