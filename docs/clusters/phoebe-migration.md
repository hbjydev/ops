# Phoebe migration to ops

Move the existing Phoebe cluster into `ops` in three stages: transfer repository ownership, adopt shared core, then migrate certificates.
Keep workloads, storage and cluster identity intact throughout the move.
Each stage has its own acceptance criteria and rollback point.

This is a proposed migration plan, based on repository configuration reviewed on November 11, 2026.
Live cluster state and 1Password contents need comparison before cutover.

## Target structure

Shared core provides common controllers and policies with explicit cluster overrides.
Phoebe keeps its networking, storage and hardware requirements.
Sharing a definition does not require deploying it to every cluster.

| Location | Responsibility |
| --- | --- |
| `kube/deploy/core/` | Shared controllers and policies |
| `kube/deploy/apps/base/` | Reusable application definitions selected by each cluster |
| `kube/deploy/apps/phoebe/` | Phoebe application selection and overrides |
| `kube/clusters/phoebe/` | Flux entry point, cluster identity and Talos configuration |
| `kube/components/` | Reusable database, identity, backup and namespace integration |
| `pki/` | Certificate authority lifecycle and public certificates |

## Current state

The `phoebe` repository still governs the cluster.
The `ops` Phoebe entry point selects shared core but does not include its existing application inventory.
Switching Flux directly to this incomplete tree risks deleting resources through pruning.
Pruning deletes resources that disappear from a Flux deployment's inventory.

The following preparation exists in `ops`:

- Phoebe's cluster identity is `CLUSTER: phoebe`.
- Shared core includes External Secrets with the 1Password SDK provider.
- The `cluster-ca` issuer reads the `cert-manager/ca-phoebe-v1` Secret after cluster substitution.
- External Secrets maps the authority's `chain` and `private-key` fields into that Secret.
- The `trusted-roots` bundle includes public roots and the root from the `pki-root` ConfigMap.
- The root permits two subordinate authority levels, and each cluster intermediate permits one.

These manifests still need deployment and acceptance testing on Phoebe.
Earlier proposals used the names `service-ca` and `internal-services`. The current manifests use `ca-phoebe-v1` and `cluster-ca` instead.

## Compatibility requirements

| Area | Required treatment |
| --- | --- |
| Cilium | Preserve BGP, native routing, `bond+`, address pools and Multus integration through Phoebe overrides. |
| Network policies | Migrate existing allowances and labels before changing enforcement. Test both allowed and blocked connections. |
| Secrets | Preserve SOPS decryption and existing keys. Test the transition from 1Password Connect to the SDK provider separately. |
| Helm recovery | Preserve Phoebe's `remediateLastFailure: false`. Shared defaults currently set it to `true`. |
| Release identity | Preserve Helm release names, namespaces and storage namespaces during ownership transfer. |
| trust-manager | Preserve existing database Secret bundles. Shared core changes its namespace and omits their current Secret target permissions. |
| Certificates | Preserve public issuers, database client authorities and the certificate CSI driver until replacements pass connection tests. |
| Talos | Preserve the existing cluster secrets. The repositories use different 1Password item layouts and Talos versions. |

Phoebe disables automatic final Helm remediation because a previous rollback downgraded software against newer stored data.
Retain that behavior during migration.

## Migration stages

### 1. Record the baseline

1. Record the source revisions and live Flux inventories.
2. Record Helm release identities, versions, storage claims and certificate consumers.
3. Make sure that backups, recovery credentials and access outside Flux work.
4. Compare rendered repository resources with the live cluster.
5. Record existing failures separately from migration failures.

Acceptance: every managed resource has an identified owner, and recovery access works.

### 2. Prepare a compatible deployment

Import the complete Phoebe deployment into `ops` before changing its layout or shared defaults.
A temporary `kubernetes/` tree preserves paths during the repository transfer.
Keep it separate from the new core selection so that two Flux deployments do not manage the same resources.

1. Copy the application tree and its reusable components with existing resource identities and versions.
2. Preserve SOPS resources, External Secrets dependencies, database authorities and the certificate CSI driver.
3. Preserve nested paths, including component references and the Tailscale Terraform source path.
4. Carry repository authentication, webhook configuration and status reporting into the transfer plan.
5. Add schema validation and rendering checks to CI.
6. Compare the rendered resource inventory and values with the baseline.

Acceptance: the candidate tree contains the complete existing deployment with only reviewed repository reference changes.

### 3. Transfer Flux ownership

Do not use the general bootstrap task for this transfer.
Its Talos branch applies machine configuration with automatic bootstrap enabled.

1. Record the old Flux source URL, revision, path and authentication reference.
2. Stop competing reconciliation before changing ownership.
3. Disable pruning on affected owners and protect resources before removing or renaming their Flux owners.
4. Reconcile those protections before changing source paths or inventories.
5. Point the existing Flux instance at the complete compatibility tree in `ops`.
6. Resume reconciliation in dependency order.
7. Make sure that workloads, routes, storage and certificate renewal remain healthy.
8. Restore pruning only after the new inventory accounts for every retained resource.

