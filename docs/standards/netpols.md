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

The following applications own explicit policies in their `app` Kustomizations.
These are staged allowances (`enableDefaultDeny: false`), not a declaration that
the controllers or their managed applications are fully isolated. Shared DNS
rules still come from the Cilium baseline.

Each controller has Kubernetes API access, plus port-specific health probes,
metrics from `netpol.home.arpa/o11y=true` collectors, and admission webhook
access where applicable. Additional connections are:

| Namespace | Controller | Additional traffic |
| --- | --- | --- |
| `cnpg-system` | `cloudnative-pg` | PostgreSQL instances on TCP 8000/5432; Barman plugin on TCP 9090 |
| `cnpg-system` | `cloudnative-pg-barman-cloud-plugin` | CNPG-I requests from the CNPG controller on TCP 9090 |
| `crossplane-system` | `crossplane` | Public HTTPS for package registries, authentication and CDNs; composition functions on TCP 9443 |
| `dragonfly-system` | `dragonfly-operator` | Managed Dragonfly instances on TCP 6379 |
| `flux-system` | `tofu-controller` | Runners on TCP 30000; Flux artifacts and events on TCP 9090 |
| `garage-system` | `garage-operator` | Managed Garage admin APIs on TCP 3903 |
| `network` | `envoy-gateway` | xDS requests from managed Envoy proxies on TCP 18000 |
| `observability` | `grafana-operator` | Local Grafana on TCP 3000; dashboard downloads from `grafana.com` and `raw.githubusercontent.com` on TCP 443 |
| `observability` | `victoria-metrics-operator` | Kubernetes API reconciliation only |
| `security` | `kaniop` | Managed Kanidm APIs on TCP 8443; public HTTPS for configured appearance images and redirects |
| `system-upgrade` | `tuppr` | Node Talos APIs on TCP 50000; public HTTPS for image checks |

Envoy Gateway's certificate-generation hook has a separate API-only policy,
selected by its pod label and chart-generated service account.

Crossplane's RBAC manager has a separate policy without registry or function
access. Its generated providers still need their own policies for the APIs they
manage; the controller policy does not select them.

Tofu runner policies select `tf-runner` pods created by `tofu-controller` in
`flux-system` and `network`, matching the configured runner service-account
namespaces. They allow the Kubernetes API, Flux artifacts, public HTTPS for
provider downloads/APIs, and incoming controller RPC. Update the selectors when
enabling another runner namespace. Flux artifact/event receiver allowances are
owned by the Tofu application as well.

Tuppr's `talos-upgrade` and `kubernetes-upgrade` jobs are selected separately using
their `app.kubernetes.io/part-of=tuppr` label. They can reach the Kubernetes API,
node Talos APIs and public HTTPS. Arbitrary user-defined hook jobs are outside
this allowance.

Public HTTPS allowances use the same IPv4 private-range exclusions as the
`internet-https` baseline. They deliberately support registry redirects and
configurable remote APIs rather than pinning CDN IPs. They do not allow private
HTTPS endpoints or IPv6. Internal operand access uses pod selectors and explicit
ports; policies for those operands remain owned by their applications.

Before enabling default-deny, verify both directions of each connection,
installation/upgrade hooks, generated workloads, custom ports, and any added
external endpoints. Schema and selector validation does not establish live
traffic completeness.

Protocol references: [CloudNativePG ports](https://cloudnative-pg.io/docs/current/security/),
[CNPG-I transport](https://cloudnative-pg.io/docs/current/cnpg_i/),
[Tofu runner networking](https://flux-iac.github.io/tofu-controller/getting_started/),
and [Cilium policy enforcement](https://docs.cilium.io/en/stable/security/policy/intro/).
