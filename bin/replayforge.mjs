#!/usr/bin/env node
import { main } from "../src/cli.mjs";

main(process.argv).catch((error) => {
  console.error(`ReplayForge failed: ${error.message}`);
  if (process.env.REPLAYFORGE_DEBUG) {
    console.error(error);
  }
  process.exitCode = 1;
});
