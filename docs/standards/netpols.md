# Network Policies

## Naming Convention

All network policies are named via a convention for ease of reading:

```
np-<type>-<action>-<description>
```

| Field | Description | Allowed Values |
| ----- | ----------- | -------------- |
| `type` | The type of policy this is, in reference to what direction of traffic this policy governs. | `e` for egress, `i` for ingress, and `x` for bidirectional |
| `action` | What action this policy configures. | `a` for allow, `d` for deny. |
| `description` | A short slug to describe this policy. | Any short, URL-safe value. |

Some examples of policy names:

- `np-e-a-hubble-ui-to-relay`: Egress (`e`) policy allowing (`a`) Hubble UI to talk to Hubble Relay (`hubble-ui-to-relay`).
- `np-i-a-silo-internet`: Ingress (`i`) policy allowing (`a`) Silo to talk to the internet (`silo-internet`).
- `np-x-a-cnpg-cluster-nodes`: Bidirectional (`x`) policy allowing (`a`) Cloudnative-PG nodes within the same cluster to talk to each other (`cnpg-cluster-nodes`).

## Application

Policies can be applied in one of three ways:

- Explicit purpose (specifying the affected resources in their manifests)
- Apply-by-default (such as those in `core`)
- Apply-by-label (apply the netpol to a pod by adding a `<ingress|egress|...>.netpol.home.arpa/<to>=<allow|deny>` label to it)

### Apply-by-label notes

The current label policies support `allow`. A `deny` value does not select a deny rule and does not override other allowances.

Apply these labels to pod templates, including installation, upgrade, and deletion jobs. See [the label reference](labels.md) for supported keys.

Standard allowances set `enableDefaultDeny` to `false` for their traffic direction. This lets operators stage labels without enabling isolation. A separate default-deny policy determines when unmatched traffic is blocked.

The deployment resource list includes DNS, label-based, and service-specific allowances. It excludes `default-deny.yaml` and `kube-system-allow-all.yaml`.

Allow rules combine their permissions. A broad `cluster`, `host`, or `world` label grants more access than an individual service usually needs. Use specific peer and port rules for internal service connections.

### Host scope

This baseline governs Cilium-managed pods. It does not change the host firewall or govern pods that use host networking. On rhea, the Kubernetes control-plane processes and Cilium agent/operator use host networking. CoreDNS and Hubble remain within the pod policy scope.

## Policy placement

Shared baseline policies live in `kube/deploy/core/kube-system/cilium/netpols`.
Phoebe's local-network policies live in
`kube/deploy/apps/phoebe/kube-system/cilium/netpols`.

Keep application policies, including label-selected client allowances, beside
the application manifests and include them in that application's Kustomization.
The application owns their deployment and removal. Gateway allowances belong
beside the Envoy gateway manifests. Applications still in `kubernetes/apps`
keep their policies there until the application itself moves.

## Core controller allowances

Prefer the existing shared policy labels on pod templates. Application policies
only describe traffic for which no existing label fits, or generated pods whose
labels cannot be configured. Shared policies and application allowances remain
staged (`enableDefaultDeny: false`); DNS comes from the Cilium baseline.

Core controllers use the `apiserver`, `host`, `o11y`, `internet-https`, and
`talos-api` labels as needed. These retain the shared policies' scope: host and
monitoring ingress are not port-limited, public HTTPS includes TCP and UDP 443,
and Talos API access includes TCP 50000/50001. Grafana dashboard downloads use
the shared public HTTPS allowance rather than a separate hostname allowlist.

| Namespace | Application | Explicit policy remaining |
| --- | --- | --- |
| `cnpg-system` | `cloudnative-pg` | Instance status/PostgreSQL on TCP 8000/5432 across managed clusters; Barman plugin RPC on TCP 9090 |
| `cnpg-system` | `cloudnative-pg-barman-cloud-plugin` | CNPG-I requests from the CNPG controller on TCP 9090 |
| `crossplane-system` | `crossplane` | Composition function RPC on TCP 9443, including function-side ingress |
| `dragonfly-system` | `dragonfly-operator` | None; uses the existing `egress.netpol.home.arpa/dragonfly` allowance owned by the database application |
| `flux-system` | `tofu-controller` | Runner RPC on TCP 30000; Flux artifact/event traffic on TCP 9090, including receiver-side ingress |
| `garage-system` | `garage-operator` | Managed Garage admin APIs on TCP 3903 |
| `network` | `envoy-gateway` | xDS requests from managed Envoy proxies on TCP 18000 |
| `observability` | `grafana-operator` | Local Grafana API on TCP 3000 |
| `observability` | `victoria-metrics-operator` | None; shared labels cover controller traffic |
| `security` | `kaniop` | Managed Kanidm APIs on TCP 8443 |
| `system-upgrade` | `tuppr` | Generated upgrade jobs: Kubernetes API, node Talos APIs and public HTTPS |

The PostgreSQL client label only targets the named postgres cluster and does
not cover instance status on TCP 8000, so it does not replace CNPG's operator
policy across managed clusters.

Most charts expose pod-label values directly. Crossplane's shared `customLabels`
cover API egress and monitoring on both controllers; a targeted Helm
post-renderer adds webhook ingress and public HTTPS only to the main controller.
The RBAC manager does not receive registry or composition-function access.
Generated providers still need their own allowances for the APIs they manage.

Kaniop's chart does not expose operator pod labels, so its Helm post-renderer
patches the Deployment pod template. The CRD apply hook inherits API egress via
the chart's `additionalLabels`. Envoy's certificate-generation hook uses its
native `certgen.job.pod.labels` field for API egress.

Tofu runners get API and public HTTPS labels through each Terraform resource's
`runnerPodTemplate.metadata.labels`. Add those labels to new Terraform resources
as well. The explicit runner RPC/artifact policies select `tf-runner` pods created
by `tofu-controller` in `flux-system` and `network`, matching the configured runner
service-account namespaces; extend the selectors when enabling another namespace.

Tuppr 0.5.10 does not expose custom pod labels for its generated `talos-upgrade`
and `kubernetes-upgrade` jobs. Their explicit policy selects both the workload
name and `app.kubernetes.io/part-of=tuppr`. The controller itself uses shared
labels. Arbitrary user-defined hook jobs are outside this allowance.

Before enabling default-deny, verify both directions of each connection,
installation/upgrade hooks, generated workloads, custom ports and added external
endpoints. Managed application policies remain owned by those applications.
Schema, chart rendering and selector checks do not establish live traffic
completeness.

Protocol references: [CloudNativePG ports](https://cloudnative-pg.io/docs/current/security/),
[CNPG-I transport](https://cloudnative-pg.io/docs/current/cnpg_i/),
[Tofu runner networking](https://flux-iac.github.io/tofu-controller/getting_started/),
and [Cilium policy enforcement](https://docs.cilium.io/en/stable/security/policy/intro/).
