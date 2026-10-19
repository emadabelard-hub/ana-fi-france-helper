# Architecture rules
- Keep project-specific factual instructions in a separate prompt export based on the legacy factual prompt, so improvements to project analysis do not alter the assistant's existing actions.
- Store deterministic report-reference diagnostics beside the global analysis text in its existing step result; diagnostics never rewrite reports or initiate AI calls.