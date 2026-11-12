# Secrets

Shared core provides [External Secrets](https://external-secrets.io/).
Rhea uses the 1Password SDK store; Phoebe retains its 1Password Connect server.

Each cluster has a vault in 1Password (`cluster-<name>`), and a provisioned
service account token with read access to that vault.

`core-external-secrets-config` installs the shared `pw` ClusterGenerator after
the controller and its CRDs are ready. It generates 32-character passwords
without symbols and permits repeated characters. Existing consumers continue
to reference `pw`.
