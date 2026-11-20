# Architecture rules
- Keep project-specific factual instructions in a separate prompt export based on the legacy factual prompt, so improvements to project analysis do not alter the assistant's existing actions.
- Store deterministic report-reference diagnostics beside the global analysis text in its existing step result; diagnostics never rewrite reports or initiate AI calls.
- Report auditing uses explicit Markdown headings, row-local references and labeled fields; unstructured or multi-source assertions remain unverifiable rather than semantically validated.
- Handle Vite preload failures before React renders, using the same session-scoped recovery guard as global errors to avoid stale-chunk blank screens and reload loops.- « Analyser mon projet » reads files with its own full-content extractor (no silent truncation) and sends per-document coverage; any untransmitted page or unreadable file keeps the dossier incomplete, so reports never claim full coverage.
- Persistent analysis retries are bounded per independent step; durable call budgets include inner document retries and survive worker interruption, while metadata-only traces close atomically with saved step results.
- Exhausted factual documents close atomically as failed sources and advance the dossier; worker RPC outcomes require explicit confirmation and errors use a fixed metadata-only vocabulary.
- Unapproved database changes live under supabase/pending rather than supabase/migrations so code preparation cannot silently apply them.
