# Phoebe

Phoebe is an existing Talos Kubernetes cluster governed by `ops`.
Its migration preserves workloads and storage while adopting shared core and certificate management.

## Application layers

`cluster-apps` selects `kube/deploy/apps/phoebe`. Phoebe owns the Flux deployment
files under each namespace/application directory; these select shared controller
manifests in `kube/deploy/core` and workload manifests in `kube/deploy/apps/base`.
Cluster-specific values are direct HelmRelease patches in those local Flux
Kustomizations. Shared defaults remain inline in the shared releases.

All workloads and infrastructure configuration now live under `kube/deploy`.
The remaining `kubernetes/flux/cluster` files are the Flux compatibility entry
point. See [deployment layers](../core/gitops.md#deployment-layers) for selection,
namespace composition and the Helm-defaults opt-out label.

The [migration plan](phoebe-migration.md) records the earlier ownership transfers,
certificate hierarchy and rollback conditions.

## External Secrets

Phoebe selects the shared `core-external-secrets` Flux owner. Its local declaration
keeps the chart `2.15.0` overlay and the existing health checks. The password
generator and default chart values are shared core resources.

The cluster does not select the shared SDK store. Phoebe retains its 1Password
Connect server and existing ClusterSecretStore indefinitely. Connect and the
GitHub generator depend on `core-external-secrets`.

The External Secrets namespace composition, Connect server and GitHub generator
live under `kube/deploy/apps/phoebe/external-secrets`. Their Flux owner names and
resource identities are retained. Namespace support selects the shared and Phoebe-specific components explicitly.

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

## Network policy migration

Phoebe selects `core-cilium-netpols` and `core-flux-netpols`. Core's blanket
default-deny policy is excluded; its DNS, label-based and controller allowances
explicitly avoid enabling isolation. Existing workload-specific policies still
apply, so this does not disable Cilium policy enforcement globally.

Cert-manager, External Secrets and Flux operator now inherit their core pod
labels. Trust-manager, CoreDNS and metrics-server already supplied those labels;
the core label policies are now selected on Phoebe. Cert-manager's old broad
namespace allowances have been retired in favour of the staged core rules.
Its scheduling override and all controller monitoring settings are unchanged.
