# GitOps

Flux deploys the configuration stored in this repository.
[Flux Operator](https://fluxoperator.dev/) manages Flux on each cluster.

## Deployment layers

`kube/deploy/core/<namespace>/<controller>` contains shared controller manifests.
`kube/deploy/apps/base/<namespace>/<application>` contains shared workload
manifests. These are catalogues of reusable resources, not cluster selections.
HelmRelease defaults live inline in `spec.values`.

Each cluster owns its Flux Kustomizations under
`kube/deploy/apps/<cluster>/<namespace>/<application>`. A local `ks.yaml` selects
the shared build path and declares dependencies, integrations, substitutions and
patches. Where an application already had a separate local configuration
`ks.yaml`, its controller declaration is in `controller.yaml`; both retain their
existing Flux identities and reconciliation boundaries.

Cluster and namespace `kustomization.yaml` files explicitly select these local
files and resources. A namespace using an unchanged shared app needs only its
local Flux declaration and a selection entry. It needs no values ConfigMap or
empty override directory. Refer directly to `ks.yaml` when a wrapper would only
list that file.

Keep cluster-specific domains, endpoints, credentials, storage choices and
instances in the cluster layer. Keep application network policies alongside
shared application manifests. Moving a declaration does not move its managed
resources to another owner: preserve Flux names, namespaces and build paths.

### Namespace composition

Namespace compositions select these independent integrations:

- `kube/components/namespace`: namespace creation and pruning protection.
- `kube/components/namespace-backups`: backup mover annotations.
- `kube/components/app-template`: the namespace-local chart source.
- `kube/components/infra-folder`: the Crossplane NamespaceFolder integration.
- `kube/clusters/phoebe/components/registry-credentials`: registry secrets.
- `kube/clusters/phoebe/components/github-status`: GitHub credentials and Flux status.
- `kube/clusters/phoebe/components/sops`: the namespace-local decryption key.

These remain owned by `cluster-apps`. Kaniop retains its pre-existing namespace
integration overlap in its child build; removing that overlap requires a separate
ownership handover.

### Cluster configuration

Controllers and their instances are selected separately. Phoebe owns its
PostgreSQL, Dragonfly, Garage, Kanidm, Cilium network configuration, gateways,
collectors and upgrade plans. Their existing owners and recovery settings stay
unchanged by relocating deployment declarations.

Application themes and runtime configuration still use ConfigMaps where the
application consumes them. Grafana/Gatus/Home Assistant configuration generators
retain their substitution controls. Only Helm values transport ConfigMaps have
been removed.

Phoebe's Flux instance retains `kubernetes/flux/cluster` as its compatibility
entry point. Bootstrap redesign is separate from this layout change.

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

### Helm values and opt-out labels

Shared HelmReleases keep their defaults inline. A cluster customises a release
through its own Flux Kustomization's `spec.patches`:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: core-cilium
  namespace: kube-system
  labels:
    kustomization.flux.home.arpa/helm-defaults: disabled
spec:
  path: ./kube/deploy/core/kube-system/cilium/app
  targetNamespace: kube-system
  patches:
    - target:
        group: helm.toolkit.fluxcd.io
        kind: HelmRelease
        name: cilium
      patch: |
        apiVersion: helm.toolkit.fluxcd.io/v2
        kind: HelmRelease
        metadata:
          name: cilium
        spec:
          values:
            autoDirectNodeRoutes: true
```

The example shows only a values override. Opting out also means explicitly
selecting the desired Helm install, upgrade, rollback and timeout behaviour.
Existing migrated overrides retain those settings as a preceding patch, including
settings for any integration HelmReleases in the same build.

`cluster-apps` applies two separately selected defaults patches:

- `kustomization.flux.home.arpa/defaults: disabled` opts out of both general Flux
  defaults and injected Helm defaults, preserving the existing full opt-out.
- `kustomization.flux.home.arpa/helm-defaults: disabled` opts out only of injected
  Helm patches. Cluster metadata, source and reconciliation defaults still apply.

Use the narrower label whenever a child manages its own `spec.patches` list.
Otherwise the parent Helm defaults replace that list. This is deliberate and
explicit; there is no defaults component or implicit override-directory lookup.

Kustomize merges maps and generally replaces lists in HelmRelease patches.
A strategic-merge `null` removes a field; use a JSON patch to set a literal null
when that is part of the chart values. Integrations may populate inline values
before the child patches run. Keep their readiness gates, labels and credentials
when overriding related maps or lists.

### Local resources and exceptional patches

Put local resources in a separate `config/` directory, or a descriptive directory
such as `gateways/`, `collector/` or `gcp/`. Declare their Flux owner locally and
depend on the appropriate controller. Credentials, dashboards and routes retain
their existing owners; this layout does not combine them into controller builds.

Phoebe's External Secrets chart-version overlay and Kopiur Helm post-renderer
remain explicit local resource customisations. Their local Flux declarations
select those existing overlays directly.

### Kustomization files and local rendering

Keep `kustomization.yaml` where it performs selection, generates ConfigMaps,
imports shared resources, or applies patches, components or transformations.
Do not keep it merely to enumerate all manifests under a Flux build root.
Flux generates that inventory recursively when `spec.path` has no kustomization.
All YAML files beneath such a root must be Kubernetes manifests; raw Helm values
belong beside a real generator and must not be included in automatic discovery.

A directory referenced by Kustomize `resources` still needs its own kustomization.
When a wrapper only imports `ks.yaml`, reference that file directly from the
cluster composition instead. Select local deployment declarations explicitly
rather than recursively scanning all available shared controllers.

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

Shared Helm values live inline in each HelmRelease; cluster-local Flux
Kustomizations supply overrides through resource patches. Phoebe retains its
Grafana Operator bindings, Crossplane credentials and packages, and tofu runner
permissions under `kube/deploy/apps/phoebe`. Database/storage instances,
collectors, gateway resources and upgrade plans remain cluster-specific.
