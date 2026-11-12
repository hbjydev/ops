# GitOps

Flux deploys the configuration stored in this repository.
[Flux Operator](https://fluxoperator.dev/) manages Flux on each cluster.

## Deployment layers

Cluster roots explicitly select shared controllers and local Flux Kustomizations.
Keep the application layout consistent: `apps/<cluster>/<namespace>/<application>`.
Core owns controller releases and their defaults. Cluster configuration owns
credentials, provider packages, dashboards, routes and workload instances.

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
