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

For example, once Navidrome is migrated to base, Phoebe's media composition can
select it with `../../base/media/navidrome/ks.yaml`. A values-only override can
use the same optional `<release>-values` convention as core controllers. Keep
cluster-specific hostnames, credentials and workload instances in the cluster
layer rather than baking Phoebe assumptions into base.

Namespace composition uses these independently selectable components:

- `kube/components/namespace`: namespace creation and pruning protection.
- `kube/components/namespace-backups`: backup mover annotations.
- `kube/components/app-template`: the namespace-local chart source.
- `kube/components/grafana-folder`: the NamespaceFolder integration, where its
  controller is installed.
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
