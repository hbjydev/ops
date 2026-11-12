# Phoebe

Phoebe is an existing Talos Kubernetes cluster governed by `ops`.
Its migration preserves workloads and storage while adopting shared core and certificate management.

## Application layers

The next migration step makes `kube/deploy/apps/phoebe` the composition entry point for the existing `cluster-apps` Flux Kustomization.
Shared definitions live in `kube/deploy/core`.
Phoebe selects migrated workloads and applies its overrides under `kube/deploy/apps/phoebe/<namespace>`.

The Phoebe layer temporarily includes `kubernetes/apps` for unmigrated workloads and namespace resources.
The Flux operator is the first workload selected directly from shared core.
Its Phoebe override enables monitoring and defers the new network labels.

For each later migration, add the shared workload to the Phoebe layer and remove its legacy selection.
Complete any required ownership protection before deploying that change.
Remove the compatibility include after the final legacy workload and namespace resources move.

The [migration plan](phoebe-migration.md) covers the ownership transfer, compatibility requirements, certificate hierarchy and rollback conditions.
