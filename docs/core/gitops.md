# GitOps

Flux deploys the configuration stored in this repository.
[Flux Operator](https://fluxoperator.dev/) manages Flux on each cluster.

## Cluster overrides for shared core

A Kustomize component groups reusable patches and resources.
Shared Flux Kustomizations can select a component from a standard directory for each cluster:
`kube/deploy/apps/<cluster>/<namespace>/<workload>/overrides`.
The first workload that uses this convention is `core-flux-operator`.

The shared Flux Kustomization keeps its workload path and selects the component relative to that path:

```yaml
spec:
  path: ./kube/deploy/core/flux-system/flux-operator/app
  components:
    - ../../../../apps/${CLUSTER}/flux-system/flux-operator/overrides
  ignoreMissingComponents: true
```

The parent `cluster-apps` substitutes `${CLUSTER}` before it applies the shared Flux Kustomization.
The child then builds the shared manifests with the selected component.
Substitution on the child itself occurs too late to select its component path.
Phoebe's active parent in `kubernetes/flux/cluster/ks.yaml` supplies `CLUSTER: phoebe` directly.
The parents under `kube/clusters/<cluster>/flux/apps.yaml` read `CLUSTER` from the `cluster-info` ConfigMap.

Each override directory contains a `kustomization.yaml` with `kind: Component`:

```yaml
apiVersion: kustomize.config.k8s.io/v1alpha1
kind: Component
patches:
  - path: ./helmrelease-patch.yaml
```

The patch targets the HelmRelease directly.
The cluster's top-level `kustomization.yaml` imports the shared workload directory directly.
Phoebe selects `../../core/flux-system/flux-operator` without a namespace wrapper or a patch that injects another patch.
For a cluster that uses shared defaults, the override directory is absent.

With `ignoreMissingComponents: true`, Flux uses shared defaults when the override directory is absent.
Phoebe and Rhea use this behaviour for the Flux operator.
A misspelled path or accidental deletion also selects shared defaults, so render comparisons must protect required cluster behavior.

To adopt the convention for another shared workload:

1. Add a component directory for each cluster that needs workload overrides.
2. Move the workload overrides into direct resource patches within those components.
3. Add the relative component path to the shared Flux Kustomization.
4. Remove the old patches that inject workload overrides into the Flux Kustomization.
5. Render each parent with its cluster variables, then render the child with the resulting Flux Kustomization.
6. Make sure that resource identities, values, and unrelated resources match the previous output.

Keep Flux Kustomization names unchanged during this refactor to preserve resource ownership.
The parent substitution also processes its other rendered resources, so compare the complete parent output when enabling it.
See the [Flux component documentation](https://fluxcd.io/flux/components/kustomize/kustomizations/#components) for component path rules.

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
