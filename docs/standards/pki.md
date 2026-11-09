# PKI (Public Key Infrastructure)

All clusters managed by this repository use [trust-manager](https://cert-manager.io/docs/trust/trust-manager/)
to manage distribution of trusted roots to workload pods, and [Kyverno](http://kyverno.io/)
to apply the trusted root bundle to every workload pod in the cluster.
