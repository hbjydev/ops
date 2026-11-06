# ops

A new way for me to manage & deploy a multi-cluster Kubernetes environment.

## Repo Structure

```
.mise/          Mise configuration
  tasks/        Mise tasks for repo & cluster management
kube/
  bootstrap/    Kubernetes bootstrap manifests
  clusters/
    <name>/
      flux/     Cluster-specific Flux configuration
      talos/    Cluster TOPF configuration
  deploy/
    core/       Shared 'base' resources deployed to every cluster
    apps/       Specific applications included on a per-cluster basis
```

## Useful Tasks

```bash
# apply talos config to a cluster
mise run talos:apply <cluster>

# apply talos config to a cluster (dry-run)
mise run talos:apply <cluster> --dry-run
```
