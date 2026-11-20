# Retour arrière 4A bis (ne rien appliquer sans autorisation)
- SQL : `20261120_rollback_4A_bis_functions.sql` rétablit les 5 RPC historiques lues en production le 2026-11-20 21:50 UTC. Tables de traces et résultats conservés.
- Worker : redéployer `btp-analysis-job` après `git restore --source=7723e9b5 supabase/functions/btp-analysis-job supabase/functions/_shared`.
- Ordre : exclusion → worker ancien → SQL inverse → réouverture.