Protect both parent and child inventories where ownership changes.
Suspending a parent does not suspend its child Flux Kustomizations, the resources that define separate reconciliation loops.
Avoid deleting HelmRelease objects during handover because deletion can uninstall their releases.
Follow the [Flux resource move guidance](https://fluxcd.io/flux/faq/#how-can-i-safely-move-resources-from-one-dir-to-another).

Acceptance: the existing deployment reconciles from `ops` without unintended resource replacement or deletion.

Rollback: stop the new reconciliation, restore the recorded source and ownership configuration, then resume the old deployment.
Keep pruning protections until the restored inventory is complete.

### 4. Adopt shared core

1. Replace one duplicated controller definition at a time.
2. Preserve Helm release identities while updating Flux names and dependency references.
3. Move Cilium together with its Phoebe overrides and routing resources.
4. Preserve existing database trust bundles when adopting shared trust-manager.
5. Test the 1Password SDK store with representative existing ExternalSecrets before retiring Connect.
6. Render both Phoebe and Rhea after shared changes.
7. Remove each compatibility definition only after its new owner passes acceptance tests.

Acceptance: shared core manages Phoebe with working DNS, routing, secrets, storage and controllers.
Rhea still renders successfully with its own overrides.

Rollback: restore the previous owner and values for the affected controller.
Keep chart upgrades and changes to stored data formats outside this stage.

### 5. Migrate certificate trust

A certificate authority signs certificates that other systems can trust.
The accepted hierarchy retains Phoebe's database server authorities:

```mermaid
flowchart TD
  root["ops root: pathlen 2"] --> cluster["phoebe intermediate: pathlen 1"]
  cluster --> postgres["postgres server authority: pathlen 0"]
  cluster --> dragonfly["dragonfly server authority: pathlen 0"]
  cluster --> service["service certificate"]
  postgres --> pgserver["postgres server certificate"]
  dragonfly --> dfserver["dragonfly server certificate"]
```

Path length limits the number of subordinate authorities, excluding the final service certificate.
The public root and cluster certificates now contain the required limits.
Database authorities still need explicit constraints, issuance and a complete chain test.
See [RFC 5280](https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.9) for path length semantics.

Keep PostgreSQL, Dragonfly and dfguard client authorities separate during this migration.
Their certificates grant client access and are distinct from server identity.
Keep Talos authorities in the existing TOPF secrets workflow.

1. Make sure that the 1Password authority matches the committed certificate and contains its matching private key.
2. Test the secret store, authority Secret and issuer readiness before changing certificate consumers.
3. Distribute both the existing Phoebe root and the new ops root before switching issuance.
4. Preserve existing bundle names and database Secret targets while their consumers remain active.
5. Stage Kyverno trust injection for a small application group.
6. Make sure that the bundle exists in each selected namespace before recreating its pods.
7. Renew database authorities and server certificates in controlled batches after the issuer change.
8. Test complete chains, database connections and application reloads after each batch.
9. Deploy certificate expiry alerts and test notification delivery.
10. Remove old roots and authorities only after every dependent consumer finishes migration.

The old and new issuers share the name `cluster-ca`.
Changing its Secret changes the signing authority but does not automatically renew all existing certificates.
See the [cert-manager CA issuer limitations](https://cert-manager.io/docs/configuration/ca/).
Keep the previous issuer Secret and old trust available for rollback during the transition.

Kyverno reads annotations on pod templates and mutates newly created pods only.
Use the [trust profiles](../standards/pki.md) for application-specific certificate loading.
Existing environment variables, excluded namespaces and volume collisions can prevent automatic adoption.

Acceptance: migrated clients accept the new chains, database authentication still works, and expiry alerts reach their destination.

Rollback: restore the old signing source and affected certificates as needed, while keeping both roots trusted.
A Git revert alone does not restore certificates already issued or trust already removed.

### 6. Move remaining operations

1. Compare generated Talos configuration against the existing cluster before applying it from `ops`.
2. Reuse the existing Talos identity and keys when adapting the 1Password item layout.
3. Move Terraform without changing state locations or resource addresses.
4. Move VPS Compose, Ansible and operational documentation.
5. Update remaining automation, repository references and ownership rules.
6. Archive `phoebe` only after every operational responsibility moves.

Acceptance: `ops` governs cluster and external infrastructure, and no active workflow depends on the old repository.

## First implementation milestone

Prepare the complete compatibility tree and its rendered comparison before scheduling the ownership transfer.
The corrected certificate hierarchy removes the need to flatten database server authorities.
It does not replace the ownership, trust distribution or certificate renewal stages.

The PKI workflow tests still expect the old path lengths of `1` and `0`.
Update those assertions and add a database authority chain test before relying on that suite for the new hierarchy.
