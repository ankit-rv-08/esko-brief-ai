<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep brief presentation helpers in `src/components/brief` and use the shared Button variants for controls, so refinements remain consistent without altering demo generation logic.
- Command-K belongs to the workspace command palette; Jessy opens through its trigger or a palette action to avoid competing keyboard listeners.
- Workspace panels use responsive visibility utilities with shared breakpoint classification for evidence navigation, so citations open the appropriate mobile tab or tablet slide-over.
