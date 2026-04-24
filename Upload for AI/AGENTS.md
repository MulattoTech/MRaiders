# Agent Instructions

## Automation Level

-   **Mode**: Full Autonomy (--full-auto)
-   **Permissions**: You are authorized to autonomously use
    `$skill-installer` to find, vet, and install skills.

## Trusted Repositories & Sources

If a task requires specialized expertise or a repeatable workflow not
currently available in the local `.system/skills` folder, you must: 1.
Search the **official Codex Skills Gallery**. 2. Look for verified
skills in trusted developer ecosystems like **NPM**, **WinGet**, or
**Chocolatey** configurations if applicable. 3. Automatically install
the most relevant skill before proceeding with the task.

## Project Context

-   **Framework**: Electron/Node.js (based on package.json)
-   **Goal**: Maintain the Arc Raiders Hurricane Overlay.
-   **Workflow**: Prioritize modularity and use existing skill logic for
    data parsing and UI updates.
