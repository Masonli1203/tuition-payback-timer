# Agent instructions

Before planning or developing, read [README.md](README.md) for the product's purpose, setup, verification commands, and code layout. For changes to user-facing behavior, consult [the user guide](docs/usage.en.md).

If a local `MEMORY.md` exists, read it for project history, acceptance criteria, and pending decisions. It is private working context and is not included in the public repository. Follow the user's latest instructions; suggestions in project memory are not authorization to implement them.

## Project conventions

- Preserve the app's playful, timetable-based meaning of "payback" and the calculation and storage behavior documented in the README unless the requested change explicitly revises them.
- Use sample tuition and timetables in tests, screenshots, and public documentation. Preserve real user configuration and backups.
- For code changes, run the relevant verification commands from the README and report the results and any checks that could not be run. Native regression uses the isolated verification app; keep its application identifier separate from the production app.
