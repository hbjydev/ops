# Phoebe

Phoebe is an existing Talos Kubernetes cluster governed by `ops`.
Its migration preserves workloads and storage while adopting shared core and certificate management.

## Application layers

The existing `cluster-apps` Flux Kustomization uses `kube/deploy/apps/phoebe` as its composition entry point.
Shared definitions live in `kube/deploy/core`.
Phoebe selects migrated workloads and applies its overrides under `kube/deploy/apps/phoebe/<namespace>`.

The Phoebe layer temporarily includes `kubernetes/apps` for unmigrated workloads and namespace resources.
The Flux operator is the first workload selected directly from shared core.
Its Phoebe override enables monitoring and defers the new network labels.
The override component lives at `kube/deploy/apps/phoebe/flux-system/flux-operator/overrides` and patches the HelmRelease directly.
The shared `core-flux-operator` selects that component through the [cluster override convention](../core/gitops.md#cluster-overrides-for-shared-core).

For each later migration, add the shared workload to the Phoebe layer and remove its legacy selection.
Complete any required ownership protection before deploying that change.
Remove the compatibility include after the final legacy workload and namespace resources move.

The [migration plan](phoebe-migration.md) covers the ownership transfer, compatibility requirements, certificate hierarchy and rollback conditions.
