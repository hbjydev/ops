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

## External Secrets

Phoebe selects the shared `core-external-secrets` Flux owner. Its cluster patch
keeps the app wrapper for the existing password generator and chart `2.15.0`,
and preserves its health checks. Chart values use the shared defaults and the
optional `external-secrets-values` ConfigMap.

The cluster does not select the shared SDK store. Phoebe retains its 1Password
Connect server and existing ClusterSecretStore indefinitely. Connect and the
GitHub generator depend on `core-external-secrets`.

The External Secrets namespace composition, Connect server and GitHub generator
live under `kube/deploy/apps/phoebe/external-secrets`. Their Flux owner names and
resource identities are retained. Namespace support still imports the legacy
common component until its secrets, alerts and repository resources are migrated.

## Certificate management

Phoebe selects all three shared cert-manager owners: `core-cert-manager`,
`core-cert-manager-ca` and `core-cert-manager-letsencrypt`. Its controller values
preserve monitoring and current behaviour. The production ACME override retains
the existing account key and DNS-zone restrictions; the core Cloudflare Secret
uses the existing Connect item's `password` field.

`cluster-ca` signs with `ca-phoebe-v1`, the ops-root-signed intermediate. Existing
certificates are not forcibly renewed by the signer change. Both the ops root
and the previous root remain in `root-ca` and `cluster-roots` trust bundles until
old chains have been retired. The previous root is stored as public material in
`cert-manager/legacy-root.pem`; it is not the active signing authority.

`cert-manager-config` retains the selfsigned issuer, separate database client
CAs, monitoring resources and existing namespace policies. The certificate CSI
driver remains deployed, and its dependency points to the shared controller.
