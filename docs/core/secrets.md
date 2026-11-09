# Secrets

Every cluster gets a deployment of [External Secrets](https://external-secrets.io/)
with a 1Password SDK cluster secret store provisioned.

Each cluster has a vault in 1Password (`cluster-<name>`), and a provisioned
service account token with read access to that vault.
