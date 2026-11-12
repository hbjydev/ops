# GitOps

Flux deploys the configuration stored in this repository.
[Flux Operator](https://fluxoperator.dev/) manages Flux on each cluster.

## Deployment layers

Cluster roots explicitly select shared controllers and local Flux Kustomizations.
Keep the application layout consistent: `apps/<cluster>/<namespace>/<application>`.
Core owns controller releases and their defaults. Cluster configuration owns
credentials, provider packages, dashboards, routes and workload instances.

### Application selection and namespace composition

`kube/deploy/apps/base/<namespace>/<application>` holds reusable application
manifests and their Flux Kustomizations. It is a catalogue: clusters select
individual applications, not the entire base directory. Shared controller
releases remain in `kube/deploy/core`.

`kube/deploy/apps/<cluster>/<namespace>/kustomization.yaml` owns namespace
composition. It selects namespace integrations, imports the chosen application
Kustomizations from base, and includes cluster-local configuration or overrides.
Keep application network policies with their application definitions. A cluster
using application defaults needs only a reference to the base definition; it
does not need an empty local application wrapper.

Konflate is the first migrated workload. Its reusable definition lives in
`base/dev/konflate`; Phoebe selects it through `phoebe/dev/konflate`, which
generates its values ConfigMap and supplies its ExternalSecret. `cluster-apps`
owns those cluster inputs, while the existing `dev/konflate` Flux Kustomization
owns the release, chart source and default values. A values-only override can
use the same optional `<release>-values` convention as core controllers. Keep
cluster-specific hostnames, credentials and workload instances in the cluster
layer rather than baking Phoebe assumptions into base.

Namespace composition uses these independently selectable components:

- `kube/components/namespace`: namespace creation and pruning protection.
- `kube/components/namespace-backups`: backup mover annotations.
- `kube/components/app-template`: the namespace-local chart source.
- `kube/components/infra-folder`: the Crossplane NamespaceFolder integration for GCP
  infrastructure folders, where its composition is installed.
- `kube/clusters/phoebe/components/registry-credentials`: Phoebe registry secrets.
- `kube/clusters/phoebe/components/github-status`: Phoebe GitHub credentials and
  Flux status reporting.
- `kube/clusters/phoebe/components/sops`: Phoebe's existing namespace-local
  decryption key, with its encryption recipient preserved.

The initial namespace migration preserves all previously selected integrations.
Selection can be narrowed separately after checking their consumers.
`cluster-apps` still owns these resources; no extra Flux owner is introduced.
Phoebe namespace compositions temporarily reference unmigrated application
`ks.yaml` files under `kubernetes/apps` directly. Replace those references with
base selections as each workload is migrated. The legacy aggregate and common
namespace component have been removed.

Kaniop also selects these components in its child Flux Kustomization, retaining
its pre-existing overlap with namespace composition. Removing that overlap needs
an explicit ownership handover and is separate from this layout change.

### Independent application migration

The following deployments now use base definitions selected by Phoebe:

- Garage webui, tsproxy, unpoller and smtp-relay.
- Cloudflare DNS, towonel-agent, UniFi DNS and the UniFi certificate uploader.
- llmkube, Multus, STUNner, Tailscale and kube-prometheus-stack.

They do not consume the Kanidm, PostgreSQL, Dragonfly, Kopiur or Anubis workload
integrations. This does not imply they have no dependencies: they still require
applicable controllers, credentials, gateways and backend services. Apps with
inline identity or backup manifests, including slskd, Gatus, Grafana and the
VictoriaMetrics stack, are excluded from this batch just like component users.

Shared release definitions use `<release>-defaults` and optional
`<release>-values` ConfigMaps. Phoebe owns endpoint addresses, domains, DNS
ownership settings, credentials and Grafana bindings. An app still needs its
required external inputs even though the override ConfigMap itself is optional.
Application network policies remain with the app definition. tsproxy needs no
cluster override and is selected directly from base.

Models, network attachments, STUNner gateways and Tailscale configuration retain
their existing Flux owners under Phoebe. Tailscale's Terraform source paths now
point into Phoebe's deployment tree; Terraform configuration, state identity and
approval policy are unchanged. Bootstrap and Flux-instance migration remain
separate work.

The UniFi uploader requires `UNIFI_URL`; Phoebe supplies its existing console
address. Its certificate Secret name is also a cluster value. Run its isolated
HTTP-boundary tests with:

```sh
python3 -m unittest discover -s kube/deploy/apps/base/network/unifi-cert-upload/tests
```

### Kopiur-backed application migration

Mimi, Navidrome, Picard, Plex, Seerr, qBittorrent, Qui, SABnzbd and SPT select
reusable definitions from base. Picard is selected independently of Navidrome.
Each shared Flux Kustomization includes `kube/components/kopiur`; the existing
application owner continues to own its PVC, Restore, SnapshotPolicy and
SnapshotSchedule. Moving an app definition does not transfer storage ownership.

Phoebe's application compositions supply Helm values and patch the selected Flux
Kustomization with cluster-specific `KOPIUR_*` inputs and dependencies. Repository,
storage class, snapshot class and capacities are explicit cluster settings;
backup schedules and existing security settings are preserved. Seerr's separate
cache PVC uses `SEERR_CACHE_STORAGE_CLASS` and `SEERR_CACHE_CAPACITY` inputs and
retains the Seerr owner.

Cluster values contain routes, NFS mounts, Multus addresses, device mounts,
external endpoints and other deployment choices. Credentials and SPT's DNS
record belong to the Phoebe composition. Application policies and SPT's pinned
mod-install script stay with their base definitions. Mimi's zero replica count
is a Phoebe setting, preserved during migration.

### Database and identity application migration

MCP auth proxy, kguardian and Tranquil select base definitions with their existing
Kanidm/PostgreSQL components. Generated database and OAuth Kustomizations retain
their names, owners and shared component paths. Phoebe supplies identity origins,
redirects, membership, service endpoints, routes and other deployment settings.

The integration components use JSON patches against `HelmRelease.spec.values`.
Keep their required `defaultPodOptions.annotations`, `labels` and
`schedulingGates` containers inline where needed, while ordinary defaults and
cluster overrides use values ConfigMaps. Generated inline integration values take
precedence over valuesFrom inputs. Compare the final merged values, including
these patches, when migrating or changing an integrated workload.

MCP auth proxy retains its inline Kopiur policy and Helm-managed PVC; this batch
does not convert its backup arrangement to the restore component. Repository and
snapshot class are cluster inputs. Its LiteLLM virtual key is cluster config.
Kguardian retains its chart-specific TLS post-renderer, with the database URL
supplied through Phoebe's `KGUARDIAN_DATABASE_URL` substitution. Tranquil's
credentials, ServiceProject and StorageBucket are selected by Phoebe, preserving
the existing cloud resource identities.

Sonarr, Radarr, Lidarr and Prowlarr also select base definitions with the
PostgreSQL and Kopiur components. Phoebe supplies routes, NFS mounts, database
connection strings and backup storage settings. Database roles, certificate
mounts and backup resources retain their existing owners. Sonarr and Radarr's
cache PVCs use cluster-supplied `CACHE_STORAGE_CLASS` and `CACHE_CAPACITY` inputs
without changing their resource identities.

### AI and selfhosted application configuration

Hermes, Honcho, Memini, LiteLLM, Immich, Miniflux, Norish, Paperless and SearXNG
have reusable definitions in base. Phoebe supplies their endpoints, identity
settings, credentials, device mounts and storage choices. Memini's zero replica
count remains a cluster value.

Hermes and Honcho's file-generated configuration ConfigMaps live beside their
Phoebe selections. Their names and file contents stay unchanged, and their
`substitute: disabled` annotation applies only to those configuration generators.
Helm defaults and override ConfigMaps still allow Flux substitutions.

LiteLLM selects both its operator and proxy. The proxy is a native resource, so
Phoebe supplies its deployment settings through `LITELLM_*` substitutions rather
than Helm values. Model definitions, virtual keys, MCP servers and credentials,
the Grafana dashboard binding and VictoriaMetrics scrape resource belong to the
Phoebe composition. The compatibility callback and application network policies
remain with the shared proxy definition.

### Media, Matrix and home automation workloads

Forgejo, Silo, slskd, Continuwuity, LiveKit and Home Assistant select shared
base definitions. LiveKit includes its JWT service; Home Assistant includes
Matter Server and OpenThread. Existing release and integration names are retained.

Phoebe owns Forgejo's branding, themes, routes and Anubis credential component;
Continuwuity's Unbound configuration; and Home Assistant's generated configuration.
Multus addresses, serial devices, NFS mounts, identity settings and service URLs
are cluster values. Cache PVCs remain application-owned with cluster-supplied
`CACHE_STORAGE_CLASS` and `CACHE_CAPACITY`. slskd retains its StatefulSet volume
claim template and inline Kopiur policy.

Only keep inline Helm value containers required by integration patches. An empty
inline annotations map can suppress annotations supplied through `valuesFrom`;
workloads without those patches should omit the inline map. Check the live pod
template and network attachment when moving Multus settings into cluster values.

### Observability workloads

Gatus and the Grafana/VictoriaMetrics instance definitions live in `apps/base`.
Grafana Operator and VictoriaMetrics Operator are optional entries under
`core/observability`. Phoebe selects them explicitly alongside its instances;
Rhea does not select them. Their existing Flux owner names (`grafana` and
`victoria-metrics-operator`) are retained so dependent workloads keep the same
ownership and dependency references.

Helm releases use required defaults and optional cluster values ConfigMaps.
Native instance resources use namespace-scoped Flux substitutions for storage,
retention, Grafana authentication, plugins and routes. VictoriaMetrics' agent
uses the forwarded `CLUSTER` metadata for its external label. Numeric-looking
retention strings include JSON quotes in the substitution value to preserve the
CRD's string type after Kustomize and Flux processing.

Phoebe owns Gatus's generated configuration, Grafana's identity resources and
credentials, dashboard/datasource bindings, Tailscale ingresses and Alertmanager
routing. Existing PVCs and Kopiur policies retain their application owners. The
unselected `logs/vlagent.yaml` configuration stays unselected in Phoebe; the
migration does not enable another log collector.

### Phoebe infrastructure configuration

Phoebe's PostgreSQL, Dragonfly, Garage, Kanidm, certificate import/export,
Cilium network configuration and runtime class live under `apps/phoebe`.
These are cluster instances and configuration, not installations selected for
every cluster. Their existing Flux names, resource ownership, storage and
recovery settings are retained.

Kaniop is an optional shared controller in `core/security/kaniop`. Phoebe's
operator composition imports that definition with its local dashboard binding
and existing namespace components, keeping those resources under the Kaniop
owner. The Kanidm instance and its external Git source remain cluster-local.

The Flux instance definition also lives under Phoebe. Its sync path remains
`kubernetes/flux/cluster`; the two files there are the remaining compatibility
entry point. Moving the configuration does not switch bootstrap or alter Flux
controller recovery settings. The old, unselected Cilium, CoreDNS and
cert-manager application copies have been removed.

### Reusable workload integrations

Workloads select integrations from `kube/components`:

| Component | Purpose |
| --- | --- |
| `kanidm/private`, `kanidm/public` | OAuth clients, access groups and readiness gates |
| `postgres/base`, `postgres/cert`, `postgres/pass` | Database/role provisioning and client authentication |
| `dragonfly`, `dragonfly/manual`, `dragonfly/noproxy` | Dragonfly ACL registration and optional dfguard client wiring |
| `kopiur` | PVC restore, snapshot policy and scheduling |
| `anubis` | Anubis release and application integration |

These are opt-in integrations, not controller installers. Their existing service
contracts remain: PostgreSQL and Dragonfly in `database`, Kanidm in `security`,
and the existing client issuers and trusted-root bundle. Kopiur settings remain
configurable through its `KOPIUR_*` inputs; current defaults use the `hetzner`
repository and miroir storage. A cluster must provide the referenced services and
choose suitable settings before selecting a dependent workload.

The former `redis` component is named `dragonfly` to reflect its actual backend.
Its `manual` variant registers ACLs only; `noproxy` adds direct-client certificate
mounts and readiness gates; the default adds the dfguard tunnel.

Anubis expects `${APP}-anubis-key` to be supplied by the cluster. Phoebe's
1Password-backed ExternalSecret is a separate component at
`kube/clusters/phoebe/components/anubis`. Forgejo selects both components under
its existing Flux owner, preserving credential ownership.

Component paths in a Flux Kustomization are relative to its `spec.path`; native
Kustomize component paths are relative to the containing `kustomization.yaml`.
Nested database and identity Kustomizations point directly at `kube/components`.

### Helm values

A values-only override does not change the shared Flux Kustomization's path.
The application composition imports the core definition and generates its optional
`<release>-values` ConfigMap from a sibling `values.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: system-upgrade
resources:
  - ../../../../core/system-upgrade/tuppr/ks.yaml
  - ./ks.yaml
configMapGenerator:
  - name: tuppr-values
    files:
      - values.yaml=values.yaml
generatorOptions:
  disableNameSuffixHash: true
  labels:
    reconcile.fluxcd.io/watch: Enabled
```

Core HelmReleases load `<release>-defaults`, followed by the optional
`<release>-values`. A cluster using only defaults needs no values wrapper.
Keep override ConfigMaps in the HelmRelease's namespace. Preserve any existing
resource labels when moving generators between reconciliation owners.

### Local resources and exceptional patches

Put local resources in a separate `config/` directory, or a descriptive directory
such as `gateways/`, `collector/` or `gcp/`. Declare their Flux owner in `ks.yaml`
and depend on the appropriate controller. Adding a dashboard or provider package
must not require redirecting the controller's core path through a local overlay.

Keep actual resource patches explicit. Phoebe's External Secrets chart-version
patch and Kopiur's Helm post-renderer still require overlays. These are exceptions
to the values-only pattern, not reasons to wrap every shared controller.

Flux Operator also retains its optional cluster component convention:
`apps/${CLUSTER}/flux-system/flux-operator/overrides`, selected with
`ignoreMissingComponents: true`. Neither Phoebe nor Rhea currently supplies one.
The parent must substitute the cluster name before the child selects a component.

### Kustomization files and local rendering

Keep `kustomization.yaml` where it performs selection, generates ConfigMaps,
imports shared resources, or applies patches, components or transformations.
Do not keep it merely to enumerate all manifests under a Flux build root.
Flux generates that inventory recursively when `spec.path` has no kustomization.
All YAML files beneath such a root must be Kubernetes manifests; raw Helm values
belong beside a real generator and must not be included in automatic discovery.

A directory referenced by Kustomize `resources` still needs its own kustomization.
When a wrapper only imports `ks.yaml`, reference that file directly from the
cluster root instead. Keep core selection explicit rather than recursively
scanning all available controllers.

Use the offline render helper for either kind of build root:

```sh
scripts/render-manifests kube/deploy/apps/phoebe
scripts/render-manifests kube/deploy/apps/phoebe/crossplane-system/crossplane/gcp
```

The helper uses Flux's in-memory build and does not write generated files to the
checkout. It validates manifest composition, not live dependencies or cluster
substitutions. For the full reconciliation transformations, use `flux build
kustomization` with the real Flux definition and the required substitution inputs.

Keep Flux owner names unchanged during layout-only moves. Moving a resource to a
different owner requires staged pruning protection and verification of adoption.

## Cluster metadata

Phoebe's deployment metadata is defined in
`kube/clusters/phoebe/flux/clusterinfo.yaml`. Its active compatibility entry point
in `kubernetes/flux/cluster` imports that file, so both the current and future
entry points use the same `flux-system/cluster-info` ConfigMap.

`cluster-apps` requires this ConfigMap via `postBuild.substituteFrom`. Its child
Kustomization defaults forward `CLUSTER`, `CLUSTER_DNS_IP`,
`CLUSTER_DNS_COREDNS_RESOLVERS`, `CLUSTER_POD_CIDR` and `CLUSTER_SVC_CIDR` as
inline substitutions. This avoids requiring a metadata ConfigMap in every
namespace and preserves each application's own substitution variables.
Children opting out of defaults keep their explicit configuration.

The CIDRs and DNS address must agree with the cluster's Talos network and
kubelet configuration. These are metadata inputs, not instructions to change
an existing cluster's networks. Phoebe's Flux sync path and Helm recovery
settings remain unchanged by introducing this ConfigMap.

## Prometheus CRDs

`core-prometheus-crds` installs the standalone `prometheus-operator-crds` chart
from `kube/deploy/core/observability/prometheus-operator-crds`. Both Phoebe and
Rhea select it. It installs the monitoring API definitions, not a Prometheus
server or operator. CRDs carry Helm's resource-retention annotation.

Phoebe's kube-prometheus-stack disables its bundled CRDs and skips Helm CRD
installation/upgrades. The stack and shared controllers that create monitoring
resources wait for the core CRD owner. Keep the CRD chart compatible with the deployed
Prometheus Operator when updating either chart.

Shared controllers enable their ServiceMonitors by default. Alert rules and
dashboard ConfigMaps are included where configured, even on clusters without
a monitoring stack. Installing a scraper is a separate cluster choice.
Grafana Operator dashboard bindings remain cluster-specific because they
require additional CRDs and a matching Grafana instance.

## Optional shared controllers

A definition in `kube/deploy/core` does not imply installation on every cluster.
Select optional controllers explicitly from each cluster's application root;
do not add them to an existing namespace aggregate merely to make them available.
The cluster composition also supplies the selected controllers' namespaces.

Phoebe selects CloudNativePG and Barman, Dragonfly, Garage, OpenTelemetry,
Envoy Gateway, Crossplane, kro, tofu-controller, tuppr and miroir. Rhea selects
only OpenTelemetry, Envoy Gateway and tuppr from this batch. Rhea does not gain
collectors, gateways or upgrade plans just by selecting their controllers.

Shared Helm values are generated as `<release>-defaults`; an optional
`<release>-values` ConfigMap supplies cluster overrides. Phoebe retains its
Grafana Operator bindings, Crossplane credentials and packages, and tofu runner
permissions under `kube/deploy/apps/phoebe`. Database/storage instances,
collectors, gateway resources and upgrade plans remain cluster-specific.
