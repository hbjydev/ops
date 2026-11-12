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
preserve monitoring and current behaviour. Both Let's Encrypt issuers use the
shared `hayden+letsencrypt@hayden.moe` account email, `tlsserver` profile and
account-key Secret names. The core Cloudflare Secret uses the existing Connect
item's `password` field. The previous production account Secret is retained for
rollback; existing certificates are not forcibly renewed.

`cluster-ca` signs with `ca-phoebe-v1`, the ops-root-signed intermediate. Database
server chains have been renewed under that intermediate. Postgres, dfguard and
Dragonfly each have a `*-client-ca-v2` issuer signed by `cluster-ca`; application,
pooler and replication client certificates use those service issuers. Issuance
permissions and application identities enforce service boundaries because their
chains share the ops root.

Phoebe selects core trust-manager in the `trust-manager` namespace. Core's
`trusted-roots` ConfigMap supplies server trust. The `database-client-trust` owner
supplies three private client-auth Secret bundles to the `database` namespace,
using each service CA chain and the ops root, without public internet roots.

`cert-manager-config` retains the service client authorities, monitoring resources
and namespace policies. The certificate CSI driver remains deployed with its
shared-controller dependency. Old client signing Secrets are retained only for
rollback; old issuers and trust bundles are retired.

Dragonfly does not reload renewed TLS certificates in place. Its StatefulSet uses
`OnDelete`: replace the replica, wait for stable replication, then replace the
primary when rotating its server chain. Verify the served certificate, not just
the Kubernetes Secret. CNPG reloads its certificate material through the operator.

The cutover was verified with a PostgreSQL mTLS login as `streaming_replica` and
an application-side Redis `PING` through dfguard to Dragonfly. Both passed after
removing the old client CAs from the distributed bundles and reloading database
trust. Active pods no longer reference the old client issuers or trust mounts.
